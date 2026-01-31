const {
  TABLES,
  ensureTable,
  queryByPartition
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

module.exports = async function (context, req) {
  const headers = getHeaders("GET, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, OPTIONS");
    return;
  }

  // Extract path parameters
  const action = context.bindingData.action;
  const tripIdParam = context.bindingData.tripId;

  // Validate access
  const auth = await requireTravelerAuth(context, req, { methods: "GET, OPTIONS" });
  if (!auth) return;

  // Use tripId from auth or path parameter
  const tripId = auth.tripId || tripIdParam;

  if (!tripId) {
    sendError(context, "Missing tripId", 400, headers);
    return;
  }

  // Ensure table exists
  await ensureTable(TABLES.DINNER_POLLS);

  try {
    switch (action) {
      case "open":
        // Get all open/active polls for activity pills
        return await getOpenPolls(context, tripId, headers);

      default:
        sendError(context, "Unknown action: " + action, 404, headers);
    }
  } catch (err) {
    console.error("Polls API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Get all open polls for a trip (for activity pills)
async function getOpenPolls(context, tripId, headers) {
  try {
    const allPolls = await queryByPartition(TABLES.DINNER_POLLS, tripId);

    // Filter to only active polls
    const openPolls = allPolls.filter(p => p.status === "active");

    // Format for activity pills (lightweight response)
    const polls = openPolls.map(p => {
      let votes = [];
      try {
        votes = typeof p.votes === "string" ? JSON.parse(p.votes) : (p.votes || []);
      } catch (e) {
        votes = [];
      }

      return {
        id: p.id || p.rowKey,
        title: p.date ? `Dinner ${p.date}` : "Dinner Poll",
        name: "What's for Dinner?",
        date: p.date,
        status: p.status,
        voteCount: votes.length,
        createdAt: p.createdAt,
        createdBy: p.createdBy,
        createdByName: p.createdByName
      };
    });

    // Sort by creation date (newest first)
    polls.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    sendSuccess(context, { polls }, 200, headers);
  } catch (err) {
    console.error("Error fetching open polls:", err);
    sendError(context, err.message, 500, headers);
  }
}
