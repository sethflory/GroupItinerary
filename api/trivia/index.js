const {
  TABLES,
  getEntity,
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

module.exports = async function (context, req) {
  const headers = getHeaders("GET, POST, PUT, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, POST, PUT, OPTIONS");
    return;
  }

  const tripId = context.bindingData.tripId;
  const action = context.bindingData.action;

  // Inject tripId from URL path into request for auth validation
  if (!req.query) req.query = {};
  req.query.tripId = tripId;

  const auth = requireAuth(context, req, { methods: "GET, POST, PUT, OPTIONS" });
  if (!auth) return;

  try {
    switch (action) {
      case "rounds":
        if (req.method === "GET") return await getActiveRound(context, tripId, headers);
        if (req.method === "POST") return await startRound(context, tripId, req.body, auth, headers);
        break;
      case "answer":
        if (req.method === "POST") return await submitAnswer(context, tripId, req.body, auth, headers);
        break;
      case "leaderboard":
        if (req.method === "GET") return await getLeaderboard(context, tripId, headers);
        break;
      default:
        sendError(context, "Unknown trivia action", 404, headers);
        return;
    }
    sendError(context, "Method not allowed", 405, headers);
  } catch (err) {
    console.error("Trivia API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

async function getActiveRound(context, tripId, headers) {
  const rounds = await queryByPartition(TABLES.TRIVIA_ROUNDS, tripId);
  const activeRound = rounds.find(r => r.status === "active" || r.status === "countdown");

  if (!activeRound) {
    sendSuccess(context, { active: false }, 200, headers);
    return;
  }

  // Auto-complete expired rounds (including old "countdown" status rounds)
  const now = new Date();
  const questionEnd = new Date(activeRound.questionEndsAt);

  if (now > questionEnd) {
    activeRound.status = "completed";
    await upsertEntity(TABLES.TRIVIA_ROUNDS, activeRound);
    sendSuccess(context, { active: false }, 200, headers);
    return;
  }

  sendSuccess(context, { active: true, round: formatRound(activeRound) }, 200, headers);
}

async function startRound(context, tripId, body, auth, headers) {
  const { category, eventContext } = body || {};

  const rounds = await queryByPartition(TABLES.TRIVIA_ROUNDS, tripId);
  let activeRound = rounds.find(r => r.status === "active" || r.status === "countdown");

  // Auto-complete expired rounds (including old "countdown" status rounds)
  if (activeRound) {
    const now = new Date();
    const questionEnd = new Date(activeRound.questionEndsAt);
    if (now > questionEnd) {
      activeRound.status = "completed";
      await upsertEntity(TABLES.TRIVIA_ROUNDS, activeRound);
      activeRound = null;
    }
  }

  if (activeRound) {
    sendError(context, "A round is already in progress", 400, headers);
    return;
  }

  const question = await generateTriviaQuestion(category, eventContext);
  if (!question) {
    sendError(context, "Failed to generate question", 500, headers);
    return;
  }

  const roundId = generateRowKey("round");
  const now = new Date();
  const countdownEnd = new Date(now.getTime() + 3000);
  const questionEnd = new Date(countdownEnd.getTime() + 30000);

  const round = {
    partitionKey: tripId,
    rowKey: roundId,
    id: roundId,
    status: "active",
    category: category || "general",
    question: question.question,
    answers: JSON.stringify(question.answers),
    correctIndex: question.correctIndex,
    startedAt: now.toISOString(),
    countdownEndsAt: countdownEnd.toISOString(),
    questionEndsAt: questionEnd.toISOString(),
    startedBy: auth.travelerId || auth.userId,
    responses: JSON.stringify([])
  };

  await upsertEntity(TABLES.TRIVIA_ROUNDS, round);
  sendSuccess(context, { round: formatRound(round), countdownMs: 3000 }, 201, headers);
}

async function submitAnswer(context, tripId, body, auth, headers) {
  const { roundId, answerIndex, answeredAt } = body || {};

  if (roundId === undefined || answerIndex === undefined) {
    sendError(context, "Missing roundId or answerIndex", 400, headers);
    return;
  }

  const round = await getEntity(TABLES.TRIVIA_ROUNDS, tripId, roundId);
  if (!round) {
    sendError(context, "Round not found", 404, headers);
    return;
  }
  if (round.status !== "active") {
    sendError(context, "Round is not active", 400, headers);
    return;
  }

  // Validate timing - must be after countdown and before question ends
  const now = new Date();
  const countdownEnd = new Date(round.countdownEndsAt);
  const questionEnd = new Date(round.questionEndsAt);

  if (now < countdownEnd) {
    sendError(context, "Round hasn't started yet", 400, headers);
    return;
  }
  if (now > questionEnd) {
    sendError(context, "Time's up!", 400, headers);
    return;
  }

  const responses = JSON.parse(round.responses || "[]");
  const travelerId = auth.travelerId || auth.userId;

  if (responses.find(r => r.travelerId === travelerId)) {
    sendError(context, "Already answered this round", 400, headers);
    return;
  }

  const now = new Date(answeredAt || Date.now());
  const questionStart = new Date(round.countdownEndsAt);
  const questionEnd = new Date(round.questionEndsAt);
  const timeElapsed = now - questionStart;
  const totalTime = questionEnd - questionStart;

  const isCorrect = answerIndex === round.correctIndex;
  let points = 0;

  if (isCorrect) {
    const speedRatio = Math.max(0, 1 - (timeElapsed / totalTime));
    points = 10 + Math.round(speedRatio * 5);
  }

  responses.push({
    travelerId,
    answerIndex,
    isCorrect,
    points,
    answeredAt: now.toISOString(),
    timeMs: timeElapsed
  });

  round.responses = JSON.stringify(responses);
  await upsertEntity(TABLES.TRIVIA_ROUNDS, round);
  await updateLeaderboard(tripId, travelerId, points, isCorrect);

  sendSuccess(context, { correct: isCorrect, points, correctIndex: round.correctIndex }, 200, headers);
}

async function getLeaderboard(context, tripId, headers) {
  const entries = await queryByPartition(TABLES.TRIVIA_LEADERBOARD, tripId);
  const sorted = entries
    .map(e => ({
      travelerId: e.rowKey,
      displayName: e.displayName,
      totalPoints: e.totalPoints || 0,
      correctAnswers: e.correctAnswers || 0,
      totalAnswers: e.totalAnswers || 0,
      streak: e.streak || 0
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
  sendSuccess(context, { leaderboard: sorted }, 200, headers);
}

async function generateTriviaQuestion(category, eventContext) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not configured");
    return null;
  }

  const categoryPrompts = {
    funny: "Make this a fun, silly question that will make people laugh",
    historical: "Focus on interesting historical facts about the destination",
    food: "Make this about local cuisine, restaurants, or food culture",
    expert: "Make this challenging - something only a travel expert would know",
    general: "Make this an interesting general knowledge question about travel"
  };

  const categoryHint = categoryPrompts[category] || categoryPrompts.general;
  const contextHint = eventContext ? `\n\nContext: ${eventContext}` : "";

  const prompt = `Generate a trivia question about travel, destinations, or culture. ${categoryHint}${contextHint}

Return ONLY valid JSON in this exact format:
{"question": "Your question here?", "answers": ["Option A", "Option B", "Option C", "Option D"], "correctIndex": 0}

Rules:
- correctIndex must be 0, 1, 2, or 3
- All 4 answers must be plausible
- Only output the JSON, nothing else`;

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
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("AI API error:", data);
      return null;
    }

    const content = data.content[0]?.text || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse AI response:", content);
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Question generation error:", err);
    return null;
  }
}

async function updateLeaderboard(tripId, travelerId, points, isCorrect) {
  let entry = await getEntity(TABLES.TRIVIA_LEADERBOARD, tripId, travelerId);

  if (!entry) {
    entry = {
      partitionKey: tripId,
      rowKey: travelerId,
      totalPoints: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      streak: 0
    };
  }

  entry.totalPoints = (entry.totalPoints || 0) + points;
  entry.totalAnswers = (entry.totalAnswers || 0) + 1;

  if (isCorrect) {
    entry.correctAnswers = (entry.correctAnswers || 0) + 1;
    entry.streak = (entry.streak || 0) + 1;
  } else {
    entry.streak = 0;
  }

  await upsertEntity(TABLES.TRIVIA_LEADERBOARD, entry);
}

function formatRound(round) {
  return {
    id: round.id || round.rowKey,
    status: round.status,
    category: round.category,
    question: round.question,
    answers: JSON.parse(round.answers || "[]"),
    startedAt: round.startedAt,
    countdownEndsAt: round.countdownEndsAt,
    questionEndsAt: round.questionEndsAt,
    responses: JSON.parse(round.responses || "[]").length
  };
}
