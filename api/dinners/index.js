const {
  TABLES,
  ensureTable,
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
  const headers = getHeaders("GET, POST, PUT, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, POST, PUT, OPTIONS");
    return;
  }

  // Extract path parameters
  const action = context.bindingData.action;
  const pollId = context.bindingData.pollId;

  // Validate access
  const auth = await requireTravelerAuth(context, req, { methods: "GET, POST, PUT, OPTIONS" });
  if (!auth) return;

  const tripId = auth.tripId;

  // Ensure DinnerPolls table exists
  await ensureTable(TABLES.DINNER_POLLS);

  try {
    switch (action) {
      case "recommend":
        if (req.method !== "POST") {
          sendError(context, "Method not allowed", 405, headers);
          return;
        }
        return await generateRecommendations(context, tripId, req.body, headers);

      case "polls":
        if (pollId) {
          // Specific poll operations
          if (req.method === "GET") {
            return await getPoll(context, tripId, pollId, headers);
          } else if (req.method === "PUT") {
            return await updatePoll(context, tripId, pollId, req.body, auth, headers);
          }
        } else {
          // List or create polls
          if (req.method === "GET") {
            return await listPolls(context, tripId, req.query, headers);
          } else if (req.method === "POST") {
            return await createPoll(context, tripId, req.body, auth, headers);
          }
        }
        sendError(context, "Invalid request", 400, headers);
        return;

      case "vote":
        if (req.method !== "POST") {
          sendError(context, "Method not allowed", 405, headers);
          return;
        }
        return await submitVote(context, tripId, pollId, req.body, auth, headers);

      default:
        sendError(context, "Unknown action", 404, headers);
    }

  } catch (err) {
    console.error("Dinners API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Generate AI restaurant recommendations
async function generateRecommendations(context, tripId, body, headers) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendError(context, "AI service not configured", 500, headers);
    return;
  }

  const {
    destination,
    date,
    travelerCount,
    filters = {},
    optionCount = 4
  } = body;

  if (!destination || !destination.city) {
    sendError(context, "Missing destination info", 400, headers);
    return;
  }

  const cuisineList = filters.cuisineTypes?.length
    ? filters.cuisineTypes.join(", ")
    : "any cuisine";
  const priceList = filters.priceRange?.length
    ? filters.priceRange.join(", ")
    : "any price range";
  const deliveryReq = filters.deliveryOnly ? "Must offer delivery" : "Delivery optional";

  const prompt = `You are a restaurant recommendation expert for ${destination.city}, ${destination.country || ""}.

Trip details:
- Group size: ${travelerCount || "unknown"} people
- Date: ${date}
- Location: ${destination.city}${destination.country ? `, ${destination.country}` : ""}

Filters:
- Cuisine preferences: ${cuisineList}
- Price range: ${priceList}
- Delivery: ${deliveryReq}

Generate exactly ${optionCount} restaurant recommendations. For each, provide these fields:
1. name: Restaurant name (real restaurant in ${destination.city})
2. cuisine: Type of cuisine
3. priceRange: One of "$", "$$", "$$$", "$$$$"
4. description: 2-3 sentence description of atmosphere and signature dishes
5. address: Full street address
6. websiteUrl: Restaurant website URL (use realistic format)
7. phoneNumber: Phone number with country code
8. hasDelivery: true or false
9. aiReason: One sentence explaining why this is good for the group

Return ONLY a valid JSON array with no markdown formatting or explanation. Example format:
[{"name":"...", "cuisine":"...", "priceRange":"...", "description":"...", "address":"...", "websiteUrl":"...", "phoneNumber":"...", "hasDelivery":true, "aiReason":"..."}]`;

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
      sendError(context, "AI service error", 500, headers);
      return;
    }

    // Parse the AI response
    const aiText = data.content?.[0]?.text || "";
    let options;

    try {
      // Extract JSON array from response
      const jsonMatch = aiText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        options = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON array found in response");
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", aiText);
      sendError(context, "Failed to parse AI recommendations", 500, headers);
      return;
    }

    // Add IDs and mapsLinks to each option
    const formattedOptions = options.map((opt, idx) => ({
      id: `opt_${Date.now()}_${idx}`,
      name: opt.name,
      cuisine: opt.cuisine,
      priceRange: opt.priceRange,
      description: opt.description,
      address: opt.address,
      mapsLink: buildMapsLink(opt.name, opt.address),
      websiteUrl: opt.websiteUrl || null,
      phoneNumber: opt.phoneNumber || null,
      hasDelivery: opt.hasDelivery || false,
      aiReason: opt.aiReason
    }));

    sendSuccess(context, { options: formattedOptions }, 200, headers);

  } catch (err) {
    console.error("AI recommendation error:", err);
    sendError(context, "Failed to generate recommendations", 500, headers);
  }
}

// Build Google Maps URL from restaurant name and address
function buildMapsLink(name, address) {
  const query = encodeURIComponent(`${name}, ${address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// List polls for a trip
async function listPolls(context, tripId, query, headers) {
  const { status, date } = query;

  let polls = await queryByPartition(TABLES.DINNER_POLLS, tripId);

  // Apply filters
  if (status) {
    polls = polls.filter(p => p.status === status);
  }
  if (date) {
    polls = polls.filter(p => p.date === date);
  }

  // Sort by creation date (newest first)
  polls.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const formatted = polls.map(formatPoll);
  sendSuccess(context, { polls: formatted, count: formatted.length }, 200, headers);
}

// Get single poll
async function getPoll(context, tripId, pollId, headers) {
  const poll = await getEntity(TABLES.DINNER_POLLS, tripId, pollId);

  if (!poll) {
    sendError(context, "Poll not found", 404, headers);
    return;
  }

  sendSuccess(context, formatPoll(poll), 200, headers);
}

// Create new poll
async function createPoll(context, tripId, body, auth, headers) {
  const { date, filters, options } = body;

  if (!date) {
    sendError(context, "Missing date", 400, headers);
    return;
  }

  if (!options || !Array.isArray(options) || options.length === 0) {
    sendError(context, "Missing options", 400, headers);
    return;
  }

  const pollId = generateRowKey("poll");

  const poll = {
    partitionKey: tripId,
    rowKey: pollId,
    id: pollId,
    tripId,
    date,
    status: "active",
    createdBy: auth.travelerId || "admin",
    createdByName: auth.travelerName || "Admin",
    createdAt: new Date().toISOString(),
    closedAt: null,
    filters: JSON.stringify(filters || {}),
    options: JSON.stringify(options),
    votes: JSON.stringify([]),
    selectedOptionId: null,
    eventId: null
  };

  await upsertEntity(TABLES.DINNER_POLLS, poll);

  sendSuccess(context, formatPoll(poll), 201, headers);
}

// Update poll (close, select winner, add to itinerary)
async function updatePoll(context, tripId, pollId, body, auth, headers) {
  const poll = await getEntity(TABLES.DINNER_POLLS, tripId, pollId);

  if (!poll) {
    sendError(context, "Poll not found", 404, headers);
    return;
  }

  // Check permissions - only creator or admin can modify
  const isCreator = poll.createdBy === auth.travelerId;
  const canModify = isCreator || auth.isAdmin;

  if (!canModify) {
    sendError(context, "Only poll creator or admin can modify", 403, headers);
    return;
  }

  const { action, selectedOptionId, eventId } = body;

  if (action === "close") {
    poll.status = "closed";
    poll.closedAt = new Date().toISOString();
  }

  if (selectedOptionId) {
    poll.selectedOptionId = selectedOptionId;
  }

  if (eventId) {
    poll.eventId = eventId;
    poll.status = "resolved";
  }

  await upsertEntity(TABLES.DINNER_POLLS, poll);

  sendSuccess(context, formatPoll(poll), 200, headers);
}

// Submit vote
async function submitVote(context, tripId, pollId, body, auth, headers) {
  const { optionId } = body;

  if (!optionId) {
    sendError(context, "Missing optionId", 400, headers);
    return;
  }

  const poll = await getEntity(TABLES.DINNER_POLLS, tripId, pollId);

  if (!poll) {
    sendError(context, "Poll not found", 404, headers);
    return;
  }

  if (poll.status !== "active") {
    sendError(context, "Poll is not active", 400, headers);
    return;
  }

  // Parse existing votes
  let votes = [];
  try {
    votes = JSON.parse(poll.votes || "[]");
  } catch (e) {
    votes = [];
  }

  // Parse options to verify optionId is valid
  let options = [];
  try {
    options = JSON.parse(poll.options || "[]");
  } catch (e) {
    options = [];
  }

  const validOption = options.find(o => o.id === optionId);
  if (!validOption) {
    sendError(context, "Invalid option", 400, headers);
    return;
  }

  // Determine voter identity
  const travelerId = auth.travelerId || "admin";
  const travelerName = auth.travelerName || "Admin";

  // Remove existing vote from this traveler (if any)
  votes = votes.filter(v => v.travelerId !== travelerId);

  // Add new vote
  votes.push({
    travelerId,
    travelerName,
    optionId,
    votedAt: new Date().toISOString()
  });

  poll.votes = JSON.stringify(votes);
  await upsertEntity(TABLES.DINNER_POLLS, poll);

  sendSuccess(context, formatPoll(poll), 200, headers);
}

// Format poll entity for API response
function formatPoll(entity) {
  let filters = {};
  let options = [];
  let votes = [];

  try {
    if (entity.filters) {
      filters = typeof entity.filters === "string" ? JSON.parse(entity.filters) : entity.filters;
    }
    if (entity.options) {
      options = typeof entity.options === "string" ? JSON.parse(entity.options) : entity.options;
    }
    if (entity.votes) {
      votes = typeof entity.votes === "string" ? JSON.parse(entity.votes) : entity.votes;
    }
  } catch (e) {
    console.error("Error parsing poll JSON fields:", e);
  }

  // Calculate vote counts per option
  const voteCounts = {};
  for (const vote of votes) {
    voteCounts[vote.optionId] = (voteCounts[vote.optionId] || 0) + 1;
  }

  // Add vote counts to options
  const optionsWithVotes = options.map(opt => ({
    ...opt,
    voteCount: voteCounts[opt.id] || 0
  }));

  return {
    id: entity.id || entity.rowKey,
    tripId: entity.tripId || entity.partitionKey,
    date: entity.date,
    status: entity.status,
    createdBy: entity.createdBy,
    createdByName: entity.createdByName,
    createdAt: entity.createdAt,
    closedAt: entity.closedAt,
    filters,
    options: optionsWithVotes,
    votes,
    totalVotes: votes.length,
    selectedOptionId: entity.selectedOptionId,
    eventId: entity.eventId
  };
}
