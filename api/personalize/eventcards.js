/**
 * Event Cards Generation
 *
 * Assigns card styles (hero, carousel, minimal, accent) and image queries to events.
 */

const { TABLES, upsertEntity } = require("../shared/tableStorage");
const { searchGooglePlaces, resetImageTracking } = require("./images");
const logger = require("../shared/logger");

const AI_TIMEOUT = 45000;

const SYSTEM_PROMPT = `You design event cards for a travel itinerary app. Each event gets a card style and optional image queries.

Card Styles:
- "hero": Large dramatic image - major attractions, landmarks, signature restaurants
- "carousel": 3-4 swipeable images - walking tours, explorations, multi-venue outings
- "accent": Small thumbnail - minor activities
- "minimal": No image - flights, transfers, check-ins

Guidelines:
- Flights, transfers, check-ins → minimal
- Major landmarks (Acropolis, museums, temples) → hero
- Walking tours, market visits → carousel
- Named restaurants, rooftop bars → hero (Google Places has photos!)
- Generic meals ("lunch", "dinner TBD") → minimal
- Only 40-50% of events should have images

IMPORTANT - Image Query Rules for Google Places:
- Use FULL venue names with city for best results
- Good: "Acropolis Museum Athens", "Spondi Restaurant Athens", "Bangalore Palace"
- Good: "Plaka District Athens", "Acropolis Athens Greece"
- Bad: "greek food" (too generic - no specific place)
- Bad: "sunset" (scenic, not a venue)
- For walking tours, use the neighborhood/area name

Return JSON mapping event IDs to config:
{"evt-001": {"style": "minimal", "queries": []}, "evt-002": {"style": "hero", "queries": ["Acropolis Athens Greece"]}, "evt-003": {"style": "carousel", "queries": ["Plaka District Athens", "Monastiraki Square Athens", "Ancient Agora Athens"]}}`;

async function generateEventCardConfigs(tripData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI service not configured");
  }

  // Build event list
  const eventsList = tripData.days.map(d => {
    const events = (d.events || []).map(e =>
      `  [${e.id}] ${e.type}: ${e.title}${e.where ? ` at ${e.where}` : ''}`
    ).join('\n');
    return `Day ${d.dayNum} - ${d.location}:\n${events || '  (no events)'}`;
  }).join('\n\n');

  const userPrompt = `Assign card styles and image queries to these events:

Trip: ${tripData.name}

${eventsList}

Return JSON mapping event IDs to {style, queries}.`;

  console.log("[EventCards] Prompt length:", userPrompt.length);

  // Save prompt to debug table
  const debugRowKey = new Date().toISOString().replace(/[:.]/g, "-");
  await upsertEntity(TABLES.DEBUG, {
    partitionKey: "eventcards",
    rowKey: debugRowKey,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: userPrompt,
    content: "PENDING...",
    timestamp: new Date().toISOString()
  }).catch(() => {});

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    // Update debug table with response
    await upsertEntity(TABLES.DEBUG, {
      partitionKey: "eventcards",
      rowKey: debugRowKey,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userPrompt,
      content: content || "EMPTY",
      timestamp: new Date().toISOString()
    }).catch(() => {});

    if (!content) {
      throw new Error("Empty response from AI");
    }

    console.log("[EventCards] Response length:", content.length);

    // Extract JSON
    let jsonStr = content;
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      jsonStr = content.slice(jsonStart, jsonEnd + 1);
    }

    const configs = JSON.parse(jsonStr);
    console.log("[EventCards] Parsed configs for", Object.keys(configs).length, "events");

    return configs;

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  }
}

/**
 * Generate configs and resolve images from Google Places
 */
async function generateEventCards(tripData) {
  // Get AI-generated configs
  const configs = await generateEventCardConfigs(tripData);
  await logger.info("eventcards", `Got ${Object.keys(configs).length} event configs from Claude`);

  // Reset image tracking
  resetImageTracking();

  // Build event cards with images from Google Places
  const eventCards = {};
  let totalQueries = 0;
  let resolvedImages = 0;

  for (const [eventId, config] of Object.entries(configs)) {
    const style = config.style || "minimal";
    const queries = config.queries || [];

    if (style === "minimal" || queries.length === 0) {
      eventCards[eventId] = { cardStyle: style, images: [] };
      continue;
    }

    const images = [];

    // For carousel, we want multiple images - Google Places returns multiple for one venue
    if (style === "carousel" && queries.length > 0) {
      // Search first query with multiple photos
      totalQueries++;
      try {
        const result = await searchGooglePlaces(queries[0], { maxPhotos: 4 });
        if (result) {
          // Use all photos from the place
          const allPhotos = result.allPhotos || [result];
          for (const photo of allPhotos) {
            resolvedImages++;
            images.push({
              query: queries[0],
              url: photo.url,
              thumb: photo.thumb,
              credit: photo.credit,
              creditUrl: photo.creditUrl,
              color: photo.color
            });
          }
          await logger.info("eventcards", `Found ${allPhotos.length} photos for: ${queries[0].slice(0, 40)}`);
        }
      } catch (imgErr) {
        await logger.error("eventcards", `Image error: ${imgErr.message}`, { query: queries[0] });
      }

      // If we need more images, search additional queries
      if (images.length < 3 && queries.length > 1) {
        for (const query of queries.slice(1, 3)) {
          totalQueries++;
          try {
            const image = await searchGooglePlaces(query, { maxPhotos: 1 });
            if (image) {
              resolvedImages++;
              images.push({
                query,
                url: image.url,
                thumb: image.thumb,
                credit: image.credit,
                creditUrl: image.creditUrl,
                color: image.color
              });
            }
          } catch (imgErr) {
            await logger.error("eventcards", `Image error: ${imgErr.message}`, { query });
          }
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } else {
      // Hero/accent - single query, single image
      totalQueries++;
      try {
        const image = await searchGooglePlaces(queries[0], { maxPhotos: 1 });
        if (image) {
          resolvedImages++;
          await logger.info("eventcards", `Found image for: ${queries[0].slice(0, 40)}`, {
            url: image.url?.slice(0, 60),
            credit: image.credit
          });
          images.push({
            query: queries[0],
            url: image.url,
            thumb: image.thumb,
            credit: image.credit,
            creditUrl: image.creditUrl,
            color: image.color
          });
        } else {
          await logger.warn("eventcards", `No image for: ${queries[0].slice(0, 50)}`);
        }
      } catch (imgErr) {
        await logger.error("eventcards", `Image error: ${imgErr.message}`, { query: queries[0] });
      }
    }

    await new Promise(r => setTimeout(r, 200)); // Rate limiting between events

    eventCards[eventId] = { cardStyle: style, images };
  }

  await logger.info("eventcards", `Done: ${totalQueries} queries, ${resolvedImages} images resolved`);
  await logger.flush();

  return eventCards;
}

module.exports = { generateEventCards, generateEventCardConfigs };
