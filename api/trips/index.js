const {
  TABLES,
  getEntity,
  queryByPartition,
  queryEntities,
  upsertEntity
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

module.exports = async function (context, req) {
  const headers = getHeaders("GET, PUT, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, PUT, OPTIONS");
    return;
  }

  // Extract path parameters
  const tripId = context.bindingData.tripId;
  const resource = context.bindingData.resource;
  const resourceId = context.bindingData.resourceId;

  // Validate access
  const auth = requireAuth(context, req, { methods: "GET, PUT, OPTIONS" });
  if (!auth) return;

  // Verify tripId matches auth
  if (tripId && tripId !== auth.tripId) {
    sendError(context, "Trip ID mismatch", 403, headers);
    return;
  }

  try {
    // Route handling
    if (!resource) {
      // GET /api/trips/{tripId} - Get trip details
      if (req.method === "GET") {
        return await getTripDetails(context, auth.tripId, headers);
      }
    } else if (resource === "travelers") {
      if (!resourceId) {
        // GET /api/trips/{tripId}/travelers - List all travelers
        if (req.method === "GET") {
          return await getTravelers(context, auth.tripId, headers);
        }
      } else {
        // PUT /api/trips/{tripId}/travelers/{travelerId} - Update traveler
        if (req.method === "PUT") {
          return await updateTraveler(context, auth.tripId, resourceId, req.body, headers);
        }
        // GET /api/trips/{tripId}/travelers/{travelerId} - Get single traveler
        if (req.method === "GET") {
          return await getTraveler(context, auth.tripId, resourceId, headers);
        }
      }
    } else if (resource === "days") {
      // GET /api/trips/{tripId}/days - List all days
      if (req.method === "GET") {
        return await getDays(context, auth.tripId, headers);
      }
    } else if (resource === "destinations") {
      // GET /api/trips/{tripId}/destinations - Get all destinations
      if (req.method === "GET") {
        return await getDestinations(context, headers);
      }
    } else if (resource === "hotels") {
      // GET /api/trips/{tripId}/hotels - Get hotels for trip
      if (req.method === "GET") {
        return await getHotels(context, auth.tripId, headers);
      }
    } else if (resource === "phases") {
      // GET /api/trips/{tripId}/phases - Get trip phases
      if (req.method === "GET") {
        return await getPhases(context, auth.tripId, headers);
      }
    } else if (resource === "full") {
      // GET /api/trips/{tripId}/full - Get complete trip data in one call
      if (req.method === "GET") {
        return await getFullTrip(context, auth.tripId, headers);
      }
    }

    sendError(context, "Not found", 404, headers);

  } catch (err) {
    console.error("Trips API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Get trip metadata
async function getTripDetails(context, tripId, headers) {
  const trip = await getEntity(TABLES.TRIPS, "trips", tripId);
  if (!trip) {
    sendError(context, "Trip not found", 404, headers);
    return;
  }

  sendSuccess(context, {
    id: trip.rowKey,
    name: trip.name,
    subtitle: trip.subtitle,
    dates: trip.dates,
    description: trip.description,
    icon: trip.icon,
    badge: trip.badge,
    photoPrefix: trip.photoPrefix || "",
    startDate: trip.startDate,
    endDate: trip.endDate
  }, 200, headers);
}

// Get all travelers for a trip
async function getTravelers(context, tripId, headers) {
  const entities = await queryByPartition(TABLES.TRAVELERS, tripId);

  const travelers = entities.map(e => ({
    id: e.rowKey,
    name: e.name,
    group: e.group,
    color: e.color,
    initials: e.initials,
    triviaScore: e.triviaScore || 0
  }));

  sendSuccess(context, { travelers }, 200, headers);
}

// Get single traveler
async function getTraveler(context, tripId, travelerId, headers) {
  const traveler = await getEntity(TABLES.TRAVELERS, tripId, travelerId);
  if (!traveler) {
    sendError(context, "Traveler not found", 404, headers);
    return;
  }

  sendSuccess(context, {
    id: traveler.rowKey,
    name: traveler.name,
    group: traveler.group,
    color: traveler.color,
    initials: traveler.initials,
    triviaScore: traveler.triviaScore || 0
  }, 200, headers);
}

// Update traveler
async function updateTraveler(context, tripId, travelerId, body, headers) {
  const existing = await getEntity(TABLES.TRAVELERS, tripId, travelerId);
  if (!existing) {
    sendError(context, "Traveler not found", 404, headers);
    return;
  }

  // Only allow updating certain fields
  const allowedFields = ["name", "color", "initials", "triviaScore"];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const updated = {
    partitionKey: tripId,
    rowKey: travelerId,
    ...existing,
    ...updates
  };

  await upsertEntity(TABLES.TRAVELERS, updated);

  sendSuccess(context, {
    id: updated.rowKey,
    name: updated.name,
    group: updated.group,
    color: updated.color,
    initials: updated.initials,
    triviaScore: updated.triviaScore || 0
  }, 200, headers);
}

// Get all days for a trip
async function getDays(context, tripId, headers) {
  const entities = await queryByPartition(TABLES.DAYS, tripId);

  // Sort by date
  const days = entities
    .map(e => ({
      date: e.rowKey,
      dayNum: e.dayNum,
      label: e.label,
      location: e.location,
      theme: e.theme,
      destination: e.destination,
      destinationInfo: e.destinationInfo || null,
      estimatedSteps: e.estimatedSteps || null
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  sendSuccess(context, { days }, 200, headers);
}

// Get all destinations (global reference data)
async function getDestinations(context, headers) {
  const entities = await queryByPartition(TABLES.DESTINATIONS, "destinations");

  const destinations = {};
  for (const e of entities) {
    destinations[e.rowKey] = {
      name: e.name,
      city: e.city,
      country: e.country,
      timezone: e.timezone,
      utcOffset: e.utcOffset,
      info: e.info || null,
      localTip: e.localTip || null,
      lounge: e.lounge || null,
      loungeB: e.loungeB || null,
      loungeC: e.loungeC || null,
      lat: e.lat || null,
      lon: e.lon || null
    };
  }

  sendSuccess(context, { destinations }, 200, headers);
}

// Get hotels for a trip
async function getHotels(context, tripId, headers) {
  const entities = await queryByPartition(TABLES.HOTELS, tripId);

  const hotels = entities.map(e => ({
    id: e.rowKey,
    name: e.name,
    address: e.address,
    neighborhood: e.neighborhood,
    website: e.website,
    mapsLink: e.mapsLink,
    checkIn: e.checkIn,
    checkOut: e.checkOut,
    nights: e.nights,
    highlights: e.highlights
  }));

  // Return single hotel for backward compatibility, or array
  const hotel = hotels.length === 1 ? hotels[0] : null;

  sendSuccess(context, { hotel, hotels }, 200, headers);
}

// Get trip phases
async function getPhases(context, tripId, headers) {
  const trip = await getEntity(TABLES.TRIPS, "trips", tripId);
  if (!trip || !trip.phases) {
    sendError(context, "Phases not found", 404, headers);
    return;
  }

  // Phases are stored as JSON string in trip entity
  const phases = typeof trip.phases === "string" ? JSON.parse(trip.phases) : trip.phases;

  sendSuccess(context, { phases }, 200, headers);
}

// Get complete trip data in one call (for initial load)
async function getFullTrip(context, tripId, headers) {
  // Fetch all data in parallel (including events)
  const [tripEntity, travelers, days, destinations, hotels, events] = await Promise.all([
    getEntity(TABLES.TRIPS, "trips", tripId),
    queryByPartition(TABLES.TRAVELERS, tripId),
    queryByPartition(TABLES.DAYS, tripId),
    queryByPartition(TABLES.DESTINATIONS, "destinations"),
    queryByPartition(TABLES.HOTELS, tripId),
    queryEntities(TABLES.EVENTS, `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`)
  ]);

  if (!tripEntity) {
    sendError(context, "Trip not found", 404, headers);
    return;
  }

  // Group events by date
  const eventsByDate = {};
  for (const e of events) {
    const date = e.date || e.partitionKey.split("_")[1];
    if (!eventsByDate[date]) {
      eventsByDate[date] = [];
    }
    // Parse JSON fields
    let travelers = ["all"];
    let badges = [];
    let hoverImage = null;
    try {
      if (e.travelers) travelers = typeof e.travelers === "string" ? JSON.parse(e.travelers) : e.travelers;
      if (e.badges) badges = typeof e.badges === "string" ? JSON.parse(e.badges) : e.badges;
      if (e.hoverImage) hoverImage = typeof e.hoverImage === "string" ? JSON.parse(e.hoverImage) : e.hoverImage;
    } catch (err) {}

    eventsByDate[date].push({
      id: e.id || e.rowKey,
      time: e.time,
      endTime: e.endTime || null,
      type: e.type,
      title: e.title,
      subtitle: e.subtitle || null,
      travelers,
      status: e.status || "confirmed",
      where: e.where || null,
      details: e.details || null,
      badges,
      flightCode: e.flightCode || null,
      airline: e.airline || null,
      from: e.from || null,
      to: e.to || null,
      miles: e.miles || null,
      mapsLink: e.mapsLink || null,
      venueLink: e.venueLink || null,
      address: e.address || null,
      carousel: e.carousel || null,
      walkingSteps: e.walkingSteps || null,
      travelTime: e.travelTime || null,
      travelNote: e.travelNote || null,
      hoverImage,
      isUserGenerated: e.isUserGenerated || false
    });
  }

  // Sort events by time within each day
  for (const date of Object.keys(eventsByDate)) {
    eventsByDate[date].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }

  // Format trip
  const trip = {
    id: tripEntity.rowKey,
    name: tripEntity.name,
    subtitle: tripEntity.subtitle,
    dates: tripEntity.dates,
    description: tripEntity.description,
    icon: tripEntity.icon,
    badge: tripEntity.badge,
    photoPrefix: tripEntity.photoPrefix || "",
    startDate: tripEntity.startDate,
    endDate: tripEntity.endDate
  };

  // Format travelers
  const formattedTravelers = travelers.map(e => ({
    id: e.rowKey,
    name: e.name,
    group: e.group,
    color: e.color,
    initials: e.initials,
    triviaScore: e.triviaScore || 0
  }));

  // Format days (sorted) WITH EVENTS
  const formattedDays = days
    .map(e => ({
      date: e.rowKey,
      dayNum: e.dayNum,
      label: e.label,
      location: e.location,
      theme: e.theme,
      destination: e.destination,
      destinationInfo: e.destinationInfo || null,
      estimatedSteps: e.estimatedSteps || null,
      events: eventsByDate[e.rowKey] || []
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Format destinations as object
  const formattedDestinations = {};
  for (const e of destinations) {
    formattedDestinations[e.rowKey] = {
      name: e.name,
      city: e.city,
      country: e.country,
      timezone: e.timezone,
      utcOffset: e.utcOffset,
      info: e.info || null,
      localTip: e.localTip || null,
      lounge: e.lounge || null,
      lat: e.lat || null,
      lon: e.lon || null
    };
  }

  // Format hotel (single for backward compat)
  const hotel = hotels.length > 0 ? {
    id: hotels[0].rowKey,
    name: hotels[0].name,
    address: hotels[0].address,
    neighborhood: hotels[0].neighborhood,
    website: hotels[0].website,
    mapsLink: hotels[0].mapsLink,
    checkIn: hotels[0].checkIn,
    checkOut: hotels[0].checkOut,
    nights: hotels[0].nights,
    highlights: hotels[0].highlights
  } : null;

  // Phases from trip entity
  const phases = tripEntity.phases
    ? (typeof tripEntity.phases === "string" ? JSON.parse(tripEntity.phases) : tripEntity.phases)
    : {};

  // Carousels from trip entity (optional, may be large)
  const carousels = tripEntity.carousels
    ? (typeof tripEntity.carousels === "string" ? JSON.parse(tripEntity.carousels) : tripEntity.carousels)
    : {};

  sendSuccess(context, {
    trip,
    travelers: formattedTravelers,
    days: formattedDays,
    destinations: formattedDestinations,
    hotel,
    phases,
    carousels
  }, 200, headers);
}
