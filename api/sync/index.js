const {
  TABLES,
  getEntity,
  queryByPartition
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

// Round lifecycle states
const ROUND_STATES = {
  COUNTDOWN: "countdown",
  ACTIVE: "active",
  COMPLETE: "complete"
};

module.exports = async function (context, req) {
  const headers = getHeaders("GET, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, OPTIONS");
    return;
  }

  const tripId = context.bindingData.tripId;

  const auth = await requireTravelerAuth(context, req, { methods: "GET, OPTIONS" });
  if (!auth) return;

  if (tripId !== auth.tripId) {
    sendError(context, "Trip ID mismatch", 403, headers);
    return;
  }

  try {
    const { since, travelerId } = req.query;
    const sinceTime = since ? new Date(since).getTime() : 0;
    const now = Date.now();

    // Fetch all data in parallel
    const [triviaRounds, pokes, locations] = await Promise.all([
      queryByPartition(TABLES.TRIVIA_ROUNDS, tripId),
      travelerId ? queryByPartition(TABLES.TRIVIA_POKES, tripId) : Promise.resolve([]),
      queryByPartition(TABLES.TRAVELER_LOCATIONS, tripId)
    ]);

    // Find active trivia round
    let activeRound = null;
    let roundStateChanged = false;

    for (const round of triviaRounds) {
      if (round.state === ROUND_STATES.COUNTDOWN || round.state === ROUND_STATES.ACTIVE) {
        const countdownEnds = new Date(round.countdownEndsAt).getTime();
        const activeEnds = new Date(round.activeEndsAt).getTime();

        // Auto-transition states
        if (round.state === ROUND_STATES.COUNTDOWN && now >= countdownEnds) {
          round.state = ROUND_STATES.ACTIVE;
          roundStateChanged = true;
        }

        if (round.state === ROUND_STATES.ACTIVE && now >= activeEnds) {
          round.state = ROUND_STATES.COMPLETE;
          roundStateChanged = true;
          continue; // Skip completed rounds
        }

        activeRound = formatRound(round);
        break;
      }
    }

    // Filter pokes for this traveler since timestamp
    let pendingPokes = [];
    if (travelerId) {
      pendingPokes = pokes
        .filter(p =>
          p.toTravelerId === travelerId &&
          !p.acknowledged &&
          new Date(p.createdAt).getTime() > sinceTime
        )
        .map(p => ({
          id: p.id,
          fromTravelerId: p.fromTravelerId,
          message: p.message,
          createdAt: p.createdAt
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Filter recent locations (updated since timestamp or within last hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentLocations = locations
      .filter(loc => {
        const updatedAt = new Date(loc.updatedAt || loc.createdAt).getTime();
        return updatedAt > sinceTime && updatedAt > oneHourAgo && loc.isSharing !== false;
      })
      .map(loc => ({
        travelerId: loc.travelerId || loc.rowKey.replace("loc_", ""),
        lat: loc.lat,
        lon: loc.lon,
        label: loc.label,
        updatedAt: loc.updatedAt || loc.createdAt
      }));

    // Calculate if polling should be faster (active trivia round)
    const suggestedPollInterval = activeRound ? 2000 : 15000; // 2s during trivia, 15s idle

    // Set ETag for caching
    const stateHash = JSON.stringify({
      round: activeRound?.id,
      roundState: activeRound?.state,
      pokeCount: pendingPokes.length,
      locationCount: recentLocations.length
    });
    const etag = Buffer.from(stateHash).toString("base64").substring(0, 16);

    // Check If-None-Match header
    const clientEtag = req.headers["if-none-match"];
    if (clientEtag === etag) {
      context.res = {
        status: 304,
        headers: {
          ...headers,
          "ETag": etag
        }
      };
      return;
    }

    sendSuccess(context, {
      triviaRound: activeRound,
      pokes: pendingPokes,
      locations: recentLocations,
      lastSync: new Date(now).toISOString(),
      suggestedPollInterval,
      hasUpdates: activeRound !== null || pendingPokes.length > 0 || recentLocations.length > 0
    }, 200, {
      ...headers,
      "ETag": etag,
      "Cache-Control": "no-cache"
    });

  } catch (err) {
    console.error("Sync API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Format round for sync response (hide answer during active round)
function formatRound(round) {
  const answers = JSON.parse(round.answers || "[]");
  const responses = JSON.parse(round.responses || "{}");
  const hideAnswer = round.state !== ROUND_STATES.COMPLETE;

  return {
    id: round.id,
    state: round.state,
    category: round.category,
    eventId: round.eventId,
    initiatedBy: round.initiatedBy,
    question: round.question,
    answers,
    correctIndex: hideAnswer ? null : round.correctIndex,
    countdownEndsAt: round.countdownEndsAt,
    activeEndsAt: round.activeEndsAt,
    totalParticipants: Object.keys(responses).length
  };
}
