const { getEntity, TABLES } = require("./tableStorage");

// Standard CORS headers for all API responses
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

// Get CORS headers with optional method override
function getHeaders(methods) {
  if (methods) {
    return { ...corsHeaders, "Access-Control-Allow-Methods": methods };
  }
  return corsHeaders;
}

// Handle OPTIONS preflight request
function handleOptions(context, methods) {
  context.res = { status: 204, headers: getHeaders(methods) };
}

// Validate trip-level access (original pattern, for backward compatibility)
function validateTripAccess(req) {
  const tripId = req.body?.tripId || req.query?.tripId;
  const accessCode = req.body?.accessCode || req.query?.accessCode;

  if (!tripId) return { valid: false, error: "Missing tripId", status: 401 };
  if (!accessCode) return { valid: false, error: "Missing accessCode", status: 401 };

  const codesJson = process.env.TRIP_ACCESS_CODES || "{}";
  let codes;
  try {
    codes = JSON.parse(codesJson);
  } catch (e) {
    return { valid: false, error: "Server configuration error", status: 500 };
  }

  const expectedCode = codes[tripId];
  if (!expectedCode) return { valid: false, error: "Trip not found", status: 404 };
  if (accessCode.toLowerCase() !== expectedCode.toLowerCase()) {
    return { valid: false, error: "Invalid access code", status: 403 };
  }

  // Trip-level code = admin access
  return { valid: true, tripId, isAdmin: true, userId: "admin", travelerId: null };
}

// Validate traveler-specific access (new pattern for per-traveler codes)
// Traveler codes are stored in the Travelers table
async function validateTravelerAccess(req) {
  const tripId = req.body?.tripId || req.query?.tripId;
  const accessCode = req.body?.accessCode || req.query?.accessCode;

  if (!tripId) return { valid: false, error: "Missing tripId", status: 401 };
  if (!accessCode) return { valid: false, error: "Missing accessCode", status: 401 };

  // First check if trip exists using trip-level codes (backward compatible)
  const tripAuth = validateTripAccess(req);

  // If trip-level code matches, it's a valid admin/generic access
  if (tripAuth.valid) {
    return { valid: true, tripId, travelerId: null, isAdmin: true };
  }

  // Otherwise, try traveler-specific codes from database
  try {
    const travelers = await require("./tableStorage").queryByPartition(TABLES.TRAVELERS, tripId);

    for (const traveler of travelers) {
      if (traveler.accessCode && accessCode.toLowerCase() === traveler.accessCode.toLowerCase()) {
        return {
          valid: true,
          tripId,
          travelerId: traveler.rowKey,
          travelerName: traveler.name,
          isAdmin: false
        };
      }
    }

    // No matching code found
    if (tripAuth.error === "Trip not found") {
      return { valid: false, error: "Trip not found", status: 404 };
    }
    return { valid: false, error: "Invalid access code", status: 403 };

  } catch (err) {
    // If table doesn't exist yet, fall back to trip-level validation only
    if (err.statusCode === 404) {
      if (tripAuth.error === "Trip not found") {
        return { valid: false, error: "Trip not found", status: 404 };
      }
      return { valid: false, error: "Invalid access code", status: 403 };
    }
    return { valid: false, error: "Server error: " + err.message, status: 500 };
  }
}

// Send error response with appropriate status code
function sendError(context, error, status = 500, headers = corsHeaders) {
  context.res = {
    status,
    headers,
    body: { error }
  };
}

// Send success response
function sendSuccess(context, body, status = 200, headers = corsHeaders) {
  context.res = {
    status,
    headers,
    body
  };
}

// Middleware-style auth check that returns early if invalid
function requireAuth(context, req, options = {}) {
  const headers = getHeaders(options.methods);
  const auth = validateTripAccess(req);

  if (!auth.valid) {
    sendError(context, auth.error, auth.status, headers);
    return null;
  }

  return auth;
}

// Async version that supports traveler-specific codes
async function requireTravelerAuth(context, req, options = {}) {
  const headers = getHeaders(options.methods);
  const auth = await validateTravelerAccess(req);

  if (!auth.valid) {
    sendError(context, auth.error, auth.status, headers);
    return null;
  }

  return auth;
}

// Extract path parameters from URL (e.g., /api/trips/{tripId}/events/{eventId})
function getPathParams(req, pattern) {
  const url = req.url || "";
  const path = url.split("?")[0];
  const pathParts = path.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith("{") && patternParts[i].endsWith("}")) {
      const paramName = patternParts[i].slice(1, -1);
      params[paramName] = pathParts[i] || null;
    }
  }
  return params;
}

module.exports = {
  corsHeaders,
  getHeaders,
  handleOptions,
  validateTripAccess,
  validateTravelerAccess,
  sendError,
  sendSuccess,
  requireAuth,
  requireTravelerAuth,
  getPathParams
};
