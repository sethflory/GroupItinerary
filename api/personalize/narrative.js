/**
 * Narrative Generation via Claude AI
 *
 * Generates day nicknames, image search queries, and mood tags
 * that tell a cohesive story from beginning to end of the trip.
 */

const { validateNarrativeOutput } = require("./sanitize");

const AI_TIMEOUT = 45000; // 45 seconds

const SYSTEM_PROMPT = `You are a travel storyteller and visual curator. Given an itinerary, you create a narrative arc that transforms disconnected days into chapters of a journey, and design beautiful, varied event cards.

## Your Tasks

1. **Narrative Arc**: Name each day so they tell a story from beginning to end
   - Opening days: anticipation, departure, arrival
   - Middle days: immersion, discovery, adventure
   - Transitions: when locations or group dynamics change
   - Closing days: reflection, farewell, return

2. **Day Backgrounds**: For each day, provide search terms for evocative travel photography.
   - Be specific: "santorini blue dome sunset caldera" not "greece"
   - Include mood words: "cozy" "dramatic" "peaceful" "vibrant"
   - For landmarks: include the actual place name
   - For travel days: "airplane window clouds sunrise"

3. **Event Card Design**: Make each event visually unique and appropriate to its type:

   **Card Styles** (choose wisely to create variety):
   - "hero": Large dramatic image - for major attractions, landmarks, special moments
   - "carousel": 3-4 images to swipe - for explorations, neighborhoods, multi-stop activities
   - "minimal": Clean text-focused - for logistics, transfers, check-ins, simple meals
   - "accent": Small thumbnail image - for minor activities, quick stops

   **Guidelines**:
   - NOT every event needs a hero image - that gets boring!
   - Flights, transfers, hotel check-ins → minimal (no image needed)
   - Major landmarks, bucket-list items → hero
   - Walking tours, neighborhood exploration → carousel (show variety)
   - Restaurants, cafes → accent or minimal
   - Mix it up! A day should have variety: maybe 1 hero, 1-2 carousel, rest minimal/accent
   - IMPORTANT: Generate UNIQUE, SPECIFIC queries - no two events should have the same image

4. **Image Query Rules**:
   - Be VERY specific to avoid duplicates
   - Include unique identifiers: restaurant names, street names, specific landmarks
   - For carousels: each query should find a DIFFERENT aspect
   - Bad: "athens food" (too generic, will repeat)
   - Good: "moussaka traditional greek taverna wooden table" (specific)

## Output Format

Return ONLY valid JSON (no markdown, no explanation). Example structure:

{"narrativeArc":{"theme":"A Mediterranean Odyssey","chapters":["departure","exploration","adventure","return"]},"days":[{"dayNum":1,"nickname":"The Journey Begins","bgQuery":"airplane window clouds sunrise travel","bgMood":"anticipation","colorAccent":"#5da9e9"}],"events":[{"eventId":"evt-123","cardStyle":"hero","cardQueries":["acropolis parthenon golden hour athens marble columns"]},{"eventId":"evt-456","cardStyle":"carousel","cardQueries":["plaka cobblestone bougainvillea","monastiraki flea market stalls","anafiotika whitewashed houses"]},{"eventId":"evt-789","cardStyle":"minimal","cardQueries":[]}]}

Fields:
- narrativeArc.theme: evocative trip tagline
- days[].dayNum: matches input day number
- days[].nickname: creative 2-5 word chapter title
- days[].bgQuery: specific Unsplash search terms
- days[].bgMood: one word mood
- events[].eventId: EXACT event ID from input
- events[].cardStyle: "hero"|"carousel"|"minimal"|"accent"
- events[].cardQueries: array of specific image search terms`;

/**
 * Generate narrative for a trip
 */
async function generateNarrative(sanitizedTrip) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI service not configured");
  }

  // Build the user prompt
  const userPrompt = buildNarrativePrompt(sanitizedTrip);

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

    console.log("[Narrative] API response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Narrative] API error response:", errorBody);
      let errorMsg = errorBody.slice(0, 200);
      try {
        const error = JSON.parse(errorBody);
        errorMsg = error?.error?.message || errorMsg;
      } catch (e) {}
      throw new Error(`AI API error: ${response.status} - ${errorMsg}`);
    }

    const data = await response.json();
    console.log("[Narrative] API response keys:", Object.keys(data));
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error("AI returned empty response");
    }

    console.log("[Narrative] Raw AI response length:", content.length);
    console.log("[Narrative] Raw AI response preview:", content.slice(0, 300));

    // Parse JSON from response - try multiple extraction methods
    let jsonStr = content;

    // Method 1: Extract from markdown code block
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonStr = codeBlockMatch[1].trim();
      console.log("[Narrative] Extracted from code block");
    } else {
      // Method 2: Find JSON object directly (starts with {)
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonStr = content.slice(jsonStart, jsonEnd + 1);
        console.log("[Narrative] Extracted JSON object directly");
      }
    }

    // Clean up common JSON issues
    jsonStr = jsonStr
      .replace(/,\s*}/g, '}')      // Remove trailing commas before }
      .replace(/,\s*]/g, ']')      // Remove trailing commas before ]
      .replace(/[\x00-\x1F\x7F]/g, ' '); // Remove control characters

    let narrative;
    try {
      narrative = JSON.parse(jsonStr);
      console.log("[Narrative] Successfully parsed JSON");
    } catch (parseErr) {
      console.error("[Narrative] JSON parse error:", parseErr.message);
      console.error("[Narrative] JSON around error position:", jsonStr.slice(7300, 7500));
      console.error("[Narrative] Full JSON length:", jsonStr.length);
      throw new Error("AI returned invalid JSON: " + parseErr.message);
    }

    // Validate structure
    validateNarrativeOutput(narrative);

    return narrative;

  } catch (err) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      throw new Error("AI request timed out");
    }
    throw err;
  }
}

/**
 * Build the user prompt for narrative generation
 */
function buildNarrativePrompt(trip) {
  const travelerList = trip.travelers.map(t => t.name).join(", ");
  const travelerCount = trip.travelers.length;

  // Format days with events (include event IDs for AI to reference)
  const daysFormatted = trip.days.map(day => {
    const eventList = day.events.map(e => `  - [${e.id}] ${e.type}: ${e.title}${e.where ? ` at ${e.where}` : ""}`).join("\n");
    return `Day ${day.dayNum} (${day.date}) - ${day.location}
Theme: ${day.theme || "No theme set"}
${eventList || "  (no events)"}`;
  }).join("\n\n");

  // Detect special dynamics
  const locations = [...new Set(trip.days.map(d => d.location))];
  const hasMultipleDestinations = locations.length > 1;

  let specialNotes = "";
  if (hasMultipleDestinations) {
    specialNotes += `\n- Multiple destinations: ${locations.join(" → ")}`;
  }
  if (travelerCount > 1) {
    specialNotes += `\n- Group trip with ${travelerCount} travelers`;
  }

  return `Personalize this itinerary:

**Trip:** ${trip.name}
**Travelers:** ${travelerList} (${travelerCount} people)
**Dates:** ${trip.startDate} to ${trip.endDate} (${trip.duration} days)

**Itinerary:**

${daysFormatted}

${specialNotes ? `**Special Notes:**${specialNotes}` : ""}

Generate a narrative with day nicknames and image queries. Output valid JSON only.`;
}

module.exports = {
  generateNarrative
};
