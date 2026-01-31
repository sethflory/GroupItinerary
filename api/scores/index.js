const {
  TABLES,
  queryByPartition
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

// Point values for different activities
const POINTS = {
  TRIVIA_CORRECT: 10,
  SAW_IT_SIGHTING: 4,
  HUNT_ITEM_FOUND: 5,
  HUNT_FIRST_FINDER: 2  // Bonus for first to find
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
    // Fetch all score sources in parallel
    const [triviaLeaderboard, sawItGames, huntItems, travelers] = await Promise.all([
      queryByPartition(TABLES.TRIVIA_LEADERBOARD, tripId).catch(() => []),
      queryByPartition(TABLES.SAW_IT_GAMES, tripId).catch(() => []),
      queryByPartition(TABLES.SCAVENGER_HUNT_ITEMS, tripId).catch(() => []),
      queryByPartition(TABLES.TRAVELERS, tripId).catch(() => [])
    ]);

    // Build traveler map for names
    const travelerMap = {};
    travelers.forEach(t => {
      travelerMap[t.id || t.rowKey] = t.name || t.displayName || 'Traveler';
    });

    // Aggregate scores by traveler
    const scoreMap = {};

    // Initialize with all travelers
    travelers.forEach(t => {
      const travelerId = t.id || t.rowKey;
      scoreMap[travelerId] = {
        travelerId,
        name: t.name || t.displayName || 'Traveler',
        triviaPoints: 0,
        gamePoints: 0,
        huntPoints: 0,
        points: 0
      };
    });

    // Add trivia points
    triviaLeaderboard.forEach(entry => {
      const travelerId = entry.travelerId || entry.rowKey;
      if (!scoreMap[travelerId]) {
        scoreMap[travelerId] = {
          travelerId,
          name: travelerMap[travelerId] || 'Unknown',
          triviaPoints: 0,
          gamePoints: 0,
          huntPoints: 0,
          points: 0
        };
      }
      const points = entry.correctAnswers * POINTS.TRIVIA_CORRECT || entry.score || 0;
      scoreMap[travelerId].triviaPoints += points;
      scoreMap[travelerId].points += points;
    });

    // Add saw it game points (from sightings in games)
    sawItGames.forEach(game => {
      const sightings = JSON.parse(game.sightings || '[]');
      sightings.forEach(sighting => {
        const travelerId = sighting.travelerId;
        if (!travelerId) return;

        if (!scoreMap[travelerId]) {
          scoreMap[travelerId] = {
            travelerId,
            name: travelerMap[travelerId] || 'Unknown',
            triviaPoints: 0,
            gamePoints: 0,
            huntPoints: 0,
            points: 0
          };
        }
        scoreMap[travelerId].gamePoints += POINTS.SAW_IT_SIGHTING;
        scoreMap[travelerId].points += POINTS.SAW_IT_SIGHTING;
      });
    });

    // Add hunt points
    huntItems.forEach(item => {
      if (!item.foundBy) return;

      const travelerId = item.foundBy;
      if (!scoreMap[travelerId]) {
        scoreMap[travelerId] = {
          travelerId,
          name: travelerMap[travelerId] || 'Unknown',
          triviaPoints: 0,
          gamePoints: 0,
          huntPoints: 0,
          points: 0
        };
      }

      const points = item.points || POINTS.HUNT_ITEM_FOUND;
      scoreMap[travelerId].huntPoints += points;
      scoreMap[travelerId].points += points;
    });

    // Convert to sorted array
    const scores = Object.values(scoreMap)
      .filter(s => s.points > 0 || travelers.some(t => (t.id || t.rowKey) === s.travelerId))
      .sort((a, b) => b.points - a.points);

    // Build recent activity feed
    const recentActivity = await buildRecentActivity(sawItGames, huntItems, travelerMap);

    sendSuccess(context, {
      scores,
      recentActivity,
      pointValues: POINTS
    }, 200, headers);

  } catch (err) {
    console.error("Scores API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

async function buildRecentActivity(sawItGames, huntItems, travelerMap) {
  const activities = [];
  const now = Date.now();
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

  // Add game sightings
  sawItGames.forEach(game => {
    const sightings = JSON.parse(game.sightings || '[]');
    sightings.forEach(sighting => {
      const timestamp = new Date(sighting.timestamp || sighting.createdAt).getTime();
      if (timestamp > twentyFourHoursAgo) {
        activities.push({
          type: 'game',
          traveler: travelerMap[sighting.travelerId] || 'Someone',
          travelerId: sighting.travelerId,
          action: `spotted "${sighting.itemName || game.eventTitle || 'item'}"`,
          points: POINTS.SAW_IT_SIGHTING,
          timestamp
        });
      }
    });
  });

  // Add hunt item claims
  huntItems.forEach(item => {
    if (!item.foundBy || !item.foundAt) return;

    const timestamp = new Date(item.foundAt).getTime();
    if (timestamp > twentyFourHoursAgo) {
      activities.push({
        type: 'hunt',
        traveler: travelerMap[item.foundBy] || 'Someone',
        travelerId: item.foundBy,
        action: `found "${item.name}"`,
        points: item.points || POINTS.HUNT_ITEM_FOUND,
        timestamp
      });
    }
  });

  // Sort by timestamp descending and format time
  return activities
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map(activity => ({
      ...activity,
      time: formatRelativeTime(activity.timestamp)
    }));
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  return 'yesterday';
}
