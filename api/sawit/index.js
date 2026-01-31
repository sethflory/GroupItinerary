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

module.exports = async function (context, req) {
  const headers = getHeaders("GET, POST, PUT, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, POST, PUT, OPTIONS");
    return;
  }

  // Extract path parameters
  const action = context.bindingData.action;
  const eventId = context.bindingData.eventId;
  const subAction = context.bindingData.subAction || req.query.subAction;

  // Validate access
  const auth = await requireTravelerAuth(context, req, { methods: "GET, POST, PUT, OPTIONS" });
  if (!auth) return;

  const tripId = auth.tripId;

  // Ensure tables exist
  await ensureTable(TABLES.SAW_IT_GAMES);
  await ensureTable(TABLES.SAW_IT_LISTS);

  try {
    switch (action) {
      case "active":
        // Get all active games for activity pills
        if (req.method === "GET") {
          return await getActiveGames(context, tripId, headers);
        }
        sendError(context, "Method not allowed", 405, headers);
        return;

      case "generate":
        if (req.method !== "POST") {
          sendError(context, "Method not allowed", 405, headers);
          return;
        }
        return await generateSights(context, tripId, req.body, headers);

      case "list":
        if (eventId) {
          // Get specific list
          if (req.method === "GET") {
            return await getPersonalList(context, tripId, eventId, auth, headers);
          }
        } else {
          // Create list or get all lists
          if (req.method === "POST") {
            return await savePersonalList(context, tripId, req.body, auth, headers);
          } else if (req.method === "GET") {
            return await getAllPersonalLists(context, tripId, auth, headers);
          }
        }
        sendError(context, "Invalid request", 400, headers);
        return;

      case "lists":
        // Get all lists for current user (alternate endpoint)
        if (req.method === "GET") {
          return await getAllPersonalLists(context, tripId, auth, headers);
        }
        sendError(context, "Method not allowed", 405, headers);
        return;

      case "game":
        if (eventId) {
          // Specific game operations
          if (req.method === "GET") {
            return await getGame(context, tripId, eventId, headers);
          } else if (req.method === "PUT") {
            return await updateGame(context, tripId, eventId, req.body, auth, headers);
          } else if (req.method === "POST") {
            // Handle sub-actions (sight, share)
            if (subAction === "sight") {
              return await recordSighting(context, tripId, eventId, req.body, auth, headers);
            } else if (subAction === "share") {
              return await recordShare(context, tripId, eventId, req.body, auth, headers);
            }
            sendError(context, "Invalid sub-action", 400, headers);
            return;
          }
        } else {
          // Create new game
          if (req.method === "POST") {
            return await createGame(context, tripId, req.body, auth, headers);
          }
        }
        sendError(context, "Invalid request", 400, headers);
        return;

      default:
        sendError(context, "Unknown action: " + action, 404, headers);
    }

  } catch (err) {
    console.error("Saw It API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Get all active games for a trip (for activity pills)
async function getActiveGames(context, tripId, headers) {
  try {
    const allGames = await queryByPartition(TABLES.SAW_IT_GAMES, tripId);

    // Filter to only active games
    const activeGames = allGames.filter(g => g.status === "active");

    // Format for activity pills (lightweight response)
    const games = activeGames.map(g => {
      let sightings = [];
      try {
        sightings = typeof g.sightings === "string" ? JSON.parse(g.sightings) : (g.sightings || []);
      } catch (e) {
        sightings = [];
      }

      return {
        id: g.id || g.rowKey,
        eventId: g.eventId,
        eventTitle: g.eventTitle,
        status: g.status,
        playerCount: new Set(sightings.map(s => s.travelerId)).size,
        sightings: sightings.length,
        createdAt: g.createdAt
      };
    });

    sendSuccess(context, { games }, 200, headers);
  } catch (err) {
    console.error("Error fetching active games:", err);
    sendError(context, err.message, 500, headers);
  }
}

// Generate AI sight recommendations
async function generateSights(context, tripId, body, headers) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendError(context, "AI service not configured", 500, headers);
    return;
  }

  const {
    origin,
    destination,
    transportMode = "walk",
    city,
    country,
    itemCount = 5
  } = body;

  if (!origin || !destination) {
    sendError(context, "Missing origin or destination", 400, headers);
    return;
  }

  const prompt = `You are a local guide for ${city || "this city"}${country ? `, ${country}` : ""}.

A traveler is going from "${origin.name || "their starting point"}" to "${destination.name || "their destination"}" by ${transportMode === "walk" ? "walking" : "driving"}.

Generate exactly ${itemCount} interesting things they will likely see along the way, in the ORDER they would encounter them on this route.

For each sight, provide:
1. name: Short name (2-5 words)
2. description: One sentence about what it is
3. category: One of: landmark, architecture, street_art, nature, food, culture, view
4. lookFor: Specific visual detail to spot (helps confirm they found it)

Focus on:
- Things visible from the ${transportMode === "walk" ? "walking path" : "road"}
- Mix of categories (not all landmarks)
- Unique to ${city || "this area"} (not generic like "traffic light")
- Actually on or near the route between these two points

Return ONLY a valid JSON array ordered by route position (first seen to last seen). Example format:
[{"name":"...", "description":"...", "category":"landmark", "lookFor":"..."}]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("AI API error:", data);
      sendError(context, "AI generation failed", 500, headers);
      return;
    }

    const aiText = data.content?.[0]?.text || "";
    let items = [];

    try {
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        items = parsed.map((item, idx) => ({
          id: `item_${idx + 1}`,
          name: item.name,
          description: item.description,
          category: item.category || "landmark",
          lookFor: item.lookFor,
          order: idx + 1
        }));
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", aiText);
      sendError(context, "Failed to parse AI response", 500, headers);
      return;
    }

    sendSuccess(context, { items }, 200, headers);

  } catch (err) {
    console.error("AI generation error:", err);
    sendError(context, err.message, 500, headers);
  }
}

// Get game for an event
async function getGame(context, tripId, eventId, headers) {
  const rowKey = `sawit_${eventId}`;
  const game = await getEntity(TABLES.SAW_IT_GAMES, tripId, rowKey);

  if (!game) {
    sendSuccess(context, { id: null }, 200, headers);
    return;
  }

  sendSuccess(context, formatGame(game), 200, headers);
}

// Create new game
async function createGame(context, tripId, body, auth, headers) {
  const { eventId, eventTitle, origin, destination, transportMode, items } = body;

  if (!eventId) {
    sendError(context, "Missing eventId", 400, headers);
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    sendError(context, "Missing items", 400, headers);
    return;
  }

  const rowKey = `sawit_${eventId}`;

  // Check if game already exists
  const existing = await getEntity(TABLES.SAW_IT_GAMES, tripId, rowKey);
  if (existing && existing.status === "active") {
    sendError(context, "A game already exists for this event", 400, headers);
    return;
  }

  const gameId = generateRowKey("game");

  const game = {
    partitionKey: tripId,
    rowKey: rowKey,
    id: gameId,
    tripId,
    eventId,
    eventTitle: eventTitle || "Destination",
    status: "active",
    createdBy: auth.travelerId || "admin",
    createdByName: auth.travelerName || "Admin",
    createdAt: new Date().toISOString(),
    completedAt: null,
    origin: JSON.stringify(origin || {}),
    destination: JSON.stringify(destination || {}),
    transportMode: transportMode || "walk",
    items: JSON.stringify(items),
    sightings: JSON.stringify([])
  };

  await upsertEntity(TABLES.SAW_IT_GAMES, game);

  sendSuccess(context, formatGame(game), 201, headers);
}

// Record a sighting
async function recordSighting(context, tripId, eventId, body, auth, headers) {
  const { itemId, photoUrl } = body;

  if (!itemId) {
    sendError(context, "Missing itemId", 400, headers);
    return;
  }

  const rowKey = `sawit_${eventId}`;
  const game = await getEntity(TABLES.SAW_IT_GAMES, tripId, rowKey);

  if (!game) {
    sendError(context, "Game not found", 404, headers);
    return;
  }

  if (game.status !== "active") {
    sendError(context, "Game is not active", 400, headers);
    return;
  }

  // Parse existing data
  let items = [];
  let sightings = [];
  try {
    items = JSON.parse(game.items || "[]");
    sightings = JSON.parse(game.sightings || "[]");
  } catch (e) {
    items = [];
    sightings = [];
  }

  // Verify item exists
  const item = items.find(i => i.id === itemId);
  if (!item) {
    sendError(context, "Invalid item", 400, headers);
    return;
  }

  // Check if traveler already spotted this item
  const travelerId = auth.travelerId || "admin";
  const travelerName = auth.travelerName || "Admin";
  const alreadySpotted = sightings.find(s => s.itemId === itemId && s.travelerId === travelerId);

  if (alreadySpotted) {
    sendError(context, "You already spotted this item", 400, headers);
    return;
  }

  // Calculate points based on order
  const itemSightings = sightings.filter(s => s.itemId === itemId);
  const position = itemSightings.length; // 0 = first, 1 = second, etc.

  // Get traveler count from environment or default
  const travelerCount = parseInt(process.env.DEFAULT_TRAVELER_COUNT) || 4;
  const points = Math.max(1, travelerCount - position);

  // Add sighting
  const sighting = {
    itemId,
    itemName: item.name,
    travelerId,
    travelerName,
    sightedAt: new Date().toISOString(),
    photoUrl: photoUrl || null,
    sharedToSocial: false,
    points
  };

  sightings.push(sighting);
  game.sightings = JSON.stringify(sightings);

  await upsertEntity(TABLES.SAW_IT_GAMES, game);

  const response = formatGame(game);
  response.points = points;

  sendSuccess(context, response, 200, headers);
}

// Record social share for bonus points
async function recordShare(context, tripId, eventId, body, auth, headers) {
  const { itemId } = body;

  if (!itemId) {
    sendError(context, "Missing itemId", 400, headers);
    return;
  }

  const rowKey = `sawit_${eventId}`;
  const game = await getEntity(TABLES.SAW_IT_GAMES, tripId, rowKey);

  if (!game) {
    sendError(context, "Game not found", 404, headers);
    return;
  }

  // Parse sightings
  let sightings = [];
  try {
    sightings = JSON.parse(game.sightings || "[]");
  } catch (e) {
    sightings = [];
  }

  // Find and update the sighting
  const travelerId = auth.travelerId || "admin";
  const sighting = sightings.find(s => s.itemId === itemId && s.travelerId === travelerId);

  if (!sighting) {
    sendError(context, "Sighting not found", 404, headers);
    return;
  }

  if (sighting.sharedToSocial) {
    sendError(context, "Already shared", 400, headers);
    return;
  }

  sighting.sharedToSocial = true;
  game.sightings = JSON.stringify(sightings);

  await upsertEntity(TABLES.SAW_IT_GAMES, game);

  sendSuccess(context, formatGame(game), 200, headers);
}

// Update game (complete)
async function updateGame(context, tripId, eventId, body, auth, headers) {
  const rowKey = `sawit_${eventId}`;
  const game = await getEntity(TABLES.SAW_IT_GAMES, tripId, rowKey);

  if (!game) {
    sendError(context, "Game not found", 404, headers);
    return;
  }

  // Check permissions
  const isCreator = game.createdBy === auth.travelerId;
  const canModify = isCreator || auth.isAdmin;

  if (!canModify) {
    sendError(context, "Only game creator or admin can modify", 403, headers);
    return;
  }

  const { action } = body;

  if (action === "complete") {
    game.status = "completed";
    game.completedAt = new Date().toISOString();
  } else if (action === "reset") {
    // Delete and allow new game
    await deleteEntity(TABLES.SAW_IT_GAMES, tripId, rowKey);
    sendSuccess(context, { deleted: true }, 200, headers);
    return;
  }

  await upsertEntity(TABLES.SAW_IT_GAMES, game);

  sendSuccess(context, formatGame(game), 200, headers);
}

// Save a personal list for "Just for Me"
async function savePersonalList(context, tripId, body, auth, headers) {
  const { eventId, eventTitle, origin, destination, transportMode, items } = body;

  if (!eventId) {
    sendError(context, "Missing eventId", 400, headers);
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    sendError(context, "Missing items", 400, headers);
    return;
  }

  const travelerId = auth.travelerId || "admin";
  const rowKey = `list_${eventId}_${travelerId}`;

  const list = {
    partitionKey: tripId,
    rowKey: rowKey,
    tripId,
    eventId,
    eventTitle: eventTitle || "Destination",
    travelerId,
    travelerName: auth.travelerName || "Admin",
    createdAt: new Date().toISOString(),
    origin: JSON.stringify(origin || {}),
    destination: JSON.stringify(destination || {}),
    transportMode: transportMode || "walk",
    items: JSON.stringify(items)
  };

  await upsertEntity(TABLES.SAW_IT_LISTS, list);

  sendSuccess(context, formatList(list), 201, headers);
}

// Get a personal list for an event
async function getPersonalList(context, tripId, eventId, auth, headers) {
  const travelerId = auth.travelerId || "admin";
  const rowKey = `list_${eventId}_${travelerId}`;
  const list = await getEntity(TABLES.SAW_IT_LISTS, tripId, rowKey);

  if (!list) {
    sendSuccess(context, { id: null }, 200, headers);
    return;
  }

  sendSuccess(context, formatList(list), 200, headers);
}

// Get all personal lists for current user
async function getAllPersonalLists(context, tripId, auth, headers) {
  const travelerId = auth.travelerId || "admin";
  const allLists = await queryByPartition(TABLES.SAW_IT_LISTS, tripId);

  // Filter to only this user's lists
  const userLists = allLists.filter(l => l.travelerId === travelerId);

  // Return simplified format with just eventIds for quick lookup
  const eventIds = userLists.map(l => l.eventId);

  sendSuccess(context, {
    lists: userLists.map(formatList),
    eventIds
  }, 200, headers);
}

// Format list entity for API response
function formatList(entity) {
  let origin = {};
  let destination = {};
  let items = [];

  try {
    if (entity.origin) {
      origin = typeof entity.origin === "string" ? JSON.parse(entity.origin) : entity.origin;
    }
    if (entity.destination) {
      destination = typeof entity.destination === "string" ? JSON.parse(entity.destination) : entity.destination;
    }
    if (entity.items) {
      items = typeof entity.items === "string" ? JSON.parse(entity.items) : entity.items;
    }
  } catch (e) {
    console.error("Error parsing list JSON fields:", e);
  }

  return {
    id: entity.rowKey,
    tripId: entity.tripId || entity.partitionKey,
    eventId: entity.eventId,
    eventTitle: entity.eventTitle,
    travelerId: entity.travelerId,
    travelerName: entity.travelerName,
    createdAt: entity.createdAt,
    origin,
    destination,
    transportMode: entity.transportMode,
    items
  };
}

// Format game entity for API response
function formatGame(entity) {
  let origin = {};
  let destination = {};
  let items = [];
  let sightings = [];

  try {
    if (entity.origin) {
      origin = typeof entity.origin === "string" ? JSON.parse(entity.origin) : entity.origin;
    }
    if (entity.destination) {
      destination = typeof entity.destination === "string" ? JSON.parse(entity.destination) : entity.destination;
    }
    if (entity.items) {
      items = typeof entity.items === "string" ? JSON.parse(entity.items) : entity.items;
    }
    if (entity.sightings) {
      sightings = typeof entity.sightings === "string" ? JSON.parse(entity.sightings) : entity.sightings;
    }
  } catch (e) {
    console.error("Error parsing game JSON fields:", e);
  }

  return {
    id: entity.id || entity.rowKey,
    tripId: entity.tripId || entity.partitionKey,
    eventId: entity.eventId,
    eventTitle: entity.eventTitle,
    status: entity.status,
    createdBy: entity.createdBy,
    createdByName: entity.createdByName,
    createdAt: entity.createdAt,
    completedAt: entity.completedAt,
    origin,
    destination,
    transportMode: entity.transportMode,
    items,
    sightings
  };
}
