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
      case "score":
        if (req.method === "POST") return await manualScore(context, tripId, req.body, auth, headers);
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
    // Check for recently completed round (within last 5 minutes) for manual scoring
    const recentRound = rounds
      .filter(r => r.status === "completed")
      .sort((a, b) => new Date(b.questionEndsAt) - new Date(a.questionEndsAt))[0];

    if (recentRound) {
      const completedAt = new Date(recentRound.questionEndsAt);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (completedAt > fiveMinutesAgo) {
        sendSuccess(context, {
          active: false,
          recentRound: formatRound(recentRound, true)
        }, 200, headers);
        return;
      }
    }

    sendSuccess(context, { active: false }, 200, headers);
    return;
  }

  // Auto-complete expired rounds (including old "countdown" status rounds)
  const now = new Date();
  const questionEnd = new Date(activeRound.questionEndsAt);

  if (now > questionEnd) {
    activeRound.status = "completed";
    await upsertEntity(TABLES.TRIVIA_ROUNDS, activeRound);
    // Return the completed round for manual scoring
    sendSuccess(context, {
      active: false,
      recentRound: formatRound(activeRound, true)
    }, 200, headers);
    return;
  }

  sendSuccess(context, { active: true, round: formatRound(activeRound) }, 200, headers);
}

async function startRound(context, tripId, body, auth, headers) {
  const { category, eventContext } = body || {};

  console.log("[Trivia] Starting round for trip:", tripId, "category:", category);

  let rounds = [];
  try {
    rounds = await queryByPartition(TABLES.TRIVIA_ROUNDS, tripId);
    console.log("[Trivia] Found", rounds.length, "existing rounds");
  } catch (err) {
    console.error("[Trivia] Error querying rounds:", err);
    // Continue with empty rounds array - table might not exist yet
  }

  let activeRound = rounds.find(r => r.status === "active" || r.status === "countdown");

  // Auto-complete expired rounds (including old "countdown" status rounds)
  if (activeRound) {
    const now = new Date();
    const questionEnd = new Date(activeRound.questionEndsAt);
    if (now > questionEnd) {
      console.log("[Trivia] Auto-completing expired round:", activeRound.rowKey);
      activeRound.status = "completed";
      try {
        await upsertEntity(TABLES.TRIVIA_ROUNDS, activeRound);
      } catch (err) {
        console.error("[Trivia] Error completing expired round:", err);
      }
      activeRound = null;
    }
  }

  if (activeRound) {
    sendError(context, "A round is already in progress", 400, headers);
    return;
  }

  console.log("[Trivia] Generating question...");
  const question = await generateTriviaQuestion(category, eventContext);
  console.log("[Trivia] Question generated:", question ? "success" : "failed");

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

  console.log("[Trivia] Saving round:", roundId);
  try {
    await upsertEntity(TABLES.TRIVIA_ROUNDS, round);
    console.log("[Trivia] Round saved successfully");
  } catch (err) {
    console.error("[Trivia] Error saving round:", err);
    sendError(context, "Failed to save round: " + err.message, 500, headers);
    return;
  }

  sendSuccess(context, { round: formatRound(round), countdownMs: 3000 }, 201, headers);
}

async function submitAnswer(context, tripId, body, auth, headers) {
  console.log("[Trivia] submitAnswer called with body:", JSON.stringify(body));
  const { roundId, answerIndex, answeredAt } = body || {};

  console.log("[Trivia] Extracted roundId:", roundId, "type:", typeof roundId);

  if (!roundId || roundId === "undefined" || answerIndex === undefined) {
    sendError(context, "Missing roundId or answerIndex. roundId=" + roundId, 400, headers);
    return;
  }

  console.log("[Trivia] Getting round from table storage:", tripId, roundId);
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

  const answerTime = new Date(answeredAt || Date.now());
  const questionStart = new Date(round.countdownEndsAt);
  const timeElapsed = answerTime - questionStart;
  const totalTime = questionEnd - questionStart;

  // Ensure numeric comparison (table storage might return different types)
  const correctIdx = Number(round.correctIndex);
  const submittedIdx = Number(answerIndex);
  console.log("[Trivia] Comparing answer:", submittedIdx, "vs correct:", correctIdx);

  const isCorrect = submittedIdx === correctIdx;
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
    answeredAt: answerTime.toISOString(),
    timeMs: timeElapsed
  });

  round.responses = JSON.stringify(responses);
  await upsertEntity(TABLES.TRIVIA_ROUNDS, round);
  await updateLeaderboard(tripId, travelerId, points, isCorrect);

  sendSuccess(context, { correct: isCorrect, points, correctIndex: correctIdx }, 200, headers);
}

async function manualScore(context, tripId, body, auth, headers) {
  const { roundId, travelerId, travelerName, isCorrect } = body || {};

  if (!roundId || !travelerId) {
    sendError(context, "Missing roundId or travelerId", 400, headers);
    return;
  }

  const round = await getEntity(TABLES.TRIVIA_ROUNDS, tripId, roundId);
  if (!round) {
    sendError(context, "Round not found", 404, headers);
    return;
  }

  // Only allow manual scoring by the person who started the round
  const startedBy = round.startedBy;
  const currentUser = auth.travelerId || auth.userId;
  if (startedBy !== currentUser) {
    sendError(context, "Only the round starter can add manual scores", 403, headers);
    return;
  }

  const responses = JSON.parse(round.responses || "[]");

  // Check if this traveler already has a response
  if (responses.find(r => r.travelerId === travelerId)) {
    sendError(context, "This traveler already has a response", 400, headers);
    return;
  }

  // Award base points for correct answers (no speed bonus for manual)
  const points = isCorrect ? 10 : 0;

  responses.push({
    travelerId,
    travelerName: travelerName || travelerId,
    answerIndex: -1, // Manual entry
    isCorrect,
    points,
    answeredAt: new Date().toISOString(),
    manual: true
  });

  round.responses = JSON.stringify(responses);
  await upsertEntity(TABLES.TRIVIA_ROUNDS, round);
  await updateLeaderboard(tripId, travelerId, points, isCorrect, travelerName);

  sendSuccess(context, { success: true, points }, 200, headers);
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

// Fallback questions when AI is unavailable
const FALLBACK_QUESTIONS = {
  general: [
    { question: "Which country has the most UNESCO World Heritage Sites?", answers: ["Italy", "China", "Spain", "France"], correctIndex: 0 },
    { question: "What is the smallest country in the world?", answers: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"], correctIndex: 1 },
    { question: "Which city is known as the 'City of Light'?", answers: ["London", "New York", "Paris", "Tokyo"], correctIndex: 2 },
    { question: "What is the longest river in the world?", answers: ["Amazon", "Nile", "Yangtze", "Mississippi"], correctIndex: 1 },
  ],
  funny: [
    { question: "In Japan, it's considered good luck if a bird does what on you?", answers: ["Sings to you", "Lands on your head", "Poops on you", "Follows you"], correctIndex: 2 },
    { question: "What unusual item is it illegal to carry in your suitcase in some US states?", answers: ["Cheese", "Ice cream cone in back pocket", "Rubber ducks", "Socks"], correctIndex: 1 },
    { question: "In Switzerland, it's illegal to do what after 10pm?", answers: ["Yodel", "Flush the toilet", "Eat chocolate", "Walk loudly"], correctIndex: 1 },
  ],
  food: [
    { question: "Which country invented pizza?", answers: ["United States", "Italy", "Greece", "France"], correctIndex: 1 },
    { question: "What is the national dish of Spain?", answers: ["Tacos", "Paella", "Sushi", "Curry"], correctIndex: 1 },
    { question: "In which country would you find the original croissant?", answers: ["France", "Austria", "Belgium", "Switzerland"], correctIndex: 1 },
  ],
  historical: [
    { question: "Which ancient wonder was located in Alexandria, Egypt?", answers: ["Hanging Gardens", "Colossus", "Lighthouse", "Great Pyramid"], correctIndex: 2 },
    { question: "The Silk Road connected China to which region?", answers: ["Africa", "Mediterranean", "Australia", "Americas"], correctIndex: 1 },
    { question: "Which empire built Machu Picchu?", answers: ["Aztec", "Maya", "Inca", "Olmec"], correctIndex: 2 },
  ],
  expert: [
    { question: "What is the driest place on Earth?", answers: ["Sahara Desert", "Atacama Desert", "McMurdo Dry Valleys", "Death Valley"], correctIndex: 2 },
    { question: "Which airport has the code 'SIN'?", answers: ["Singapore Changi", "Sydney", "Shanghai", "Seoul Incheon"], correctIndex: 0 },
    { question: "What is the only country to span both Europe and Asia with its largest city?", answers: ["Russia", "Turkey", "Kazakhstan", "Georgia"], correctIndex: 1 },
  ]
};

function getRandomFallbackQuestion(category) {
  const questions = FALLBACK_QUESTIONS[category] || FALLBACK_QUESTIONS.general;
  return questions[Math.floor(Math.random() * questions.length)];
}

async function generateTriviaQuestion(category, eventContext) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("ANTHROPIC_API_KEY not configured, using fallback question");
    return getRandomFallbackQuestion(category);
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
      return getRandomFallbackQuestion(category);
    }

    const content = data.content[0]?.text || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse AI response:", content);
      return getRandomFallbackQuestion(category);
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Question generation error:", err);
    return getRandomFallbackQuestion(category);
  }
}

async function updateLeaderboard(tripId, travelerId, points, isCorrect, displayName = null) {
  let entry = await getEntity(TABLES.TRIVIA_LEADERBOARD, tripId, travelerId);

  if (!entry) {
    entry = {
      partitionKey: tripId,
      rowKey: travelerId,
      displayName: displayName || travelerId,
      totalPoints: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      streak: 0
    };
  }

  // Update display name if provided
  if (displayName) {
    entry.displayName = displayName;
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

function formatRound(round, includeAnswers = false) {
  const responses = JSON.parse(round.responses || "[]");
  const result = {
    id: round.id || round.rowKey,
    status: round.status,
    category: round.category,
    question: round.question,
    answers: JSON.parse(round.answers || "[]"),
    startedAt: round.startedAt,
    countdownEndsAt: round.countdownEndsAt,
    questionEndsAt: round.questionEndsAt,
    startedBy: round.startedBy,
    responseCount: responses.length,
    responses: responses.map(r => ({
      travelerId: r.travelerId,
      travelerName: r.travelerName,
      isCorrect: r.isCorrect,
      points: r.points,
      manual: r.manual || false
    }))
  };

  // Include correct answer index after round ends or for the starter
  if (includeAnswers || round.status === "completed") {
    result.correctIndex = round.correctIndex;
  }

  return result;
}
