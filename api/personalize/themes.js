/**
 * Theme Generation via Claude AI
 *
 * Generates 3-4 theme options based on the resolved images
 * and their color palette. Picks a recommended theme.
 */

const { validateThemeOutput } = require("./sanitize");

const AI_TIMEOUT = 30000; // 30 seconds

const SYSTEM_PROMPT = `You are a visual designer creating color themes for a travel app.
You've been given the dominant colors extracted from travel photos selected for a specific trip.

## Your Task

Generate 3-4 theme options that:
1. Harmonize with the extracted image colors (don't fight them)
2. Feel distinct from each other (give real choice)
3. Match the trip's emotional journey
4. Work well for UI (readable text, accessible contrast)

## Theme Types to Consider

- **Warm/Golden**: Mediterranean, desert, sunset-heavy trips
- **Cool/Blue**: Coastal, island, winter trips
- **Earth/Natural**: Cultural immersion, historic sites
- **Vibrant/Saturated**: Festivals, markets, nightlife
- **Minimal/Clean**: Modern cities, architecture-focused
- **Romantic/Soft**: Honeymoons, couples trips

## Rules

- Primary color should relate to the trip's dominant image colors
- Ensure 4.5:1 contrast ratio for text on background
- Each theme needs: primary, secondary, accent, background, surface, text, textMuted
- Names should be evocative (2-3 words max)
- Descriptions should be one line, sensory language
- Mark ONE theme as "recommended: true" (best match for the images)

## Output Format

Return valid JSON array:
[
  {
    "id": "golden-antiquity",
    "name": "Golden Antiquity",
    "emoji": "☀️",
    "description": "Sun-warmed ruins and Mediterranean warmth",
    "recommended": true,
    "palette": {
      "primary": "#c9a227",
      "secondary": "#1e3a5f",
      "accent": "#8b9a6b",
      "background": "#f5f5f0",
      "surface": "#ffffff",
      "text": "#2c3e50",
      "textMuted": "#6b7280"
    },
    "headerGradient": ["#c9a227", "#f5af19"]
  }
]`;

/**
 * Generate theme options based on color analysis
 */
async function generateThemes(narrative, colorAnalysis, tripData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Return default themes if AI not configured
    return getDefaultThemes();
  }

  const userPrompt = buildThemePrompt(narrative, colorAnalysis, tripData);

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
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[Themes] AI API error:", response.status, error);
      return getDefaultThemes();
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      console.error("[Themes] AI returned empty response");
      return getDefaultThemes();
    }

    // Parse JSON from response
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1].trim();

    let themes;
    try {
      themes = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("[Themes] Failed to parse AI response:", content.slice(0, 500));
      return getDefaultThemes();
    }

    // Validate structure
    try {
      validateThemeOutput(themes);
    } catch (validErr) {
      console.error("[Themes] Validation failed:", validErr.message);
      return getDefaultThemes();
    }

    // Ensure one is marked recommended
    const hasRecommended = themes.some(t => t.recommended);
    if (!hasRecommended && themes.length > 0) {
      themes[0].recommended = true;
    }

    return themes;

  } catch (err) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      console.error("[Themes] AI request timed out");
    } else {
      console.error("[Themes] Error:", err.message);
    }

    return getDefaultThemes();
  }
}

/**
 * Build the user prompt for theme generation
 */
function buildThemePrompt(narrative, colorAnalysis, tripData) {
  const destinations = tripData.days
    .map(d => d.location)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");

  return `Generate themes for this trip:

**Trip:** ${tripData.name}
**Destinations:** ${destinations}
**Duration:** ${tripData.duration} days
**Narrative Theme:** ${narrative.narrativeArc?.theme || "A journey to remember"}

**Colors extracted from trip images:**
- Dominant colors: ${colorAnalysis.dominantColors?.join(", ") || "Not available"}
- Color temperature: ${colorAnalysis.colorTemperature || "neutral"}
- Brightness: ${colorAnalysis.brightness || "medium"}
- Saturation: ${colorAnalysis.saturation || "medium"}

**Day moods from narrative:**
${narrative.days?.slice(0, 5).map(d => `- Day ${d.dayNum}: ${d.bgMood || "neutral"}`).join("\n")}

Generate 3-4 theme options. Mark the best match as recommended. Output valid JSON array only.`;
}

/**
 * Default themes if AI fails
 */
function getDefaultThemes() {
  return [
    {
      id: "classic-journey",
      name: "Classic Journey",
      emoji: "🌍",
      description: "Timeless elegance for any adventure",
      recommended: true,
      palette: {
        primary: "#4a5568",
        secondary: "#2d3748",
        accent: "#ed8936",
        background: "#f7fafc",
        surface: "#ffffff",
        text: "#1a202c",
        textMuted: "#718096"
      },
      headerGradient: ["#4a5568", "#2d3748"]
    },
    {
      id: "golden-hour",
      name: "Golden Hour",
      emoji: "☀️",
      description: "Warm sunset tones and golden light",
      recommended: false,
      palette: {
        primary: "#c9a227",
        secondary: "#8b6914",
        accent: "#e67e22",
        background: "#fffbf0",
        surface: "#ffffff",
        text: "#2c2418",
        textMuted: "#8b7355"
      },
      headerGradient: ["#c9a227", "#f5af19"]
    },
    {
      id: "ocean-breeze",
      name: "Ocean Breeze",
      emoji: "🌊",
      description: "Cool blues and coastal calm",
      recommended: false,
      palette: {
        primary: "#3182ce",
        secondary: "#2c5282",
        accent: "#38b2ac",
        background: "#f0f9ff",
        surface: "#ffffff",
        text: "#1a365d",
        textMuted: "#4a6fa5"
      },
      headerGradient: ["#3182ce", "#2c5282"]
    },
    {
      id: "forest-path",
      name: "Forest Path",
      emoji: "🌿",
      description: "Earthy greens and natural textures",
      recommended: false,
      palette: {
        primary: "#38a169",
        secondary: "#276749",
        accent: "#9f7aea",
        background: "#f0fff4",
        surface: "#ffffff",
        text: "#22543d",
        textMuted: "#4a7c59"
      },
      headerGradient: ["#38a169", "#276749"]
    }
  ];
}

module.exports = {
  generateThemes,
  getDefaultThemes
};
