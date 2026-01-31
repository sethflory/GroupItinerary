const {
  TABLES,
  getEntity,
  queryByPartition,
  upsertEntity
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

module.exports = async function (context, req) {
  const headers = getHeaders("GET, PUT, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, PUT, OPTIONS");
    return;
  }

  const tripId = context.bindingData.tripId;
  const travelerId = context.bindingData.travelerId;

  const auth = await requireTravelerAuth(context, req, { methods: "GET, PUT, OPTIONS" });
  if (!auth) return;

  if (tripId !== auth.tripId) {
    sendError(context, "Trip ID mismatch", 403, headers);
    return;
  }

  try {
    if (req.method === "GET") {
      if (travelerId) {
        // GET /api/trips/{tripId}/locations/{travelerId} - Get single traveler location
        return await getTravelerLocation(context, tripId, travelerId, headers);
      } else {
        // GET /api/trips/{tripId}/locations - Get all traveler locations
        return await getAllLocations(context, tripId, headers);
      }
    } else if (req.method === "PUT") {
      if (!travelerId) {
        sendError(context, "Traveler ID required for update", 400, headers);
        return;
      }
      // PUT /api/trips/{tripId}/locations/{travelerId} - Update location
      return await updateLocation(context, tripId, travelerId, req.body, headers);
    }

    sendError(context, "Method not allowed", 405, headers);

  } catch (err) {
    console.error("Locations API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Get all traveler locations
async function getAllLocations(context, tripId, headers) {
  const entities = await queryByPartition(TABLES.TRAVELER_LOCATIONS, tripId);

  const locations = entities.map(formatLocation);

  // Filter out stale locations (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const recentLocations = locations.filter(loc =>
    new Date(loc.updatedAt).getTime() > oneHourAgo
  );

  sendSuccess(context, {
    locations: recentLocations,
    count: recentLocations.length
  }, 200, headers);
}

// Get single traveler location
async function getTravelerLocation(context, tripId, travelerId, headers) {
  const rowKey = `loc_${travelerId}`;
  const entity = await getEntity(TABLES.TRAVELER_LOCATIONS, tripId, rowKey);

  if (!entity) {
    sendSuccess(context, { location: null }, 200, headers);
    return;
  }

  sendSuccess(context, { location: formatLocation(entity) }, 200, headers);
}

// Update traveler location
async function updateLocation(context, tripId, travelerId, body, headers) {
  const { lat, lon, accuracy, label, isSharing } = body;

  // Validate coordinates if provided
  if (lat !== undefined || lon !== undefined) {
    if (typeof lat !== "number" || typeof lon !== "number") {
      sendError(context, "lat and lon must be numbers", 400, headers);
      return;
    }
    if (lat < -90 || lat > 90) {
      sendError(context, "lat must be between -90 and 90", 400, headers);
      return;
    }
    if (lon < -180 || lon > 180) {
      sendError(context, "lon must be between -180 and 180", 400, headers);
      return;
    }
  }

  const rowKey = `loc_${travelerId}`;

  // Get existing or create new
  let entity = await getEntity(TABLES.TRAVELER_LOCATIONS, tripId, rowKey);

  if (!entity) {
    entity = {
      partitionKey: tripId,
      rowKey,
      travelerId,
      lat: null,
      lon: null,
      accuracy: null,
      label: null,
      isSharing: true,
      createdAt: new Date().toISOString()
    };
  }

  // Update fields
  if (lat !== undefined) entity.lat = lat;
  if (lon !== undefined) entity.lon = lon;
  if (accuracy !== undefined) entity.accuracy = accuracy;
  if (label !== undefined) entity.label = label;
  if (isSharing !== undefined) entity.isSharing = isSharing;
  entity.updatedAt = new Date().toISOString();

  await upsertEntity(TABLES.TRAVELER_LOCATIONS, entity);

  sendSuccess(context, { location: formatLocation(entity) }, 200, headers);
}

// Format location entity for API response
function formatLocation(entity) {
  return {
    travelerId: entity.travelerId || entity.rowKey.replace("loc_", ""),
    lat: entity.lat,
    lon: entity.lon,
    accuracy: entity.accuracy,
    label: entity.label,
    isSharing: entity.isSharing !== false,
    updatedAt: entity.updatedAt || entity.createdAt
  };
}
