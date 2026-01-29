/**
 * Shared trip access validation helper
 * Validates tripId + accessCode against TRIP_ACCESS_CODES environment variable
 *
 * TRIP_ACCESS_CODES format: {"tripId1":"code1","tripId2":"code2"}
 */

/**
 * Validates that the provided tripId and accessCode match the server-side configuration
 * @param {string} tripId - The trip identifier
 * @param {string} accessCode - The access code provided by the user
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
function validateTripAccess(tripId, accessCode) {
  // Parse trip codes from environment variable
  const codesJson = process.env.TRIP_ACCESS_CODES || '{}';

  let codes;
  try {
    codes = JSON.parse(codesJson);
  } catch (e) {
    console.error('Failed to parse TRIP_ACCESS_CODES:', e.message);
    return { valid: false, error: 'Server configuration error' };
  }

  // Check if trip exists
  const expectedCode = codes[tripId];
  if (!expectedCode) {
    return { valid: false, error: 'Trip not found' };
  }

  // Validate access code (case-insensitive)
  if (!accessCode || accessCode.toLowerCase() !== expectedCode.toLowerCase()) {
    return { valid: false, error: 'Invalid access code' };
  }

  return { valid: true };
}

/**
 * Express/Azure Functions middleware-style helper to validate request
 * @param {object} req - The HTTP request object
 * @returns {{ valid: boolean, tripId?: string, accessCode?: string, error?: string }}
 */
function validateRequest(req) {
  // Get tripId and accessCode from body (POST) or query params (GET)
  const tripId = req.body?.tripId || req.query?.tripId;
  const accessCode = req.body?.accessCode || req.query?.accessCode;

  if (!tripId) {
    return { valid: false, error: 'Missing tripId' };
  }

  if (!accessCode) {
    return { valid: false, error: 'Missing accessCode' };
  }

  const result = validateTripAccess(tripId, accessCode);
  if (result.valid) {
    return { valid: true, tripId, accessCode };
  }

  return result;
}

module.exports = {
  validateTripAccess,
  validateRequest
};
