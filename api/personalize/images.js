/**
 * Image Resolution via Unsplash API
 *
 * Fetches images based on AI-generated search queries.
 * Validates URLs and extracts color metadata.
 */

const UNSPLASH_API = "https://api.unsplash.com";
const REQUEST_TIMEOUT = 10000; // 10 seconds per request

// Allowed image hosts (security)
const ALLOWED_HOSTS = [
  "images.unsplash.com",
  "plus.unsplash.com"
];

/**
 * Validate that a URL is from an allowed host
 */
function validateImageUrl(url) {
  if (!url || typeof url !== "string") return null;

  try {
    const parsed = new URL(url);

    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      console.warn("[Images] Rejected URL from invalid host:", parsed.hostname);
      return null;
    }

    if (parsed.protocol !== "https:") {
      console.warn("[Images] Rejected non-HTTPS URL");
      return null;
    }

    return url;
  } catch (e) {
    console.warn("[Images] Invalid URL:", url);
    return null;
  }
}

/**
 * Search Unsplash for images
 */
async function searchUnsplash(query, options = {}) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn("[Images] Unsplash not configured, skipping image resolution");
    return null;
  }

  const {
    orientation = "landscape",
    perPage = 1
  } = options;

  const params = new URLSearchParams({
    query,
    orientation,
    per_page: perPage.toString(),
    content_filter: "high"
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Images] Unsplash API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      console.log(`[Images] No results for query: "${query}"`);
      return null;
    }

    // Return first result
    const photo = results[0];

    return {
      url: validateImageUrl(photo.urls?.regular),
      thumb: validateImageUrl(photo.urls?.thumb),
      small: validateImageUrl(photo.urls?.small),
      credit: photo.user?.name || "Unknown",
      creditUrl: photo.user?.links?.html || null,
      color: photo.color || null,
      blurHash: photo.blur_hash || null,
      description: photo.description || photo.alt_description || null
    };

  } catch (err) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      console.warn("[Images] Unsplash request timed out for:", query);
    } else {
      console.warn("[Images] Unsplash request failed:", err.message);
    }
    return null;
  }
}

/**
 * Resolve images for all days and events in the narrative
 */
async function resolveImages(narrative) {
  if (!narrative || !narrative.days) {
    return { days: [], events: [] };
  }

  const resolved = {
    days: [],
    events: []
  };

  // Resolve day backgrounds (with rate limiting)
  for (const day of narrative.days) {
    if (!day.bgQuery) {
      resolved.days.push({
        dayNum: day.dayNum,
        bgImage: null
      });
      continue;
    }

    // Add small delay between requests to avoid rate limiting
    await sleep(100);

    const image = await searchUnsplash(day.bgQuery, {
      orientation: "landscape"
    });

    resolved.days.push({
      dayNum: day.dayNum,
      bgImage: image
    });
  }

  // Resolve event images (limit to avoid too many requests)
  const events = (narrative.events || []).slice(0, 10);

  for (const event of events) {
    if (!event.cardQuery) {
      continue;
    }

    await sleep(100);

    const image = await searchUnsplash(event.cardQuery, {
      orientation: "landscape"
    });

    if (image) {
      resolved.events.push({
        eventId: event.eventId,
        cardImage: image
      });
    }
  }

  return resolved;
}

/**
 * Analyze colors from resolved images
 */
function analyzeColors(resolvedImages) {
  const colors = [];

  // Collect colors from day backgrounds
  for (const day of (resolvedImages.days || [])) {
    if (day.bgImage?.color) {
      colors.push(day.bgImage.color);
    }
  }

  // Collect colors from event images
  for (const event of (resolvedImages.events || [])) {
    if (event.cardImage?.color) {
      colors.push(event.cardImage.color);
    }
  }

  if (colors.length === 0) {
    // Default colors if no images resolved
    return {
      dominantColors: ["#667eea", "#764ba2", "#f5f5f0", "#2c3e50"],
      colorTemperature: "neutral",
      brightness: "medium",
      saturation: "medium"
    };
  }

  // Analyze color characteristics
  const analysis = analyzeColorCharacteristics(colors);

  return {
    dominantColors: [...new Set(colors)].slice(0, 6),
    ...analysis
  };
}

/**
 * Analyze color characteristics (temperature, brightness, saturation)
 */
function analyzeColorCharacteristics(colors) {
  let warmCount = 0;
  let coolCount = 0;
  let totalBrightness = 0;
  let totalSaturation = 0;

  for (const color of colors) {
    const { h, s, l } = hexToHSL(color);

    // Warm colors: red, orange, yellow (0-60, 300-360)
    if (h <= 60 || h >= 300) {
      warmCount++;
    } else {
      coolCount++;
    }

    totalBrightness += l;
    totalSaturation += s;
  }

  const avgBrightness = totalBrightness / colors.length;
  const avgSaturation = totalSaturation / colors.length;

  return {
    colorTemperature: warmCount > coolCount ? "warm" : coolCount > warmCount ? "cool" : "neutral",
    brightness: avgBrightness > 60 ? "high" : avgBrightness > 40 ? "medium" : "low",
    saturation: avgSaturation > 60 ? "high" : avgSaturation > 30 ? "medium" : "low"
  };
}

/**
 * Convert hex color to HSL
 */
function hexToHSL(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse RGB
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  searchUnsplash,
  resolveImages,
  analyzeColors,
  validateImageUrl
};
