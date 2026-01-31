/**
 * Image Search API
 *
 * Searches Unsplash for images based on a query string.
 * Returns multiple results for the user to choose from.
 */

const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

const UNSPLASH_API = "https://api.unsplash.com";
const REQUEST_TIMEOUT = 10000;

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
      return null;
    }
    if (parsed.protocol !== "https:") {
      return null;
    }
    return url;
  } catch (e) {
    return null;
  }
}

module.exports = async function (context, req) {
  const headers = getHeaders("GET, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, OPTIONS");
    return;
  }

  // Validate access
  const auth = await requireTravelerAuth(context, req, { methods: "GET, OPTIONS" });
  if (!auth) return;

  const query = req.query.q || req.query.query;
  const orientation = req.query.orientation || "landscape";
  const perPage = Math.min(parseInt(req.query.count) || 8, 20);

  if (!query || query.trim().length < 2) {
    sendError(context, "Query parameter 'q' is required (min 2 characters)", 400, headers);
    return;
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    sendError(context, "Image search not configured", 503, headers);
    return;
  }

  context.log(`[Images] Searching for: "${query}" (${perPage} results)`);

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      orientation,
      per_page: perPage.toString(),
      content_filter: "high"
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      context.log.error(`[Images] Unsplash API error ${response.status}: ${errorText.slice(0, 200)}`);
      sendError(context, "Image search failed", response.status === 429 ? 429 : 502, headers);
      return;
    }

    const data = await response.json();
    const results = data.results || [];

    // Transform results to our format
    const images = results.map(photo => ({
      id: photo.id,
      url: validateImageUrl(photo.urls?.regular),
      thumb: validateImageUrl(photo.urls?.thumb),
      small: validateImageUrl(photo.urls?.small),
      credit: photo.user?.name || "Unknown",
      creditUrl: photo.user?.links?.html || null,
      color: photo.color || null,
      description: photo.description || photo.alt_description || null,
      downloadLocation: photo.links?.download_location || null
    })).filter(img => img.url); // Only return images with valid URLs

    context.log(`[Images] Found ${images.length} images for "${query}"`);

    sendSuccess(context, {
      query: query.trim(),
      total: data.total || 0,
      images
    }, 200, headers);

  } catch (err) {
    if (err.name === "AbortError") {
      context.log.error(`[Images] Timeout for: ${query}`);
      sendError(context, "Image search timed out", 504, headers);
    } else {
      context.log.error(`[Images] Error: ${err.message}`);
      sendError(context, "Image search failed: " + err.message, 500, headers);
    }
  }
};
