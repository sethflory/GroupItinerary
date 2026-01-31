/**
 * Day Backgrounds Generation
 *
 * Generates Unsplash search queries for each day's background image.
 */

const { TABLES, upsertEntity } = require("../shared/tableStorage");
const { searchUnsplash, resetImageTracking } = require("./images");

const AI_TIMEOUT = 30000;

const SYSTEM_PROMPT = `You create Unsplash search queries for travel day backgrounds. Each query should find a beautiful, evocative photo that captures the day's mood and location.

Rules:
- Be specific: "santorini blue dome sunset caldera" not "greece"
- Include mood words: "cozy", "dramatic", "peaceful", "vibrant", "golden hour"
- For landmarks: include the actual place name
- For travel days: "airplane window clouds sunrise"
- Each query must be UNIQUE - no duplicates

Return ONLY a JSON object mapping day numbers to search queries:
{"1":"airplane window clouds sunrise golden light","2":"acropolis parthenon athens golden hour dramatic sky","3":"plaka neighborhood athens cobblestone evening lights"}`;

async function generateBackgroundQueries(tripData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI service not configured");
  }

  const daysList = tripData.days.map(d => {
    const eventsPreview = (d.events || []).slice(0, 3).map(e => e.title).join(', ');
    return `Day ${d.dayNum}: ${d.location}${d.theme ? ` - ${d.theme}` : ''}${eventsPreview ? ` (${eventsPreview})` : ''}`;
  }).join('\n');

  const userPrompt = `Create background image queries for these trip days:

Trip: ${tripData.name}
${daysList}

Return JSON mapping day numbers to Unsplash search queries.`;

  console.log("[Backgrounds] Prompt:", userPrompt);

  // Save prompt to debug table
  const debugRowKey = new Date().toISOString().replace(/[:.]/g, "-");
  await upsertEntity(TABLES.DEBUG, {
    partitionKey: "backgrounds",
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
        max_tokens: 1024,
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
      partitionKey: "backgrounds",
      rowKey: debugRowKey,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userPrompt,
      content: content || "EMPTY",
      timestamp: new Date().toISOString()
    }).catch(() => {});

    if (!content) {
      throw new Error("Empty response from AI");
    }

    console.log("[Backgrounds] Raw response:", content);

    // Extract JSON
    let jsonStr = content;
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      jsonStr = content.slice(jsonStart, jsonEnd + 1);
    }

    const queries = JSON.parse(jsonStr);
    console.log("[Backgrounds] Parsed queries:", queries);

    return queries;

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  }
}

/**
 * Generate queries and resolve images from Unsplash
 */
async function generateBackgrounds(tripData) {
  // Get AI-generated queries
  const queries = await generateBackgroundQueries(tripData);

  // Reset image tracking to avoid duplicates
  resetImageTracking();

  // Resolve images from Unsplash
  const backgrounds = {};

  for (const [dayNum, query] of Object.entries(queries)) {
    console.log(`[Backgrounds] Resolving Day ${dayNum}: "${query}"`);

    const image = await searchUnsplash(query, { orientation: "landscape" });

    backgrounds[dayNum] = {
      query,
      url: image?.url || null,
      thumb: image?.thumb || null,
      credit: image?.credit || null,
      creditUrl: image?.creditUrl || null,
      color: image?.color || null
    };

    // Small delay between requests
    await new Promise(r => setTimeout(r, 150));
  }

  return backgrounds;
}

module.exports = { generateBackgrounds, generateBackgroundQueries };
