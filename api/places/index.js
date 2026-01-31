/**
 * Google Places Photos API
 *
 * Searches for a place and returns its photos.
 * Uses Google Places API (New) for search and photo retrieval.
 */

const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

const PLACES_API = "https://places.googleapis.com/v1/places";
const REQUEST_TIMEOUT = 10000;

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
  const location = req.query.location || null; // Optional: "Athens, Greece"
  const maxPhotos = Math.min(parseInt(req.query.count) || 6, 10);

  if (!query || query.trim().length < 2) {
    sendError(context, "Query parameter 'q' is required (min 2 characters)", 400, headers);
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    sendError(context, "Google Places not configured", 503, headers);
    return;
  }

  const searchQuery = location ? `${query.trim()} ${location}` : query.trim();
  context.log(`[Places] Searching for: "${searchQuery}"`);

  try {
    // Step 1: Text Search to find the place
    const searchResponse = await fetchWithTimeout(
      `${PLACES_API}:searchText`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.photos"
        },
        body: JSON.stringify({
          textQuery: searchQuery,
          maxResultCount: 1
        })
      },
      REQUEST_TIMEOUT
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text().catch(() => "");
      context.log.error(`[Places] Search API error ${searchResponse.status}: ${errorText.slice(0, 300)}`);
      sendError(context, "Place search failed", searchResponse.status === 429 ? 429 : 502, headers);
      return;
    }

    const searchData = await searchResponse.json();
    const place = searchData.places?.[0];

    if (!place) {
      context.log(`[Places] No results for: "${searchQuery}"`);
      sendSuccess(context, {
        query: searchQuery,
        place: null,
        photos: []
      }, 200, headers);
      return;
    }

    context.log(`[Places] Found: ${place.displayName?.text} (${place.id})`);

    // Step 2: Get photo URLs
    const photos = [];
    const photoRefs = place.photos?.slice(0, maxPhotos) || [];

    for (const photoRef of photoRefs) {
      if (photoRef.name) {
        // Construct photo URL using the Places Photo API
        // Format: https://places.googleapis.com/v1/{photo_name}/media?maxHeightPx=400&key=API_KEY
        const photoUrl = `https://places.googleapis.com/v1/${photoRef.name}/media?maxHeightPx=400&maxWidthPx=600&key=${apiKey}`;
        const thumbUrl = `https://places.googleapis.com/v1/${photoRef.name}/media?maxHeightPx=150&maxWidthPx=150&key=${apiKey}`;

        photos.push({
          id: photoRef.name,
          url: photoUrl,
          thumb: thumbUrl,
          width: photoRef.widthPx || null,
          height: photoRef.heightPx || null,
          attributions: photoRef.authorAttributions?.map(a => ({
            name: a.displayName,
            url: a.uri
          })) || []
        });
      }
    }

    context.log(`[Places] Found ${photos.length} photos for "${place.displayName?.text}"`);

    sendSuccess(context, {
      query: searchQuery,
      place: {
        id: place.id,
        name: place.displayName?.text || query,
        address: place.formattedAddress || null
      },
      photos
    }, 200, headers);

  } catch (err) {
    if (err.name === "AbortError") {
      context.log.error(`[Places] Timeout for: ${searchQuery}`);
      sendError(context, "Place search timed out", 504, headers);
    } else {
      context.log.error(`[Places] Error: ${err.message}`);
      sendError(context, "Place search failed: " + err.message, 500, headers);
    }
  }
};

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
