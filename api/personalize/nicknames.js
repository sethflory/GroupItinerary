/**
 * Day Nicknames Generation
 *
 * Simple, focused prompt to generate creative nicknames for each day.
 */

const { TABLES, upsertEntity } = require("../shared/tableStorage");

const AI_TIMEOUT = 30000;

const SYSTEM_PROMPT = `You name trip days like chapters in a story. Each nickname should be 2-5 words, evocative, and tell a narrative arc from start to finish.

Examples:
- Day 1 (departure): "The Adventure Begins", "Wheels Up", "Into the Unknown"
- Middle days: "Ancient Wonders", "Market Wanderings", "A Taste of Athens"
- Final day: "Until Next Time", "Homeward Bound", "The Last Sunset"

Return ONLY a JSON object mapping day numbers to nicknames:
{"1":"The Journey Begins","2":"Ancient Wonders","3":"Hidden Gems","4":"Homeward Bound"}`;

async function generateNicknames(tripData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI service not configured");
  }

  // Build simple prompt
  const daysList = tripData.days.map(d =>
    `Day ${d.dayNum} (${d.date}): ${d.location}${d.theme ? ` - ${d.theme}` : ''}`
  ).join('\n');

  const userPrompt = `Name these trip days:

Trip: ${tripData.name}
${daysList}

Return JSON mapping day numbers to nicknames.`;

  console.log("[Nicknames] Prompt:", userPrompt);

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

    // Save to debug table
    await upsertEntity(TABLES.DEBUG, {
      partitionKey: "nicknames",
      rowKey: new Date().toISOString().replace(/[:.]/g, "-"),
      content: content || "EMPTY",
      timestamp: new Date().toISOString()
    }).catch(() => {});

    if (!content) {
      throw new Error("Empty response from AI");
    }

    console.log("[Nicknames] Raw response:", content);

    // Extract JSON
    let jsonStr = content;
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      jsonStr = content.slice(jsonStart, jsonEnd + 1);
    }

    const nicknames = JSON.parse(jsonStr);
    console.log("[Nicknames] Parsed:", nicknames);

    return nicknames;

  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  }
}

module.exports = { generateNicknames };
