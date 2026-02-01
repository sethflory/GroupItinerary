const {
  TABLES,
  getEntity,
  queryByPartition,
  queryEntities,
  upsertEntity,
  deleteEntity,
  generateRowKey
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

module.exports = async function (context, req) {
  const headers = getHeaders("GET, POST, PUT, DELETE, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, POST, PUT, DELETE, OPTIONS");
    return;
  }

  // Extract path parameters
  const tripId = context.bindingData.tripId;
  const resource = context.bindingData.resource;
  const resourceId = context.bindingData.resourceId;
  const subAction = context.bindingData.subAction;

  // Validate access (supports both trip-level and traveler-specific codes)
  const auth = await requireTravelerAuth(context, req, { methods: "GET, POST, PUT, DELETE, OPTIONS" });
  if (!auth) return;

  // Verify tripId matches auth
  if (tripId && tripId !== auth.tripId) {
    sendError(context, "Trip ID mismatch", 403, headers);
    return;
  }

  try {
    console.log("[Trips] Route handling - resource:", resource, "resourceId:", resourceId);

    // Route handling
    // Forward trivia requests to trivia handler (route overlap workaround)
    if (resource === "trivia") {
      console.log("[Trips] Forwarding to trivia handler, action:", resourceId);
      try {
        const triviaHandler = require("../trivia/index.js");
        // Set up bindingData for trivia handler
        context.bindingData.action = resourceId;
        return await triviaHandler(context, req);
      } catch (triviaErr) {
        console.error("[Trips] Error forwarding to trivia:", triviaErr);
        sendError(context, "Trivia handler error: " + triviaErr.message, 500, headers);
        return;
      }
    }

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
        // POST /api/trips/{tripId}/travelers - Create new traveler
        if (req.method === "POST") {
          return await createTraveler(context, auth.tripId, req.body, headers);
        }
      } else if (subAction === "code") {
        // PUT /api/trips/{tripId}/travelers/{travelerId}/code - Regenerate access code
        if (req.method === "PUT") {
          return await regenerateAccessCode(context, auth.tripId, resourceId, headers);
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
        // DELETE /api/trips/{tripId}/travelers/{travelerId} - Delete traveler
        if (req.method === "DELETE") {
          return await deleteTraveler(context, auth.tripId, resourceId, headers);
        }
      }
    } else if (resource === "days") {
      // GET /api/trips/{tripId}/days - List all days
      if (req.method === "GET" && !resourceId) {
        return await getDays(context, auth.tripId, headers);
      }
      // POST /api/trips/{tripId}/days/sync - Sync days from events (create missing days)
      if (req.method === "POST" && resourceId === "sync") {
        return await syncDaysFromEvents(context, auth.tripId, headers);
      }
      // PUT /api/trips/{tripId}/days/{dayId} - Update day (for backgroundImage, theme, etc.)
      if (req.method === "PUT" && resourceId) {
        return await updateDay(context, auth.tripId, resourceId, req.body, headers);
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

// Get all travelers for a trip (includes access codes for admin view)
async function getTravelers(context, tripId, headers, includeAccessCodes = true) {
  const entities = await queryByPartition(TABLES.TRAVELERS, tripId);

  const travelers = entities.map(e => ({
    id: e.rowKey,
    name: e.name,
    group: e.group,
    color: e.color,
    initials: e.initials,
    triviaScore: e.triviaScore || 0,
    // Include access codes for Trip Setup management
    accessCode: includeAccessCodes ? (e.accessCode || null) : undefined
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
  const allowedFields = ["name", "group", "color", "initials", "triviaScore"];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  // Exclude Azure metadata fields that can't be written
  const { etag, timestamp, ...existingData } = existing;

  const updated = {
    partitionKey: tripId,
    rowKey: travelerId,
    ...existingData,
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
    .map(e => {
      // Parse backgroundImage if stored as JSON string
      let backgroundImage = null;
      try {
        if (e.backgroundImage) {
          backgroundImage = typeof e.backgroundImage === "string" ? JSON.parse(e.backgroundImage) : e.backgroundImage;
        }
      } catch (err) {}

      return {
        date: e.rowKey,
        dayNum: e.dayNum,
        label: e.label,
        location: e.location,
        theme: e.theme,
        destination: e.destination,
        destinationInfo: e.destinationInfo || null,
        estimatedSteps: e.estimatedSteps || null,
        backgroundImage
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  sendSuccess(context, { days }, 200, headers);
}

// Sync days from events - creates days for all event dates and fills gaps
async function syncDaysFromEvents(context, tripId, headers) {
  // Get all events for trip
  const events = await queryEntities(
    TABLES.EVENTS,
    `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
  );

  if (events.length === 0) {
    sendSuccess(context, {
      success: true,
      message: "No events found",
      daysCreated: 0
    }, 200, headers);
    return;
  }

  // Get existing days
  const existingDays = await queryByPartition(TABLES.DAYS, tripId);
  const existingDates = new Set(existingDays.map(d => d.date || d.rowKey.replace('day_', '')));

  // Get all unique dates from events and find date range
  const eventDates = [...new Set(events.map(e => {
    // Extract date from partition key (format: tripId_date)
    const parts = e.partitionKey.split('_');
    return parts[parts.length - 1];
  }))].filter(d => d && d.match(/^\d{4}-\d{2}-\d{2}$/)).sort();

  if (eventDates.length === 0) {
    sendSuccess(context, {
      success: true,
      message: "No valid event dates found",
      daysCreated: 0
    }, 200, headers);
    return;
  }

  const minDate = new Date(eventDates[0] + 'T12:00:00Z');
  const maxDate = new Date(eventDates[eventDates.length - 1] + 'T12:00:00Z');

  // Create days for all dates in range
  let daysCreated = 0;
  let dayNumber = existingDays.length;
  const currentDate = new Date(minDate);

  while (currentDate <= maxDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    if (!existingDates.has(dateStr)) {
      dayNumber++;

      // Parse date for label
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayOfWeek = dayNames[currentDate.getUTCDay()];
      const month = monthNames[currentDate.getUTCMonth()];
      const dayOfMonth = currentDate.getUTCDate();

      // Find event on this date to get location
      const eventOnDate = events.find(e => e.partitionKey.endsWith('_' + dateStr));
      const location = eventOnDate?.to || eventOnDate?.from || eventOnDate?.location || null;

      const day = {
        partitionKey: tripId,
        rowKey: `day_${dateStr}`,
        date: dateStr,
        dayNum: dayNumber,
        label: `${dayOfWeek}, ${month} ${dayOfMonth}`,
        location,
        destination: location,
        theme: `Day ${dayNumber}`,
        createdAt: new Date().toISOString()
      };

      await upsertEntity(TABLES.DAYS, day);
      daysCreated++;
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Renumber all days by date order
  const allDays = await queryByPartition(TABLES.DAYS, tripId);
  allDays.sort((a, b) => {
    const dateA = a.date || a.rowKey.replace('day_', '');
    const dateB = b.date || b.rowKey.replace('day_', '');
    return dateA.localeCompare(dateB);
  });

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < allDays.length; i++) {
    const day = allDays[i];
    const dayDate = day.date || day.rowKey.replace('day_', '');
    const dateObj = new Date(dayDate + 'T12:00:00Z');

    day.dayNum = i + 1;
    day.date = dayDate;
    day.label = `${dayNames[dateObj.getUTCDay()]}, ${monthNames[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}`;

    // Only update theme if it's a generic "Day N" theme
    if (!day.theme || day.theme.startsWith('Day ')) {
      day.theme = `Day ${i + 1}`;
    }

    await upsertEntity(TABLES.DAYS, day);
  }

  console.log(`[Trips] Synced days for ${tripId}: created ${daysCreated} days, renumbered ${allDays.length} total`);

  sendSuccess(context, {
    success: true,
    message: `Created ${daysCreated} days`,
    daysCreated,
    totalDays: allDays.length,
    dateRange: { from: eventDates[0], to: eventDates[eventDates.length - 1] }
  }, 200, headers);
}

// Update a single day (for backgroundImage, theme, etc.)
async function updateDay(context, tripId, dayId, body, headers) {
  // dayId can be a date (2026-02-01) or rowKey (day_2026-02-01)
  const rowKey = dayId.startsWith('day_') ? dayId : `day_${dayId}`;

  const existing = await getEntity(TABLES.DAYS, tripId, rowKey);
  if (!existing) {
    sendError(context, "Day not found", 404, headers);
    return;
  }

  // Exclude Azure metadata fields that can't be written
  const { etag, timestamp, ...existingData } = existing;

  // Build updated entity - only allow specific fields to be updated
  const updated = {
    ...existingData,
    partitionKey: tripId,
    rowKey: rowKey
  };

  // Update allowed fields
  if (body.theme !== undefined) {
    updated.theme = body.theme;
  }
  if (body.location !== undefined) {
    updated.location = body.location;
  }
  if (body.destination !== undefined) {
    updated.destination = body.destination;
  }
  if (body.destinationInfo !== undefined) {
    updated.destinationInfo = body.destinationInfo;
  }
  if (body.backgroundImage !== undefined) {
    // backgroundImage can be null to clear, or an object with url/thumb/credit/creditUrl
    updated.backgroundImage = body.backgroundImage ? JSON.stringify(body.backgroundImage) : null;
  }

  updated.updatedAt = new Date().toISOString();

  await upsertEntity(TABLES.DAYS, updated);

  // Parse backgroundImage for response
  let backgroundImage = null;
  try {
    if (updated.backgroundImage) {
      backgroundImage = typeof updated.backgroundImage === "string" ? JSON.parse(updated.backgroundImage) : updated.backgroundImage;
    }
  } catch (err) {}

  sendSuccess(context, {
    date: updated.date || rowKey.replace('day_', ''),
    dayNum: updated.dayNum,
    label: updated.label,
    location: updated.location,
    theme: updated.theme,
    destination: updated.destination,
    destinationInfo: updated.destinationInfo || null,
    estimatedSteps: updated.estimatedSteps || null,
    backgroundImage
  }, 200, headers);
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
    let linkedPhotos = [];
    try {
      if (e.travelers) travelers = typeof e.travelers === "string" ? JSON.parse(e.travelers) : e.travelers;
      if (e.badges) badges = typeof e.badges === "string" ? JSON.parse(e.badges) : e.badges;
      if (e.hoverImage) hoverImage = typeof e.hoverImage === "string" ? JSON.parse(e.hoverImage) : e.hoverImage;
      if (e.linkedPhotos) linkedPhotos = typeof e.linkedPhotos === "string" ? JSON.parse(e.linkedPhotos) : e.linkedPhotos;
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
      isUserGenerated: e.isUserGenerated || false,
      linkedPhotos,
      cardStyle: e.cardStyle || null
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
    .map(e => {
      // Extract date from rowKey (day_2026-02-01 -> 2026-02-01) or use stored date
      const dayDate = e.date || e.rowKey.replace('day_', '');

      // Parse backgroundImage if stored as JSON string
      let backgroundImage = null;
      try {
        if (e.backgroundImage) {
          backgroundImage = typeof e.backgroundImage === "string" ? JSON.parse(e.backgroundImage) : e.backgroundImage;
        }
      } catch (err) {}

      return {
        date: dayDate,
        dayNum: e.dayNum,
        label: e.label,
        location: e.location,
        theme: e.theme,
        destination: e.destination,
        destinationInfo: e.destinationInfo || null,
        estimatedSteps: e.estimatedSteps || null,
        backgroundImage,
        events: eventsByDate[dayDate] || []
      };
    })
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

  // Personalization (AI-generated themes, backgrounds, event cards)
  const personalization = tripEntity.personalization
    ? (typeof tripEntity.personalization === "string" ? JSON.parse(tripEntity.personalization) : tripEntity.personalization)
    : null;

  sendSuccess(context, {
    trip,
    travelers: formattedTravelers,
    days: formattedDays,
    destinations: formattedDestinations,
    hotel,
    phases,
    carousels,
    personalization
  }, 200, headers);
}

// Create a new traveler
async function createTraveler(context, tripId, body, headers) {
  const { name, group, color } = body || {};

  if (!name || name.trim().length < 1) {
    sendError(context, "Name is required", 400, headers);
    return;
  }

  // Generate initials from name
  const nameParts = name.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : name.trim().substring(0, 2).toUpperCase();

  // Generate a unique traveler ID
  const travelerId = name.toLowerCase().replace(/[^a-z0-9]/g, "") + "_" + Date.now().toString(36);

  // Generate access code: name + year or random
  const accessCode = generateAccessCode(name);

  const traveler = {
    partitionKey: tripId,
    rowKey: travelerId,
    name: name.trim(),
    group: group || "guest",
    color: color || getDefaultColor(),
    initials,
    accessCode,
    triviaScore: 0,
    createdAt: new Date().toISOString()
  };

  await upsertEntity(TABLES.TRAVELERS, traveler);

  sendSuccess(context, {
    id: traveler.rowKey,
    name: traveler.name,
    group: traveler.group,
    color: traveler.color,
    initials: traveler.initials,
    accessCode: traveler.accessCode,
    triviaScore: 0
  }, 201, headers);
}

// Delete a traveler
async function deleteTraveler(context, tripId, travelerId, headers) {
  // Check if traveler exists
  const existing = await getEntity(TABLES.TRAVELERS, tripId, travelerId);
  if (!existing) {
    sendError(context, "Traveler not found", 404, headers);
    return;
  }

  // Check if this is the last traveler
  const allTravelers = await queryByPartition(TABLES.TRAVELERS, tripId);
  if (allTravelers.length <= 1) {
    sendError(context, "Cannot delete the last traveler", 400, headers);
    return;
  }

  // Delete from Travelers table
  await deleteEntity(TABLES.TRAVELERS, tripId, travelerId);

  // Also try to delete from TripMembers if exists (new identity system)
  try {
    const members = await queryByPartition(TABLES.TRIP_MEMBERS, tripId);
    const memberToDelete = members.find(m =>
      m.legacyTravelerId === travelerId || m.rowKey === `member_${travelerId}`
    );
    if (memberToDelete) {
      await deleteEntity(TABLES.TRIP_MEMBERS, tripId, memberToDelete.rowKey);
    }
  } catch (err) {
    // Ignore errors from TripMembers cleanup
    console.log("TripMembers cleanup skipped:", err.message);
  }

  sendSuccess(context, { success: true, deleted: travelerId }, 200, headers);
}

// Regenerate access code for a traveler
async function regenerateAccessCode(context, tripId, travelerId, headers) {
  const existing = await getEntity(TABLES.TRAVELERS, tripId, travelerId);
  if (!existing) {
    sendError(context, "Traveler not found", 404, headers);
    return;
  }

  // Generate new access code
  const newCode = generateAccessCode(existing.name);

  // Exclude Azure metadata fields that can't be written
  const { etag, timestamp, ...existingData } = existing;

  const updated = {
    ...existingData,
    partitionKey: tripId,
    rowKey: travelerId,
    accessCode: newCode,
    codeUpdatedAt: new Date().toISOString()
  };

  console.log("[Trips] Regenerating code for", travelerId, "new code:", newCode);
  await upsertEntity(TABLES.TRAVELERS, updated);

  // Also update TripMembers if exists
  try {
    const members = await queryByPartition(TABLES.TRIP_MEMBERS, tripId);
    const memberToUpdate = members.find(m =>
      m.legacyTravelerId === travelerId || m.rowKey === `member_${travelerId}`
    );
    if (memberToUpdate) {
      const { etag: mEtag, timestamp: mTimestamp, ...memberData } = memberToUpdate;
      const updatedMember = {
        ...memberData,
        tripCode: newCode
      };
      await upsertEntity(TABLES.TRIP_MEMBERS, updatedMember);
      console.log("[Trips] Also updated TripMembers tripCode");
    }
  } catch (err) {
    console.log("TripMembers code update skipped:", err.message);
  }

  sendSuccess(context, {
    id: travelerId,
    accessCode: newCode
  }, 200, headers);
}

// Helper to generate access code
function generateAccessCode(name) {
  const year = new Date().getFullYear();
  const cleanName = name.toLowerCase().replace(/[^a-z]/g, "");
  const shortName = cleanName.substring(0, 6);
  // Add random suffix for uniqueness
  const suffix = Math.random().toString(36).substring(2, 5);
  return `${shortName}${year}${suffix}`;
}

// Helper to get a default color
function getDefaultColor() {
  const colors = [
    "#e91e63", "#9c27b0", "#673ab7", "#3f51b5",
    "#2196f3", "#03a9f4", "#00bcd4", "#009688",
    "#4caf50", "#8bc34a", "#cddc39", "#ffeb3b",
    "#ffc107", "#ff9800", "#ff5722", "#795548"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
