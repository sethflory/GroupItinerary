const {
  TABLES,
  getEntity,
  queryEntities,
  queryByPartition,
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
  const eventId = context.bindingData.eventId;

  // Validate access (supports both trip-level and traveler-specific codes)
  const auth = await requireTravelerAuth(context, req, { methods: "GET, POST, PUT, DELETE, OPTIONS" });
  if (!auth) return;

  // Verify tripId matches auth
  if (tripId !== auth.tripId) {
    sendError(context, "Trip ID mismatch", 403, headers);
    return;
  }

  try {
    switch (req.method) {
      case "GET":
        if (eventId) {
          return await getEvent(context, tripId, eventId, headers);
        } else {
          return await listEvents(context, tripId, req.query, headers);
        }

      case "POST":
        return await createEvent(context, tripId, req.body, headers);

      case "PUT":
        if (!eventId) {
          sendError(context, "Event ID required for update", 400, headers);
          return;
        }
        return await updateEvent(context, tripId, eventId, req.body, headers);

      case "DELETE":
        if (!eventId) {
          sendError(context, "Event ID required for delete", 400, headers);
          return;
        }
        return await deleteEventHandler(context, tripId, eventId, headers);

      default:
        sendError(context, "Method not allowed", 405, headers);
    }

  } catch (err) {
    console.error("Events API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// List events with optional filters
async function listEvents(context, tripId, query, headers) {
  const { date, type, traveler } = query;

  let events = [];

  if (date) {
    // Query by specific date (partition key = tripId_date)
    const partitionKey = `${tripId}_${date}`;
    events = await queryByPartition(TABLES.EVENTS, partitionKey);
  } else {
    // Query all events for trip (all partitions starting with tripId_)
    // Use prefix filter
    const allEvents = await queryEntities(
      TABLES.EVENTS,
      `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
    );
    events = allEvents;
  }

  // Apply additional filters
  let filtered = events.map(formatEvent);

  if (type) {
    filtered = filtered.filter(e => e.type === type);
  }

  if (traveler) {
    filtered = filtered.filter(e =>
      e.travelers.includes("all") ||
      e.travelers.includes(traveler) ||
      e.travelers.includes("guys") ||
      e.travelers.includes("girls")
    );
  }

  // Sort by date then time
  filtered.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  sendSuccess(context, { events: filtered, count: filtered.length }, 200, headers);
}

// Get single event
async function getEvent(context, tripId, eventId, headers) {
  // Event ID format: date_evt_timestamp_random or just evt_timestamp_random
  // We need to find the event across possible partitions

  // First, check if eventId contains date info
  const eventIdParts = eventId.split("_");
  let event = null;

  // Try to find by scanning partitions if date not in eventId
  const allEvents = await queryEntities(
    TABLES.EVENTS,
    `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
  );

  event = allEvents.find(e => e.rowKey === eventId || e.id === eventId);

  if (!event) {
    sendError(context, "Event not found", 404, headers);
    return;
  }

  sendSuccess(context, formatEvent(event), 200, headers);
}

// Create new event
async function createEvent(context, tripId, body, headers) {
  const { date, time, type, title } = body;

  // Validate required fields
  if (!date || !time || !type || !title) {
    sendError(context, "Missing required fields: date, time, type, title", 400, headers);
    return;
  }

  // Auto-create day if it doesn't exist
  await ensureDayExists(tripId, date, body);

  // Generate event ID
  const eventId = body.id || generateRowKey("evt");
  const partitionKey = `${tripId}_${date}`;

  // Build event entity
  const event = {
    partitionKey,
    rowKey: eventId,
    id: eventId,
    date,
    time,
    endTime: body.endTime || null,
    type,
    title,
    subtitle: body.subtitle || null,
    travelers: JSON.stringify(body.travelers || ["all"]),
    status: body.status || "confirmed",
    where: body.where || null,
    details: body.details || null,
    badges: body.badges ? JSON.stringify(body.badges) : null,
    // Flight-specific
    flightCode: body.flightCode || null,
    airline: body.airline || null,
    from: body.from || null,
    to: body.to || null,
    miles: body.miles || null,
    // Venue-specific
    mapsLink: body.mapsLink || null,
    venueLink: body.venueLink || null,
    address: body.address || null,
    carousel: body.carousel || null,
    // Activity-specific
    walkingSteps: body.walkingSteps || null,
    travelTime: body.travelTime || null,
    travelNote: body.travelNote || null,
    hoverImage: body.hoverImage ? JSON.stringify(body.hoverImage) : null,
    // Metadata
    isUserGenerated: body.isUserGenerated !== false,
    createdAt: new Date().toISOString(),
    createdBy: body.createdBy || null,
    linkedPhotoUrl: body.linkedPhotoUrl || null
  };

  await upsertEntity(TABLES.EVENTS, event);

  sendSuccess(context, formatEvent(event), 201, headers);
}

// Update existing event
async function updateEvent(context, tripId, eventId, body, headers) {
  // Find existing event
  const allEvents = await queryEntities(
    TABLES.EVENTS,
    `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
  );

  const existing = allEvents.find(e => e.rowKey === eventId || e.id === eventId);

  if (!existing) {
    sendError(context, "Event not found", 404, headers);
    return;
  }

  // Check if date changed (requires moving to new partition)
  const newDate = body.date || existing.date || existing.partitionKey.split("_")[1];
  const oldPartition = existing.partitionKey;
  const newPartition = `${tripId}_${newDate}`;

  // Build updated entity
  const updated = {
    ...existing,
    partitionKey: newPartition,
    rowKey: existing.rowKey,
    id: existing.id || existing.rowKey,
    date: newDate,
    time: body.time !== undefined ? body.time : existing.time,
    endTime: body.endTime !== undefined ? body.endTime : existing.endTime,
    type: body.type !== undefined ? body.type : existing.type,
    title: body.title !== undefined ? body.title : existing.title,
    subtitle: body.subtitle !== undefined ? body.subtitle : existing.subtitle,
    travelers: body.travelers !== undefined ? JSON.stringify(body.travelers) : existing.travelers,
    status: body.status !== undefined ? body.status : existing.status,
    where: body.where !== undefined ? body.where : existing.where,
    details: body.details !== undefined ? body.details : existing.details,
    badges: body.badges !== undefined ? JSON.stringify(body.badges) : existing.badges,
    flightCode: body.flightCode !== undefined ? body.flightCode : existing.flightCode,
    airline: body.airline !== undefined ? body.airline : existing.airline,
    from: body.from !== undefined ? body.from : existing.from,
    to: body.to !== undefined ? body.to : existing.to,
    miles: body.miles !== undefined ? body.miles : existing.miles,
    mapsLink: body.mapsLink !== undefined ? body.mapsLink : existing.mapsLink,
    venueLink: body.venueLink !== undefined ? body.venueLink : existing.venueLink,
    address: body.address !== undefined ? body.address : existing.address,
    carousel: body.carousel !== undefined ? body.carousel : existing.carousel,
    walkingSteps: body.walkingSteps !== undefined ? body.walkingSteps : existing.walkingSteps,
    travelTime: body.travelTime !== undefined ? body.travelTime : existing.travelTime,
    travelNote: body.travelNote !== undefined ? body.travelNote : existing.travelNote,
    hoverImage: body.hoverImage !== undefined ? JSON.stringify(body.hoverImage) : existing.hoverImage,
    linkedPhotoUrl: body.linkedPhotoUrl !== undefined ? body.linkedPhotoUrl : existing.linkedPhotoUrl,
    updatedAt: new Date().toISOString(),
    updatedBy: body.updatedBy || null
  };

  // If partition changed, delete old and create new
  if (oldPartition !== newPartition) {
    await deleteEntity(TABLES.EVENTS, oldPartition, existing.rowKey);
  }

  await upsertEntity(TABLES.EVENTS, updated);

  sendSuccess(context, formatEvent(updated), 200, headers);
}

// Delete event
async function deleteEventHandler(context, tripId, eventId, headers) {
  // Find existing event
  const allEvents = await queryEntities(
    TABLES.EVENTS,
    `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
  );

  const existing = allEvents.find(e => e.rowKey === eventId || e.id === eventId);

  if (!existing) {
    sendError(context, "Event not found", 404, headers);
    return;
  }

  await deleteEntity(TABLES.EVENTS, existing.partitionKey, existing.rowKey);

  sendSuccess(context, { success: true, deleted: eventId }, 200, headers);
}

// Ensure a day record exists for the given date
async function ensureDayExists(tripId, date, eventData = {}) {
  const dayRowKey = `day_${date}`;

  // Check if day already exists
  const existingDay = await getEntity(TABLES.DAYS, tripId, dayRowKey);
  if (existingDay) {
    return existingDay;
  }

  // Parse date to create label
  const dateObj = new Date(date + 'T12:00:00Z');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayOfWeek = dayNames[dateObj.getUTCDay()];
  const month = monthNames[dateObj.getUTCMonth()];
  const dayNum = dateObj.getUTCDate();

  // Calculate day number by counting existing days + 1
  const existingDays = await queryByPartition(TABLES.DAYS, tripId);
  const dayNumber = existingDays.length + 1;

  // Determine location from event data (flight destination or from field)
  let location = eventData.to || eventData.from || eventData.location || null;

  // Create day record
  const day = {
    partitionKey: tripId,
    rowKey: dayRowKey,
    date,
    dayNum: dayNumber,
    label: `${dayOfWeek}, ${month} ${dayNum}`,
    location,
    destination: location,
    theme: `Day ${dayNumber}`,
    createdAt: new Date().toISOString()
  };

  await upsertEntity(TABLES.DAYS, day);
  console.log(`[Events] Auto-created day for ${date}`);

  return day;
}

// Ensure days exist for a date range (fills gaps between min and max dates)
async function ensureDaysForRange(tripId, events) {
  if (!events || events.length === 0) return;

  // Get all unique dates from events
  const dates = [...new Set(events.map(e => e.date))].sort();
  if (dates.length === 0) return;

  const minDate = new Date(dates[0] + 'T12:00:00Z');
  const maxDate = new Date(dates[dates.length - 1] + 'T12:00:00Z');

  // Create days for every date in range
  const currentDate = new Date(minDate);
  while (currentDate <= maxDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Find any event on this date to get location info
    const eventOnDate = events.find(e => e.date === dateStr);
    await ensureDayExists(tripId, dateStr, eventOnDate || {});

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
}

// Format event entity to API response
function formatEvent(entity) {
  // Parse JSON fields
  let travelers = ["all"];
  let badges = [];
  let hoverImage = null;

  try {
    if (entity.travelers) {
      travelers = typeof entity.travelers === "string" ? JSON.parse(entity.travelers) : entity.travelers;
    }
    if (entity.badges) {
      badges = typeof entity.badges === "string" ? JSON.parse(entity.badges) : entity.badges;
    }
    if (entity.hoverImage) {
      hoverImage = typeof entity.hoverImage === "string" ? JSON.parse(entity.hoverImage) : entity.hoverImage;
    }
  } catch (e) {
    console.error("Error parsing event JSON fields:", e);
  }

  // Extract date from partition key if not stored directly
  const date = entity.date || (entity.partitionKey ? entity.partitionKey.split("_")[1] : null);

  return {
    id: entity.id || entity.rowKey,
    date,
    time: entity.time,
    endTime: entity.endTime || null,
    type: entity.type,
    title: entity.title,
    subtitle: entity.subtitle || null,
    travelers,
    status: entity.status || "confirmed",
    where: entity.where || null,
    details: entity.details || null,
    badges,
    // Flight-specific
    flightCode: entity.flightCode || null,
    airline: entity.airline || null,
    from: entity.from || null,
    to: entity.to || null,
    miles: entity.miles || null,
    // Venue-specific
    mapsLink: entity.mapsLink || null,
    venueLink: entity.venueLink || null,
    address: entity.address || null,
    carousel: entity.carousel || null,
    // Activity-specific
    walkingSteps: entity.walkingSteps || null,
    travelTime: entity.travelTime || null,
    travelNote: entity.travelNote || null,
    hoverImage,
    // Metadata
    isUserGenerated: entity.isUserGenerated || false,
    createdAt: entity.createdAt || null,
    linkedPhotoUrl: entity.linkedPhotoUrl || null
  };
}
