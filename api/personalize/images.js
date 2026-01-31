/**
 * Image Resolution via Unsplash API
 *
 * Fetches images based on AI-generated search queries.
 * Validates URLs and extracts color metadata.
 * Caches results in Azure Table Storage to avoid rate limits.
 */

const UNSPLASH_API = "https://api.unsplash.com";
const REQUEST_TIMEOUT = 10000; // 10 seconds per request
const CACHE_TTL_HOURS = 24; // Cache images for 24 hours
const logger = require("../shared/logger");
const { TABLES, getEntity, upsertEntity } = require("../shared/tableStorage");

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

// Track used image IDs to prevent duplicates
const usedImageIds = new Set();

/**
 * Generate cache key from query (normalize for consistency)
 */
function getCacheKey(query, orientation) {
  return `${query.toLowerCase().trim().replace(/\s+/g, "-")}_${orientation}`;
}

/**
 * Check cache for an image query
 */
async function checkCache(query, orientation) {
  const cacheKey = getCacheKey(query, orientation);
  try {
    const cached = await getEntity(TABLES.IMAGE_CACHE, "unsplash", cacheKey);
    if (cached) {
      // Check if cache is still valid
      const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
      const maxAge = CACHE_TTL_HOURS * 60 * 60 * 1000;
      if (cacheAge < maxAge) {
        return JSON.parse(cached.imageData);
      }
    }
  } catch (err) {
    // Cache miss or error, continue to API
  }
  return null;
}

/**
 * Store image in cache
 */
async function storeInCache(query, orientation, imageData) {
  const cacheKey = getCacheKey(query, orientation);
  try {
    await upsertEntity(TABLES.IMAGE_CACHE, {
      partitionKey: "unsplash",
      rowKey: cacheKey,
      query,
      orientation,
      imageData: JSON.stringify(imageData),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    // Cache write failure is non-fatal
    console.warn("[Images] Cache write failed:", err.message);
  }
}

/**
 * Search Unsplash for images (with caching and deduplication)
 */
async function searchUnsplash(query, options = {}) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn("[Images] Unsplash not configured, skipping image resolution");
    return null;
  }

  const {
    orientation = "landscape",
    perPage = 5,  // Fetch more to allow deduplication
    excludeIds = usedImageIds,
    skipCache = false
  } = options;

  // Check cache first (unless skipped)
  if (!skipCache) {
    const cached = await checkCache(query, orientation);
    if (cached) {
      await logger.info("unsplash", `Cache hit: ${query}`);
      usedImageIds.add(cached.id);
      return cached;
    }
  }

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
      const errorText = await response.text().catch(() => "");
      await logger.error("unsplash", `API error ${response.status}: ${errorText.slice(0, 200)}`, { query });
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
      await logger.warn("unsplash", `No results for: ${query}`, { total: data.total || 0 });
      return null;
    }

    // Find first unused image
    const photo = results.find(p => !excludeIds.has(p.id)) || results[0];

    // Track this image as used
    usedImageIds.add(photo.id);

    // Trigger download endpoint per Unsplash API guidelines
    const downloadLocation = photo.links?.download_location;
    if (downloadLocation) {
      triggerDownload(downloadLocation, accessKey).catch(() => {});
    }

    const imageData = {
      id: photo.id,
      url: validateImageUrl(photo.urls?.regular),
      thumb: validateImageUrl(photo.urls?.thumb),
      small: validateImageUrl(photo.urls?.small),
      credit: photo.user?.name || "Unknown",
      creditUrl: photo.user?.links?.html || null,
      color: photo.color || null,
      blurHash: photo.blur_hash || null,
      description: photo.description || photo.alt_description || null
    };

    // Store in cache for future use
    await storeInCache(query, orientation, imageData);
    await logger.info("unsplash", `Fetched & cached: ${query}`);

    return imageData;

  } catch (err) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      await logger.error("unsplash", `Timeout for: ${query}`);
    } else {
      await logger.error("unsplash", `Request failed: ${err.message}`, { query });
    }
    return null;
  }
}

/**
 * Reset used image tracking (call at start of personalization)
 */
function resetImageTracking() {
  usedImageIds.clear();
}

/**
 * Resolve images for all days and events in the narrative
 */
async function resolveImages(narrative) {
  if (!narrative || !narrative.days) {
    return { days: [], events: [] };
  }

  // Reset tracking at start of each personalization
  resetImageTracking();

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
    await sleep(150);

    const image = await searchUnsplash(day.bgQuery, {
      orientation: "landscape"
    });

    resolved.days.push({
      dayNum: day.dayNum,
      bgImage: image,
      nickname: day.nickname,
      bgMood: day.bgMood,
      colorAccent: day.colorAccent
    });
  }

  // Resolve event images based on card style
  const events = narrative.events || [];

  for (const event of events) {
    const cardStyle = event.cardStyle || "accent";
    const queries = event.cardQueries || (event.cardQuery ? [event.cardQuery] : []);

    // Skip minimal cards - no images needed
    if (cardStyle === "minimal" || queries.length === 0) {
      resolved.events.push({
        eventId: event.eventId,
        cardStyle: "minimal",
        images: []
      });
      continue;
    }

    await sleep(150);

    if (cardStyle === "carousel") {
      // Fetch multiple images for carousel
      const images = [];
      for (const query of queries.slice(0, 4)) {  // Max 4 images per carousel
        await sleep(100);
        const image = await searchUnsplash(query, { orientation: "landscape" });
        if (image) {
          images.push(image);
        }
      }

      resolved.events.push({
        eventId: event.eventId,
        cardStyle: "carousel",
        images: images
      });
    } else {
      // Single image for hero or accent
      const image = await searchUnsplash(queries[0], {
        orientation: "landscape"
      });

      resolved.events.push({
        eventId: event.eventId,
        cardStyle: cardStyle,
        images: image ? [image] : []
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
 * Trigger Unsplash download endpoint (API compliance)
 * This notifies Unsplash when an image is "used" in the app
 */
async function triggerDownload(downloadLocation, accessKey) {
  try {
    await fetch(downloadLocation, {
      headers: {
        Authorization: `Client-ID ${accessKey}`
      }
    });
    console.log("[Images] Download tracked for Unsplash");
  } catch (err) {
    console.warn("[Images] Failed to track download:", err.message);
  }
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
  validateImageUrl,
  resetImageTracking
};
