/**
 * Event Cards Generation
 *
 * Assigns card styles (hero, carousel, minimal, accent) and image queries to events.
 */

const { TABLES, upsertEntity } = require("../shared/tableStorage");
const { searchUnsplash, resetImageTracking } = require("./images");
const logger = require("../shared/logger");

const AI_TIMEOUT = 45000;

const SYSTEM_PROMPT = `You design event cards for a travel itinerary app. Each event gets a card style and optional image queries.

Card Styles:
- "hero": Large dramatic image - major attractions, landmarks
- "carousel": 3-4 swipeable images - walking tours, explorations
- "accent": Small thumbnail - restaurants, minor activities
- "minimal": No image - flights, transfers, check-ins

Guidelines:
- Flights, transfers, check-ins → minimal
- Major landmarks → hero
- Walking tours → carousel
- Restaurants → accent or minimal
- Only 30-40% of events should have images

IMPORTANT - Image Query Rules:
- Keep queries SHORT: 2-4 words max
- Use generic travel terms that Unsplash will have
- Good: "acropolis sunset", "greek taverna", "bangalore palace"
- Bad: "acropolis parthenon golden hour marble columns ancient greece" (too long!)
- Bad: "spondi restaurant athens" (too specific, won't match)

Return JSON mapping event IDs to config:
{"evt-001": {"style": "minimal", "queries": []}, "evt-002": {"style": "hero", "queries": ["acropolis sunset"]}, "evt-003": {"style": "carousel", "queries": ["plaka street", "athens market", "greek cafe"]}}`;

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
 * Generate configs and resolve images from Unsplash
 */
async function generateEventCards(tripData) {
  // Check Unsplash key upfront
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  await logger.info("eventcards", `Unsplash key: ${!!unsplashKey}, length: ${unsplashKey?.length || 0}`);

  // Get AI-generated configs
  const configs = await generateEventCardConfigs(tripData);
  await logger.info("eventcards", `Got ${Object.keys(configs).length} event configs from Claude`);

  // Reset image tracking
  resetImageTracking();

  // Resolve images for each event
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
    for (const query of queries.slice(0, 4)) {
      totalQueries++;
      try {
        const image = await searchUnsplash(query, { orientation: "landscape" });
        if (image) {
          resolvedImages++;
          await logger.info("eventcards", `Found image for: ${query.slice(0, 40)}`, {
            url: image.url?.slice(0, 60),
            credit: image.credit
          });
          images.push({
            query,
            url: image.url,
            thumb: image.thumb,
            credit: image.credit,
            creditUrl: image.creditUrl,
            color: image.color
          });
        } else {
          await logger.warn("eventcards", `No image for: ${query.slice(0, 50)}`);
        }
      } catch (imgErr) {
        await logger.error("eventcards", `Image error: ${imgErr.message}`, { query });
      }
      await new Promise(r => setTimeout(r, 200));
    }

    eventCards[eventId] = { cardStyle: style, images };
  }

  await logger.info("eventcards", `Done: ${totalQueries} queries, ${resolvedImages} images resolved`);
  await logger.flush();

  return eventCards;
}

module.exports = { generateEventCards, generateEventCardConfigs };
