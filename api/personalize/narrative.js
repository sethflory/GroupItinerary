/**
 * Narrative Generation via Claude AI
 *
 * Generates day nicknames, image search queries, and mood tags
 * that tell a cohesive story from beginning to end of the trip.
 */

const { validateNarrativeOutput } = require("./sanitize");

const AI_TIMEOUT = 45000; // 45 seconds

const SYSTEM_PROMPT = `You are a travel storyteller and visual curator. Given an itinerary, you create a narrative arc that transforms disconnected days into chapters of a journey.

## Your Tasks

1. **Narrative Arc**: Name each day so they tell a story from beginning to end
   - Opening days: anticipation, departure, arrival
   - Middle days: immersion, discovery, adventure
   - Transitions: when locations or group dynamics change
   - Closing days: reflection, farewell, return

2. **Image Queries**: For each day, provide search terms that will find evocative, high-quality travel photography on Unsplash.
   - Be specific: "santorini blue dome sunset caldera" not "greece"
   - Include mood words: "cozy" "dramatic" "peaceful" "vibrant"
   - For landmarks: include the actual place name
   - For travel days: "airplane window clouds sunrise" or "airport terminal morning light"

3. **Event Queries**: For notable activities, provide image search queries
   - Focus on the experience, not generic stock photos
   - "acropolis parthenon golden hour tourists" not "greek temple"

## Rules

- Nicknames should be evocative but not cheesy (no "Amazing Athens Adventure!")
- Each nickname should feel like a chapter title in a memoir
- Consider what travelers will FEEL each day, not just what they'll DO
- The narrative should acknowledge group dynamics (splits, reunions)
- Keep nicknames under 40 characters
- Image queries should be 3-7 words

## Output Format

Return valid JSON with this structure:
{
  "narrativeArc": {
    "theme": "string - overall trip theme/tagline",
    "chapters": ["departure", "exploration", "adventure", "return"]
  },
  "days": [
    {
      "dayNum": 1,
      "nickname": "The Journey Begins",
      "bgQuery": "airplane window clouds sunrise travel",
      "bgMood": "anticipation",
      "colorAccent": "#5da9e9"
    }
  ],
  "events": [
    {
      "eventId": "event-id-here",
      "cardQuery": "acropolis parthenon athens sunny tourists"
    }
  ]
}`;

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
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`AI API error: ${response.status} - ${error.error?.message || "Unknown"}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error("AI returned empty response");
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1].trim();

    let narrative;
    try {
      narrative = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[Narrative] Failed to parse AI response:", content.slice(0, 500));
      throw new Error("AI returned invalid JSON");
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

  // Format days with events
  const daysFormatted = trip.days.map(day => {
    const eventList = day.events.map(e => `  - ${e.type}: ${e.title}${e.where ? ` at ${e.where}` : ""}`).join("\n");
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
