/**
 * Event Cards Generation
 *
 * Assigns card styles (hero, carousel, minimal, accent) and image queries to events.
 */

const { TABLES, upsertEntity } = require("../shared/tableStorage");
const { searchUnsplash, resetImageTracking } = require("./images");

const AI_TIMEOUT = 45000;

const SYSTEM_PROMPT = `You design event cards for a travel itinerary app. Each event gets a card style and optional image queries.

Card Styles:
- "hero": Large dramatic image - major attractions, landmarks, bucket-list moments
- "carousel": 3-4 swipeable images - walking tours, neighborhood exploration, multi-stop activities
- "accent": Small thumbnail - restaurants, cafes, minor activities
- "minimal": No image - flights, transfers, hotel check-ins, logistics

Guidelines:
- Flights, transfers, check-ins → minimal (no queries needed)
- Major landmarks → hero with 1 specific query
- Walking tours, explorations → carousel with 3-4 distinct queries
- Restaurants, cafes → accent with 1 query OR minimal
- Mix it up! Not every event needs images
- Queries must be SPECIFIC to avoid duplicates

Return JSON object mapping event IDs to card config:
{
  "evt-001": {"style": "minimal", "queries": []},
  "evt-002": {"style": "hero", "queries": ["acropolis parthenon golden hour marble columns"]},
  "evt-003": {"style": "carousel", "queries": ["plaka cobblestone evening", "monastiraki market stalls", "anafiotika white houses"]}
}`;

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
  console.log(`[EventCards] Unsplash key available: ${!!unsplashKey}, length: ${unsplashKey?.length || 0}`);

  // Get AI-generated configs
  const configs = await generateEventCardConfigs(tripData);

  // Reset image tracking
  resetImageTracking();

  // Resolve images for each event
  const eventCards = {};

  for (const [eventId, config] of Object.entries(configs)) {
    const style = config.style || "minimal";
    const queries = config.queries || [];

    if (style === "minimal" || queries.length === 0) {
      eventCards[eventId] = { style, images: [] };
      continue;
    }

    console.log(`[EventCards] Resolving ${eventId}: ${style} with ${queries.length} queries`);

    const images = [];
    for (const query of queries.slice(0, 4)) {
      try {
        const image = await searchUnsplash(query, { orientation: "landscape" });
        console.log(`[EventCards] Query "${query.slice(0, 30)}..." -> ${image ? 'found' : 'null'}`);
        if (image) {
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
        console.error(`[EventCards] Image error for "${query}":`, imgErr.message);
      }
      await new Promise(r => setTimeout(r, 200)); // Increase delay to avoid rate limits
    }

    eventCards[eventId] = { style, images };
  }

  return eventCards;
}

module.exports = { generateEventCards, generateEventCardConfigs };
