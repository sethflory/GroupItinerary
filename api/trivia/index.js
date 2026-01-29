const {
  TABLES,
  getEntity,
  queryEntities,
  queryByPartition,
  upsertEntity,
  generateRowKey
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");
const { buildTriviaContext } = require("../shared/contextBuilder");

// Round lifecycle states
const ROUND_STATES = {
  INITIATE: "initiate",
  COUNTDOWN: "countdown",
  ACTIVE: "active",
  SCORING: "scoring",
  COMPLETE: "complete"
};

// Scoring constants
const BASE_POINTS = 10;
const MAX_SPEED_BONUS = 5;
const ROUND_DURATION_MS = 30000; // 30 seconds

module.exports = async function (context, req) {
  const headers = getHeaders("GET, POST, PUT, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, POST, PUT, OPTIONS");
    return;
  }

  const tripId = context.bindingData.tripId;
  const resource = context.bindingData.resource;
  const resourceId = context.bindingData.resourceId;

  const auth = requireAuth(context, req, { methods: "GET, POST, PUT, OPTIONS" });
  if (!auth) return;

  if (tripId !== auth.tripId) {
    sendError(context, "Trip ID mismatch", 403, headers);
    return;
  }

  try {
    // Route handling
    if (resource === "rounds") {
      if (resourceId === "active") {
        // GET /api/trips/{tripId}/trivia/rounds/active - Poll for active round
        if (req.method === "GET") {
          return await getActiveRound(context, tripId, headers);
        }
      } else if (resourceId) {
        // PUT /api/trips/{tripId}/trivia/rounds/{roundId} - Submit answer
        if (req.method === "PUT") {
          return await submitAnswer(context, tripId, resourceId, req.body, headers);
        }
        // GET /api/trips/{tripId}/trivia/rounds/{roundId} - Get round details
        if (req.method === "GET") {
          return await getRound(context, tripId, resourceId, headers);
        }
      } else {
        // POST /api/trips/{tripId}/trivia/rounds - Start new round
        if (req.method === "POST") {
          return await startRound(context, tripId, req.body, headers);
        }
        // GET /api/trips/{tripId}/trivia/rounds - List recent rounds
        if (req.method === "GET") {
          return await listRounds(context, tripId, headers);
        }
      }
    } else if (resource === "leaderboard") {
      // GET /api/trips/{tripId}/trivia/leaderboard
      if (req.method === "GET") {
        return await getLeaderboard(context, tripId, headers);
      }
    } else if (resource === "poke") {
      // POST /api/trips/{tripId}/trivia/poke - Send poke
      if (req.method === "POST") {
        return await sendPoke(context, tripId, req.body, headers);
      }
    } else if (resource === "pokes") {
      // GET /api/trips/{tripId}/trivia/pokes - Get pending pokes
      if (req.method === "GET") {
        return await getPokes(context, tripId, req.query, headers);
      }
    }

    sendError(context, "Not found", 404, headers);

  } catch (err) {
    console.error("Trivia API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Start a new trivia round
async function startRound(context, tripId, body, headers) {
  const { category, eventId, initiatedBy } = body;

  if (!initiatedBy) {
    sendError(context, "initiatedBy is required", 400, headers);
    return;
  }

  // Generate question using AI
  const question = await generateQuestion(tripId, category, eventId);
  if (!question) {
    sendError(context, "Failed to generate question", 500, headers);
    return;
  }

  const roundId = generateRowKey("round");
  const now = Date.now();

  const round = {
    partitionKey: tripId,
    rowKey: roundId,
    id: roundId,
    state: ROUND_STATES.COUNTDOWN,
    category: category || "general",
    eventId: eventId || null,
    initiatedBy,
    question: question.question,
    answers: JSON.stringify(question.answers),
    correctIndex: question.correctIndex,
    createdAt: new Date(now).toISOString(),
    countdownEndsAt: new Date(now + 3000).toISOString(), // 3 second countdown
    activeEndsAt: new Date(now + 3000 + ROUND_DURATION_MS).toISOString(),
    responses: JSON.stringify({}), // { travelerId: { answer, timestamp, correct, points } }
    totalParticipants: 0
  };

  await upsertEntity(TABLES.TRIVIA_ROUNDS, round);

  sendSuccess(context, formatRound(round, false), 201, headers);
}

// Get active round (for polling)
async function getActiveRound(context, tripId, headers) {
  const now = Date.now();

  // Find most recent round that's not complete
  const rounds = await queryByPartition(TABLES.TRIVIA_ROUNDS, tripId);

  // Sort by creation time, newest first
  const sorted = rounds.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Find active or countdown round
  for (const round of sorted) {
    const activeEnds = new Date(round.activeEndsAt).getTime();

    // Check if round is still active
    if (round.state === ROUND_STATES.COUNTDOWN || round.state === ROUND_STATES.ACTIVE) {
      // Auto-transition countdown -> active
      if (round.state === ROUND_STATES.COUNTDOWN) {
        const countdownEnds = new Date(round.countdownEndsAt).getTime();
        if (now >= countdownEnds) {
          round.state = ROUND_STATES.ACTIVE;
          await upsertEntity(TABLES.TRIVIA_ROUNDS, round);
        }
      }

      // Auto-transition active -> scoring -> complete
      if (round.state === ROUND_STATES.ACTIVE && now >= activeEnds) {
        round.state = ROUND_STATES.COMPLETE;
        await upsertEntity(TABLES.TRIVIA_ROUNDS, round);
        // Update leaderboard
        await updateLeaderboard(tripId, round);
        continue; // Skip this round, look for another
      }

      // Return the active round (hide correct answer if still active)
      sendSuccess(context, formatRound(round, round.state !== ROUND_STATES.COMPLETE), 200, headers);
      return;
    }
  }

  // No active round
  sendSuccess(context, { active: false }, 200, headers);
}

// Get specific round
async function getRound(context, tripId, roundId, headers) {
  const round = await getEntity(TABLES.TRIVIA_ROUNDS, tripId, roundId);
  if (!round) {
    sendError(context, "Round not found", 404, headers);
    return;
  }

  // Hide answer if still active
  const hideAnswer = round.state === ROUND_STATES.COUNTDOWN || round.state === ROUND_STATES.ACTIVE;
  sendSuccess(context, formatRound(round, hideAnswer), 200, headers);
}

// Submit answer to round
async function submitAnswer(context, tripId, roundId, body, headers) {
  const { travelerId, answerIndex } = body;

  if (!travelerId || answerIndex === undefined) {
    sendError(context, "travelerId and answerIndex are required", 400, headers);
    return;
  }

  const round = await getEntity(TABLES.TRIVIA_ROUNDS, tripId, roundId);
  if (!round) {
    sendError(context, "Round not found", 404, headers);
    return;
  }

  // Check if round is still active
  const now = Date.now();
  const activeEnds = new Date(round.activeEndsAt).getTime();

  if (round.state !== ROUND_STATES.ACTIVE && round.state !== ROUND_STATES.COUNTDOWN) {
    sendError(context, "Round is no longer accepting answers", 400, headers);
    return;
  }

  if (now >= activeEnds) {
    sendError(context, "Time expired", 400, headers);
    return;
  }

  // Parse existing responses
  const responses = JSON.parse(round.responses || "{}");

  // Check if already answered
  if (responses[travelerId]) {
    sendError(context, "Already answered", 400, headers);
    return;
  }

  // Calculate score
  const correct = answerIndex === round.correctIndex;
  const activeStarted = new Date(round.countdownEndsAt).getTime();
  const elapsed = now - activeStarted;
  const timeRatio = Math.max(0, 1 - (elapsed / ROUND_DURATION_MS));
  const speedBonus = correct ? Math.round(timeRatio * MAX_SPEED_BONUS) : 0;
  const points = correct ? BASE_POINTS + speedBonus : 0;

  // Record response
  responses[travelerId] = {
    answer: answerIndex,
    timestamp: new Date(now).toISOString(),
    correct,
    points,
    speedBonus
  };

  round.responses = JSON.stringify(responses);
  round.totalParticipants = Object.keys(responses).length;

  await upsertEntity(TABLES.TRIVIA_ROUNDS, round);

  sendSuccess(context, {
    recorded: true,
    correct,
    points,
    speedBonus,
    // Don't reveal correct answer until round ends
    message: correct ? "Correct!" : "Answer recorded"
  }, 200, headers);
}

// List recent rounds
async function listRounds(context, tripId, headers) {
  const rounds = await queryByPartition(TABLES.TRIVIA_ROUNDS, tripId);

  // Sort by creation time, newest first
  const sorted = rounds
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20); // Last 20 rounds

  const formatted = sorted.map(r => formatRound(r, false));

  sendSuccess(context, { rounds: formatted }, 200, headers);
}

// Get leaderboard
async function getLeaderboard(context, tripId, headers) {
  const leaderboard = await getEntity(TABLES.TRIVIA_LEADERBOARD, tripId, "leaderboard");

  if (!leaderboard || !leaderboard.scores) {
    // Return empty leaderboard
    sendSuccess(context, {
      scores: [],
      lastUpdated: null
    }, 200, headers);
    return;
  }

  const scores = JSON.parse(leaderboard.scores);

  // Sort by total points descending
  const sorted = Object.entries(scores)
    .map(([travelerId, data]) => ({
      travelerId,
      ...data
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  sendSuccess(context, {
    scores: sorted,
    lastUpdated: leaderboard.lastUpdated
  }, 200, headers);
}

// Update leaderboard after round completes
async function updateLeaderboard(tripId, round) {
  const responses = JSON.parse(round.responses || "{}");

  // Get or create leaderboard
  let leaderboard = await getEntity(TABLES.TRIVIA_LEADERBOARD, tripId, "leaderboard");

  if (!leaderboard) {
    leaderboard = {
      partitionKey: tripId,
      rowKey: "leaderboard",
      scores: JSON.stringify({}),
      lastUpdated: null
    };
  }

  const scores = JSON.parse(leaderboard.scores || "{}");

  // Update scores for each participant
  for (const [travelerId, response] of Object.entries(responses)) {
    if (!scores[travelerId]) {
      scores[travelerId] = {
        totalPoints: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        streak: 0,
        maxStreak: 0
      };
    }

    const travelerScore = scores[travelerId];
    travelerScore.totalPoints += response.points;
    travelerScore.totalAnswers += 1;

    if (response.correct) {
      travelerScore.correctAnswers += 1;
      travelerScore.streak += 1;
      travelerScore.maxStreak = Math.max(travelerScore.maxStreak, travelerScore.streak);
    } else {
      travelerScore.streak = 0;
    }
  }

  leaderboard.scores = JSON.stringify(scores);
  leaderboard.lastUpdated = new Date().toISOString();

  await upsertEntity(TABLES.TRIVIA_LEADERBOARD, leaderboard);
}

// Send poke
async function sendPoke(context, tripId, body, headers) {
  const { fromTravelerId, toTravelerId, message } = body;

  if (!fromTravelerId || !toTravelerId) {
    sendError(context, "fromTravelerId and toTravelerId are required", 400, headers);
    return;
  }

  const pokeId = generateRowKey("poke");

  const poke = {
    partitionKey: tripId,
    rowKey: pokeId,
    id: pokeId,
    fromTravelerId,
    toTravelerId,
    message: message || "wants to play trivia!",
    createdAt: new Date().toISOString(),
    acknowledged: false
  };

  await upsertEntity(TABLES.TRIVIA_POKES, poke);

  sendSuccess(context, { sent: true, pokeId }, 201, headers);
}

// Get pending pokes for a traveler
async function getPokes(context, tripId, query, headers) {
  const { travelerId, since } = query;

  if (!travelerId) {
    sendError(context, "travelerId is required", 400, headers);
    return;
  }

  const allPokes = await queryByPartition(TABLES.TRIVIA_POKES, tripId);

  // Filter pokes for this traveler that are not acknowledged
  let pokes = allPokes.filter(p =>
    p.toTravelerId === travelerId && !p.acknowledged
  );

  // Filter by timestamp if provided
  if (since) {
    const sinceTime = new Date(since).getTime();
    pokes = pokes.filter(p => new Date(p.createdAt).getTime() > sinceTime);
  }

  // Sort by creation time
  pokes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  sendSuccess(context, {
    pokes: pokes.map(p => ({
      id: p.id,
      fromTravelerId: p.fromTravelerId,
      message: p.message,
      createdAt: p.createdAt
    }))
  }, 200, headers);
}

// Generate trivia question using AI
async function generateQuestion(tripId, category, eventId) {
  try {
    const tripContext = await buildTriviaContext(tripId, { category, eventId });

    const prompt = `${tripContext}

Generate a trivia question about this trip or event. The question should be ${category || 'general'} in style.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{"question":"Your question here?","answers":["Option A","Option B","Option C","Option D"],"correctIndex":0}

The correctIndex should be 0, 1, 2, or 3 indicating which answer is correct.`;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY not configured");
      return getDefaultQuestion(category);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      console.error("AI API error:", response.status);
      return getDefaultQuestion(category);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in AI response");
      return getDefaultQuestion(category);
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.question || !Array.isArray(parsed.answers) || parsed.answers.length !== 4) {
      console.error("Invalid question structure");
      return getDefaultQuestion(category);
    }

    return {
      question: parsed.question,
      answers: parsed.answers,
      correctIndex: parsed.correctIndex || 0
    };

  } catch (err) {
    console.error("Error generating question:", err);
    return getDefaultQuestion(category);
  }
}

// Default questions as fallback
function getDefaultQuestion(category) {
  const questions = {
    funny: {
      question: "What's the best way to survive a long-haul flight?",
      answers: ["Never sleep, watch all the movies", "Bring your own pillow fortress", "Make friends with the flight attendants", "All of the above"],
      correctIndex: 3
    },
    historical: {
      question: "The Parthenon was built in which century?",
      answers: ["3rd century BC", "5th century BC", "1st century AD", "2nd century BC"],
      correctIndex: 1
    },
    general: {
      question: "What is the capital of Greece?",
      answers: ["Thessaloniki", "Athens", "Sparta", "Patras"],
      correctIndex: 1
    }
  };

  return questions[category] || questions.general;
}

// Format round for API response
function formatRound(round, hideAnswer) {
  const responses = JSON.parse(round.responses || "{}");
  const answers = JSON.parse(round.answers || "[]");

  return {
    id: round.id,
    state: round.state,
    category: round.category,
    eventId: round.eventId,
    initiatedBy: round.initiatedBy,
    question: round.question,
    answers,
    correctIndex: hideAnswer ? null : round.correctIndex,
    createdAt: round.createdAt,
    countdownEndsAt: round.countdownEndsAt,
    activeEndsAt: round.activeEndsAt,
    totalParticipants: round.totalParticipants || Object.keys(responses).length,
    responses: hideAnswer ? {} : responses
  };
}
