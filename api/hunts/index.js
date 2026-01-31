const {
  TABLES,
  ensureTable,
  getEntity,
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
const { createNotificationInternal } = require("../notifications/index");

module.exports = async function (context, req) {
  const headers = getHeaders("GET, POST, PUT, DELETE, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, POST, PUT, DELETE, OPTIONS");
    return;
  }

  // Extract path parameters
  let action = context.bindingData.action;
  let huntId = context.bindingData.huntId;
  let subAction = context.bindingData.subAction;
  let itemId = context.bindingData.itemId;

  // Handle case where huntId is passed as first parameter (e.g., /hunts/hunt_xxx)
  if (action && action.startsWith("hunt_")) {
    // Shift parameters: action is actually huntId
    itemId = subAction;
    subAction = huntId;
    huntId = action;
    action = null;
  }

  // Validate access
  const auth = await requireTravelerAuth(context, req, { methods: "GET, POST, PUT, DELETE, OPTIONS" });
  if (!auth) return;

  const tripId = auth.tripId;

  // Ensure tables exist
  await ensureTable(TABLES.SCAVENGER_HUNTS);
  await ensureTable(TABLES.SCAVENGER_HUNT_ITEMS);

  try {
    // Route: /hunts/active - Get active hunt
    if (action === "active") {
      if (req.method === "GET") {
        return await getActiveHunt(context, tripId, headers);
      }
      sendError(context, "Method not allowed", 405, headers);
      return;
    }

    // Route: /hunts/{huntId}/claim/{itemId} - Claim an item (check BEFORE list route)
    if (huntId && subAction === "claim" && itemId) {
      if (req.method === "POST" || req.method === "PUT") {
        return await claimItem(context, tripId, huntId, itemId, req.body, auth, headers);
      }
      sendError(context, "Method not allowed", 405, headers);
      return;
    }

    // Route: /hunts/{huntId}/items - Hunt items (check BEFORE list route)
    if (huntId && subAction === "items") {
      if (!itemId) {
        if (req.method === "GET") {
          return await listHuntItems(context, tripId, huntId, headers);
        }
        if (req.method === "POST") {
          return await addHuntItem(context, tripId, huntId, req.body, auth, headers);
        }
      } else {
        if (req.method === "GET") {
          return await getHuntItem(context, tripId, huntId, itemId, headers);
        }
        if (req.method === "PUT") {
          return await updateHuntItem(context, tripId, huntId, itemId, req.body, auth, headers);
        }
        if (req.method === "DELETE") {
          return await deleteHuntItem(context, tripId, huntId, itemId, auth, headers);
        }
      }
      sendError(context, "Method not allowed", 405, headers);
      return;
    }

    // Route: /hunts/{huntId} - Single hunt operations (check BEFORE list route)
    if (huntId && !subAction) {
      if (req.method === "GET") {
        return await getHunt(context, tripId, huntId, headers);
      }
      if (req.method === "PUT") {
        return await updateHunt(context, tripId, huntId, req.body, auth, headers);
      }
      if (req.method === "DELETE") {
        return await deleteHunt(context, tripId, huntId, auth, headers);
      }
      sendError(context, "Method not allowed", 405, headers);
      return;
    }

    // Route: /hunts/list or /hunts - List all hunts (AFTER huntId routes)
    if (action === "list" || !action) {
      if (req.method === "GET") {
        return await listHunts(context, tripId, req.query, headers);
      }
      if (req.method === "POST") {
        return await createHunt(context, tripId, req.body, auth, headers);
      }
      sendError(context, "Method not allowed", 405, headers);
      return;
    }

    sendError(context, "Unknown route", 404, headers);

  } catch (err) {
    console.error("Hunts API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// List all hunts for a trip
async function listHunts(context, tripId, query, headers) {
  const { status } = query;

  let hunts = await queryByPartition(TABLES.SCAVENGER_HUNTS, tripId);

  if (status) {
    hunts = hunts.filter(h => h.status === status);
  }

  // Sort by creation date (newest first)
  hunts.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const formatted = hunts.map(formatHunt);
  sendSuccess(context, { hunts: formatted, count: formatted.length }, 200, headers);
}

// Get active hunt
async function getActiveHunt(context, tripId, headers) {
  const hunts = await queryByPartition(TABLES.SCAVENGER_HUNTS, tripId);
  const activeHunt = hunts.find(h => h.status === "active");

  if (!activeHunt) {
    sendSuccess(context, { hunt: null }, 200, headers);
    return;
  }

  // Get items for this hunt
  const items = await getHuntItemsInternal(tripId, activeHunt.rowKey);

  sendSuccess(context, {
    hunt: formatHunt(activeHunt),
    items: items.map(formatHuntItem)
  }, 200, headers);
}

// Get single hunt
async function getHunt(context, tripId, huntId, headers) {
  const hunt = await getEntity(TABLES.SCAVENGER_HUNTS, tripId, huntId);

  if (!hunt) {
    sendError(context, "Hunt not found", 404, headers);
    return;
  }

  // Get items for this hunt
  const items = await getHuntItemsInternal(tripId, huntId);

  sendSuccess(context, {
    hunt: formatHunt(hunt),
    items: items.map(formatHuntItem)
  }, 200, headers);
}

// Create new hunt
async function createHunt(context, tripId, body, auth, headers) {
  // Check for existing active hunt
  const hunts = await queryByPartition(TABLES.SCAVENGER_HUNTS, tripId);
  const existingActive = hunts.find(h => h.status === "active");

  if (existingActive) {
    sendError(context, "A hunt is already active. End it before creating a new one.", 400, headers);
    return;
  }

  const { title, description, theme, difficulty, endCondition, location, items } = body;

  if (!title) {
    sendError(context, "Missing required field: title", 400, headers);
    return;
  }

  const huntId = generateRowKey("hunt");

  const hunt = {
    partitionKey: tripId,
    rowKey: huntId,
    id: huntId,
    tripId,
    title,
    description: description || "",
    createdBy: auth.travelerId || "admin",
    createdByName: auth.travelerName || "Admin",
    createdAt: new Date().toISOString(),
    status: "active",
    endCondition: endCondition || "manual",
    endTime: null,
    completedAt: null,
    theme: theme || null,
    difficulty: difficulty || "medium",
    location: location || null,  // Destination key for map centering
    finalScores: null
  };

  await upsertEntity(TABLES.SCAVENGER_HUNTS, hunt);

  // Add items if provided
  if (items && Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = generateRowKey("item");
      const huntItem = {
        partitionKey: `${tripId}_${huntId}`,
        rowKey: itemId,
        id: itemId,
        huntId,
        tripId,
        description: item.description,
        points: item.points || 10,
        hint: item.hint || null,
        lat: item.lat || null,
        lon: item.lon || null,
        locationHint: item.locationHint || null,
        order: i,
        foundBy: null,
        foundByName: null,
        foundAt: null,
        photoUrl: null,
        note: null
      };
      await upsertEntity(TABLES.SCAVENGER_HUNT_ITEMS, huntItem);
    }
  }

  // Create notification
  await createNotificationInternal(
    tripId,
    "hunt_started",
    `${auth.travelerName || "Someone"} started a scavenger hunt: "${title}"`,
    { travelerId: auth.travelerId, travelerName: auth.travelerName, relatedId: huntId }
  );

  sendSuccess(context, formatHunt(hunt), 201, headers);
}

// Update hunt (end it, change settings)
async function updateHunt(context, tripId, huntId, body, auth, headers) {
  const hunt = await getEntity(TABLES.SCAVENGER_HUNTS, tripId, huntId);

  if (!hunt) {
    sendError(context, "Hunt not found", 404, headers);
    return;
  }

  const { action, title, description } = body;

  // End the hunt
  if (action === "end") {
    // Any authenticated trip member can end a hunt

    hunt.status = "completed";
    hunt.completedAt = new Date().toISOString();

    // Calculate final scores
    const items = await getHuntItemsInternal(tripId, huntId);
    const scores = {};
    for (const item of items) {
      if (item.foundBy) {
        scores[item.foundBy] = (scores[item.foundBy] || 0) + (item.points || 0);
      }
    }
    hunt.finalScores = JSON.stringify(scores);

    await upsertEntity(TABLES.SCAVENGER_HUNTS, hunt);

    // Create notification
    await createNotificationInternal(
      tripId,
      "hunt_ended",
      `Scavenger hunt "${hunt.title}" has ended!`,
      { relatedId: huntId }
    );

    sendSuccess(context, formatHunt(hunt), 200, headers);
    return;
  }

  // Update other fields
  if (title) hunt.title = title;
  if (description !== undefined) hunt.description = description;

  await upsertEntity(TABLES.SCAVENGER_HUNTS, hunt);
  sendSuccess(context, formatHunt(hunt), 200, headers);
}

// Delete hunt
async function deleteHunt(context, tripId, huntId, auth, headers) {
  const hunt = await getEntity(TABLES.SCAVENGER_HUNTS, tripId, huntId);

  if (!hunt) {
    sendError(context, "Hunt not found", 404, headers);
    return;
  }

  // Any authenticated trip member can delete a hunt

  // Delete all items first
  const items = await getHuntItemsInternal(tripId, huntId);
  for (const item of items) {
    await deleteEntity(TABLES.SCAVENGER_HUNT_ITEMS, item.partitionKey, item.rowKey);
  }

  // Delete the hunt
  await deleteEntity(TABLES.SCAVENGER_HUNTS, tripId, huntId);

  sendSuccess(context, { deleted: true }, 200, headers);
}

// List items for a hunt
async function listHuntItems(context, tripId, huntId, headers) {
  const items = await getHuntItemsInternal(tripId, huntId);
  sendSuccess(context, { items: items.map(formatHuntItem), count: items.length }, 200, headers);
}

// Get items internally
async function getHuntItemsInternal(tripId, huntId) {
  const partitionKey = `${tripId}_${huntId}`;
  const items = await queryByPartition(TABLES.SCAVENGER_HUNT_ITEMS, partitionKey);
  items.sort((a, b) => (a.order || 0) - (b.order || 0));
  return items;
}

// Get single item
async function getHuntItem(context, tripId, huntId, itemId, headers) {
  const partitionKey = `${tripId}_${huntId}`;
  const item = await getEntity(TABLES.SCAVENGER_HUNT_ITEMS, partitionKey, itemId);

  if (!item) {
    sendError(context, "Item not found", 404, headers);
    return;
  }

  sendSuccess(context, formatHuntItem(item), 200, headers);
}

// Add item to hunt
async function addHuntItem(context, tripId, huntId, body, auth, headers) {
  const hunt = await getEntity(TABLES.SCAVENGER_HUNTS, tripId, huntId);

  if (!hunt) {
    sendError(context, "Hunt not found", 404, headers);
    return;
  }

  const { description, points, hint, lat, lon, locationHint } = body;

  if (!description) {
    sendError(context, "Missing required field: description", 400, headers);
    return;
  }

  // Get current items to determine order
  const existingItems = await getHuntItemsInternal(tripId, huntId);
  const maxOrder = existingItems.reduce((max, i) => Math.max(max, i.order || 0), -1);

  const itemId = generateRowKey("item");
  const item = {
    partitionKey: `${tripId}_${huntId}`,
    rowKey: itemId,
    id: itemId,
    huntId,
    tripId,
    description,
    points: points || 10,
    hint: hint || null,
    lat: lat || null,
    lon: lon || null,
    locationHint: locationHint || null,
    order: maxOrder + 1,
    foundBy: null,
    foundByName: null,
    foundAt: null,
    photoUrl: null,
    note: null
  };

  await upsertEntity(TABLES.SCAVENGER_HUNT_ITEMS, item);
  sendSuccess(context, formatHuntItem(item), 201, headers);
}

// Update item
async function updateHuntItem(context, tripId, huntId, itemId, body, auth, headers) {
  const partitionKey = `${tripId}_${huntId}`;
  const item = await getEntity(TABLES.SCAVENGER_HUNT_ITEMS, partitionKey, itemId);

  if (!item) {
    sendError(context, "Item not found", 404, headers);
    return;
  }

  const { description, points, hint, lat, lon, locationHint, order } = body;

  if (description !== undefined) item.description = description;
  if (points !== undefined) item.points = points;
  if (hint !== undefined) item.hint = hint;
  if (lat !== undefined) item.lat = lat;
  if (lon !== undefined) item.lon = lon;
  if (locationHint !== undefined) item.locationHint = locationHint;
  if (order !== undefined) item.order = order;

  await upsertEntity(TABLES.SCAVENGER_HUNT_ITEMS, item);
  sendSuccess(context, formatHuntItem(item), 200, headers);
}

// Delete item
async function deleteHuntItem(context, tripId, huntId, itemId, auth, headers) {
  const partitionKey = `${tripId}_${huntId}`;
  const deleted = await deleteEntity(TABLES.SCAVENGER_HUNT_ITEMS, partitionKey, itemId);

  if (!deleted) {
    sendError(context, "Item not found", 404, headers);
    return;
  }

  sendSuccess(context, { deleted: true }, 200, headers);
}

// Claim an item
async function claimItem(context, tripId, huntId, itemId, body, auth, headers) {
  // Verify hunt is active
  const hunt = await getEntity(TABLES.SCAVENGER_HUNTS, tripId, huntId);

  if (!hunt) {
    sendError(context, "Hunt not found", 404, headers);
    return;
  }

  if (hunt.status !== "active") {
    sendError(context, "Hunt is not active", 400, headers);
    return;
  }

  // Get the item
  const partitionKey = `${tripId}_${huntId}`;
  const item = await getEntity(TABLES.SCAVENGER_HUNT_ITEMS, partitionKey, itemId);

  if (!item) {
    sendError(context, "Item not found", 404, headers);
    return;
  }

  // Check if already claimed
  if (item.foundBy) {
    sendError(context, "Item already claimed", 400, headers);
    return;
  }

  const { photoUrl, note } = body;

  // Claim the item
  item.foundBy = auth.travelerId || "admin";
  item.foundByName = auth.travelerName || "Admin";
  item.foundAt = new Date().toISOString();
  item.photoUrl = photoUrl || null;
  item.note = note || null;

  await upsertEntity(TABLES.SCAVENGER_HUNT_ITEMS, item);

  // Create notification
  await createNotificationInternal(
    tripId,
    "hunt_item_claimed",
    `${auth.travelerName || "Someone"} found "${item.description}" (+${item.points} pts)`,
    { travelerId: auth.travelerId, travelerName: auth.travelerName, relatedId: huntId }
  );

  // Check if all items are found (for auto-end)
  if (hunt.endCondition === "all_found") {
    const allItems = await getHuntItemsInternal(tripId, huntId);
    const allFound = allItems.every(i => i.foundBy);

    if (allFound) {
      hunt.status = "completed";
      hunt.completedAt = new Date().toISOString();

      // Calculate final scores
      const scores = {};
      for (const i of allItems) {
        if (i.foundBy) {
          scores[i.foundBy] = (scores[i.foundBy] || 0) + (i.points || 0);
        }
      }
      hunt.finalScores = JSON.stringify(scores);

      await upsertEntity(TABLES.SCAVENGER_HUNTS, hunt);

      await createNotificationInternal(
        tripId,
        "hunt_ended",
        `Scavenger hunt "${hunt.title}" completed - all items found!`,
        { relatedId: huntId }
      );
    }
  }

  sendSuccess(context, formatHuntItem(item), 200, headers);
}

// Format hunt for API response
function formatHunt(entity) {
  let finalScores = null;
  try {
    if (entity.finalScores) {
      finalScores = typeof entity.finalScores === "string"
        ? JSON.parse(entity.finalScores)
        : entity.finalScores;
    }
  } catch (e) {
    console.error("Error parsing finalScores:", e);
  }

  return {
    id: entity.id || entity.rowKey,
    tripId: entity.tripId || entity.partitionKey,
    title: entity.title,
    description: entity.description,
    createdBy: entity.createdBy,
    createdByName: entity.createdByName,
    createdAt: entity.createdAt,
    status: entity.status,
    endCondition: entity.endCondition,
    endTime: entity.endTime,
    completedAt: entity.completedAt,
    theme: entity.theme,
    difficulty: entity.difficulty,
    location: entity.location,  // Destination key for map
    finalScores
  };
}

// Format hunt item for API response
function formatHuntItem(entity) {
  return {
    id: entity.id || entity.rowKey,
    huntId: entity.huntId,
    description: entity.description,
    points: entity.points,
    hint: entity.hint,
    lat: entity.lat,
    lon: entity.lon,
    locationHint: entity.locationHint,
    order: entity.order,
    foundBy: entity.foundBy,
    foundByName: entity.foundByName,
    foundAt: entity.foundAt,
    photoUrl: entity.photoUrl,
    note: entity.note
  };
}
