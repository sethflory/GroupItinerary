/**
 * Input Sanitization for AI Personalization
 *
 * Prevents prompt injection and ensures data is safe to send to Claude.
 */

// Suspicious patterns that could indicate prompt injection
const SUSPICIOUS_PATTERNS = [
  /ignore.*instruction/i,
  /ignore.*previous/i,
  /disregard.*above/i,
  /system.*prompt/i,
  /\bprompt\b.*\binjection\b/i,
  /<\/?[a-z]+>/i,  // HTML tags
  /\{\{.*\}\}/,    // Template syntax
  /\$\{.*\}/       // JS template literals
];

/**
 * Sanitize a text string for AI input
 */
function sanitizeText(text, maxLength = 100) {
  if (!text || typeof text !== "string") return "";

  let clean = text
    .slice(0, maxLength)
    .replace(/[<>{}[\]]/g, "")  // Remove potential injection chars
    .replace(/\n+/g, " ")       // Collapse newlines
    .replace(/\s+/g, " ")       // Collapse whitespace
    .trim();

  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(clean)) {
      console.warn("[Sanitize] Suspicious pattern detected, filtering:", clean.slice(0, 50));
      clean = clean.replace(pattern, "[filtered]");
    }
  }

  return clean;
}

/**
 * Sanitize a date string
 */
function sanitizeDate(date) {
  if (!date || typeof date !== "string") return null;

  // Validate ISO date format
  const match = date.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * Sanitize event type
 */
const ALLOWED_EVENT_TYPES = ["flight", "activity", "meal", "hotel", "transport", "free", "meeting"];

function sanitizeEventType(type) {
  if (!type || typeof type !== "string") return "activity";
  const clean = type.toLowerCase().trim();
  return ALLOWED_EVENT_TYPES.includes(clean) ? clean : "activity";
}

/**
 * Sanitize full trip data for AI consumption
 */
function sanitizeTripForAI(tripData) {
  return {
    name: sanitizeText(tripData.name, 100),
    startDate: sanitizeDate(tripData.startDate),
    endDate: sanitizeDate(tripData.endDate),
    duration: tripData.days?.length || 0,

    travelers: (tripData.travelers || []).slice(0, 20).map(t => ({
      name: sanitizeText(t.name, 50),
      group: sanitizeText(t.group, 20)
    })),

    days: (tripData.days || []).slice(0, 30).map(day => ({
      dayNum: Math.min(Math.max(1, Number(day.dayNum) || 1), 100),
      date: sanitizeDate(day.date),
      location: sanitizeText(day.location, 50),
      theme: sanitizeText(day.theme, 100),
      destination: sanitizeText(day.destination, 30),
      events: (day.events || []).slice(0, 20).map(e => ({
        type: sanitizeEventType(e.type),
        title: sanitizeText(e.title, 100),
        where: sanitizeText(e.where, 50)
      }))
    })),

    destinations: Object.fromEntries(
      Object.entries(tripData.destinations || {}).slice(0, 10).map(([key, val]) => [
        sanitizeText(key, 30),
        {
          city: sanitizeText(val?.city, 50),
          country: sanitizeText(val?.country, 50)
        }
      ])
    )
  };
}

/**
 * Validate AI output structure
 */
function validateNarrativeOutput(output) {
  if (!output || typeof output !== "object") {
    throw new Error("Invalid narrative output: not an object");
  }

  if (!Array.isArray(output.days)) {
    throw new Error("Invalid narrative output: missing days array");
  }

  for (const day of output.days) {
    if (typeof day.dayNum !== "number") {
      throw new Error("Invalid day: missing dayNum");
    }

    if (typeof day.nickname !== "string" || day.nickname.length > 100) {
      throw new Error("Invalid day: nickname must be string under 100 chars");
    }

    // Check for HTML/scripts in nickname
    if (/<[^>]+>/.test(day.nickname)) {
      throw new Error("Invalid day: HTML detected in nickname");
    }

    if (typeof day.bgQuery !== "string" || day.bgQuery.length > 200) {
      throw new Error("Invalid day: bgQuery must be string under 200 chars");
    }
  }

  return true;
}

/**
 * Validate theme output structure
 */
function validateThemeOutput(themes) {
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new Error("Invalid themes: must be non-empty array");
  }

  for (const theme of themes) {
    if (!theme.id || typeof theme.id !== "string") {
      throw new Error("Invalid theme: missing id");
    }

    if (!theme.name || typeof theme.name !== "string") {
      throw new Error("Invalid theme: missing name");
    }

    if (!theme.palette || typeof theme.palette !== "object") {
      throw new Error("Invalid theme: missing palette");
    }

    // Validate color format
    const colorRegex = /^#[0-9a-fA-F]{6}$/;
    for (const [key, value] of Object.entries(theme.palette)) {
      if (!colorRegex.test(value)) {
        throw new Error(`Invalid theme: palette.${key} is not a valid hex color`);
      }
    }
  }

  return true;
}

module.exports = {
  sanitizeText,
  sanitizeDate,
  sanitizeEventType,
  sanitizeTripForAI,
  validateNarrativeOutput,
  validateThemeOutput
};
