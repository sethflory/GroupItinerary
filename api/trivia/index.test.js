const triviaHandler = require('./index');

// Mock the shared modules
jest.mock('../shared/tableStorage', () => ({
  TABLES: {
    TRIVIA_ROUNDS: 'TriviaRounds',
    TRIVIA_LEADERBOARD: 'TriviaLeaderboard',
    TRAVELERS: 'Travelers',
  },
  getEntity: jest.fn(),
  queryByPartition: jest.fn(),
  upsertEntity: jest.fn(),
  generateRowKey: jest.fn(),
}));

jest.mock('../shared/validation', () => ({
  getHeaders: jest.fn(() => ({ 'Content-Type': 'application/json' })),
  handleOptions: jest.fn(),
  requireTravelerAuth: jest.fn(),
  sendError: jest.fn(),
  sendSuccess: jest.fn(),
}));

jest.mock('../notifications/index', () => ({
  createNotificationInternal: jest.fn().mockResolvedValue({}),
}));

const { queryByPartition } = require('../shared/tableStorage');
const { requireTravelerAuth, sendSuccess, sendError } = require('../shared/validation');
const { createNotificationInternal } = require('../notifications/index');

describe('Trivia API - Error Handling', () => {
  let context;
  let req;

  beforeEach(() => {
    context = {
      bindingData: {
        tripId: 'test-trip',
        action: 'rounds',
      },
      res: {},
    };
    req = {
      method: 'GET',
      query: {},
      body: {},
    };
    jest.clearAllMocks();
  });

  test('GET /rounds should handle missing TRIVIA_ROUNDS table gracefully', async () => {
    // Simulate table not found error (typical Azure Table Storage error)
    const tableNotFoundError = new Error('Table not found');
    tableNotFoundError.statusCode = 404;
    queryByPartition.mockRejectedValueOnce(tableNotFoundError);
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler' 
    });

    await triviaHandler(context, req);

    // Should return success with active: false, not a 500 error
    expect(sendSuccess).toHaveBeenCalledWith(
      context,
      { active: false },
      200,
      expect.any(Object)
    );
    expect(sendError).not.toHaveBeenCalled();
  });

  test('GET /leaderboard should handle missing TRIVIA_LEADERBOARD table gracefully', async () => {
    context.bindingData.action = 'leaderboard';
    
    // Simulate table not found error
    const tableNotFoundError = new Error('Table not found');
    tableNotFoundError.statusCode = 404;
    queryByPartition.mockRejectedValueOnce(tableNotFoundError);
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler' 
    });

    await triviaHandler(context, req);

    // Should return success with empty leaderboard, not a 500 error
    expect(sendSuccess).toHaveBeenCalledWith(
      context,
      { leaderboard: [] },
      200,
      expect.any(Object)
    );
    expect(sendError).not.toHaveBeenCalled();
  });

  test('GET /rounds should return active round when table exists', async () => {
    // Mock successful query with an active round
    queryByPartition.mockResolvedValueOnce([
      {
        rowKey: 'round-123',
        id: 'round-123',
        status: 'active',
        category: 'general',
        question: 'Test question?',
        answers: JSON.stringify(['A', 'B', 'C', 'D']),
        correctIndex: 0,
        startedAt: new Date().toISOString(),
        countdownEndsAt: new Date(Date.now() - 1000).toISOString(),
        questionEndsAt: new Date(Date.now() + 30000).toISOString(),
        startedBy: 'test-user',
        responses: JSON.stringify([]),
      }
    ]);
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler' 
    });

    await triviaHandler(context, req);

    // Should return the active round
    expect(sendSuccess).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        active: true,
        round: expect.objectContaining({
          id: 'round-123',
          status: 'active',
        }),
      }),
      200,
      expect.any(Object)
    );
  });

  test('GET /leaderboard should return entries when table exists', async () => {
    context.bindingData.action = 'leaderboard';
    
    // Mock successful query with leaderboard entries
    queryByPartition.mockResolvedValueOnce([
      {
        rowKey: 'traveler-1',
        displayName: 'Alice',
        totalPoints: 100,
        correctAnswers: 10,
        totalAnswers: 15,
        streak: 3,
      },
      {
        rowKey: 'traveler-2',
        displayName: 'Bob',
        totalPoints: 50,
        correctAnswers: 5,
        totalAnswers: 10,
        streak: 0,
      }
    ]);
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler' 
    });

    await triviaHandler(context, req);

    // Should return sorted leaderboard
    expect(sendSuccess).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        leaderboard: expect.arrayContaining([
          expect.objectContaining({
            travelerId: 'traveler-1',
            displayName: 'Alice',
            totalPoints: 100,
          }),
          expect.objectContaining({
            travelerId: 'traveler-2',
            displayName: 'Bob',
            totalPoints: 50,
          }),
        ]),
      }),
      200,
      expect.any(Object)
    );
  });

  test('GET /rounds should return travelers with recent round for manual scoring', async () => {
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    
    // Mock a recently completed round
    queryByPartition
      .mockResolvedValueOnce([
        {
          rowKey: 'round-456',
          id: 'round-456',
          status: 'completed',
          category: 'general',
          question: 'Completed question?',
          answers: JSON.stringify(['A', 'B', 'C', 'D']),
          correctIndex: 2,
          startedAt: new Date(twoMinutesAgo.getTime() - 33000).toISOString(),
          countdownEndsAt: new Date(twoMinutesAgo.getTime() - 30000).toISOString(),
          questionEndsAt: twoMinutesAgo.toISOString(),
          startedBy: 'test-user',
          responses: JSON.stringify([
            { travelerId: 'traveler-1', isCorrect: true, points: 10 }
          ]),
        }
      ])
      // Mock travelers query
      .mockResolvedValueOnce([
        {
          rowKey: 'traveler-1',
          name: 'Alice',
          initials: 'AL',
          group: 'GroupA',
          color: '#FF0000',
        },
        {
          rowKey: 'traveler-2',
          name: 'Bob',
          initials: 'BB',
          group: 'GroupB',
          color: '#00FF00',
        }
      ]);
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler' 
    });

    await triviaHandler(context, req);

    // Should return the recent round with travelers list
    expect(sendSuccess).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        active: false,
        recentRound: expect.objectContaining({
          id: 'round-456',
          status: 'completed',
          correctIndex: 2,
        }),
        travelers: expect.arrayContaining([
          expect.objectContaining({
            id: 'traveler-1',
            name: 'Alice',
          }),
          expect.objectContaining({
            id: 'traveler-2',
            name: 'Bob',
          }),
        ]),
      }),
      200,
      expect.any(Object)
    );
  });
});

describe('Trivia API - LLM Integration', () => {
  let context;
  let req;
  let originalEnv;
  let originalFetch;

  beforeEach(() => {
    context = {
      bindingData: {
        tripId: 'test-trip',
        action: 'rounds',
      },
      res: {},
    };
    req = {
      method: 'POST',
      query: {},
      body: {
        category: 'general',
        eventContext: 'Athens, Greece'
      },
    };
    
    // Save original environment and fetch
    originalEnv = process.env.ANTHROPIC_API_KEY;
    originalFetch = global.fetch;
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment and fetch
    if (originalEnv) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    global.fetch = originalFetch;
  });

  test('POST /rounds should fail when ANTHROPIC_API_KEY is not configured', async () => {
    const { queryByPartition, generateRowKey } = require('../shared/tableStorage');
    
    // Remove API key
    delete process.env.ANTHROPIC_API_KEY;
    
    // Mock no active rounds
    queryByPartition.mockResolvedValueOnce([]);
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler' 
    });

    await triviaHandler(context, req);

    // Should return error when API key is missing
    expect(sendError).toHaveBeenCalledWith(
      context,
      'ANTHROPIC_API_KEY is required for trivia question generation. Please configure the API key in application settings.',
      500,
      expect.any(Object)
    );
  });

  test('POST /rounds should successfully generate question with valid API key', async () => {
    const { queryByPartition, generateRowKey, upsertEntity } = require('../shared/tableStorage');
    
    // Set API key
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    
    // Mock fetch to simulate successful Anthropic API call
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          text: '{"question": "What is the capital of Greece?", "answers": ["Athens", "Sparta", "Corinth", "Thebes"], "correctIndex": 0}'
        }]
      })
    });
    
    // Mock no active rounds
    queryByPartition.mockResolvedValueOnce([]);
    
    // Mock generateRowKey
    generateRowKey.mockReturnValueOnce('round-123');
    
    // Mock successful upsert
    upsertEntity.mockResolvedValueOnce({});
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler' 
    });

    await triviaHandler(context, req);

    // Should successfully create round
    expect(sendSuccess).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        round: expect.objectContaining({
          question: 'What is the capital of Greece?',
          category: 'general',
        }),
        countdownMs: 3000,
      }),
      201,
      expect.any(Object)
    );
    
    // Verify fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-api-key',
          'anthropic-version': '2023-06-01',
        }),
      })
    );
  });

  test('POST /rounds should fail gracefully when Anthropic API returns error', async () => {
    const { queryByPartition } = require('../shared/tableStorage');
    
    // Set API key
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    
    // Mock fetch to simulate API error
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: 'Invalid API key' }
      })
    });
    
    // Mock no active rounds
    queryByPartition.mockResolvedValueOnce([]);
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler' 
    });

    await triviaHandler(context, req);

    // Should return error
    expect(sendError).toHaveBeenCalledWith(
      context,
      'Anthropic API error: Invalid API key',
      500,
      expect.any(Object)
    );
  });
});

describe('Trivia API - Notification Integration', () => {
  let context;
  let req;
  let originalEnv;
  let originalFetch;

  beforeEach(() => {
    context = {
      bindingData: {
        tripId: 'test-trip',
        action: 'rounds',
      },
      res: {},
    };
    req = {
      method: 'POST',
      query: {},
      body: {
        category: 'general',
      },
    };
    
    // Save original environment and fetch
    originalEnv = process.env.ANTHROPIC_API_KEY;
    originalFetch = global.fetch;
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment and fetch
    if (originalEnv) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    global.fetch = originalFetch;
  });

  test('POST /rounds should send notification when round starts', async () => {
    const { queryByPartition, generateRowKey, upsertEntity } = require('../shared/tableStorage');
    
    // Set API key
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    
    // Mock fetch to simulate successful Anthropic API call
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{
          text: '{"question": "Test question?", "answers": ["A", "B", "C", "D"], "correctIndex": 0}'
        }]
      })
    });
    
    // Mock no active rounds
    queryByPartition.mockResolvedValueOnce([]);
    
    // Mock generateRowKey
    generateRowKey.mockReturnValueOnce('round-123');
    
    // Mock successful upsert
    upsertEntity.mockResolvedValueOnce({});
    
    // Mock successful auth with traveler name
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler',
      travelerName: 'Alice'
    });

    await triviaHandler(context, req);

    // Should send notification
    expect(createNotificationInternal).toHaveBeenCalledWith(
      'test-trip',
      'trivia_starting',
      'Alice started a general trivia round!',
      expect.objectContaining({
        relatedId: 'round-123',
        travelerId: 'test-traveler',
        travelerName: 'Alice',
      })
    );
  });

  test('POST /answer should send notification for correct answers', async () => {
    const { getEntity, upsertEntity } = require('../shared/tableStorage');
    
    context.bindingData.action = 'answer';
    req.method = 'POST';
    req.body = {
      roundId: 'round-123',
      answerIndex: 0,
      answeredAt: new Date().toISOString()
    };

    // Mock active round
    const now = new Date();
    const questionEnd = new Date(now.getTime() + 10000);
    getEntity.mockResolvedValueOnce({
      rowKey: 'round-123',
      id: 'round-123',
      status: 'active',
      question: 'Test question?',
      answers: JSON.stringify(['A', 'B', 'C', 'D']),
      correctIndex: 0,
      countdownEndsAt: new Date(now.getTime() - 1000).toISOString(),
      questionEndsAt: questionEnd.toISOString(),
      responses: JSON.stringify([])
    });

    // Mock leaderboard update
    getEntity.mockResolvedValueOnce(null); // No existing leaderboard entry
    upsertEntity.mockResolvedValue({});
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler',
      travelerName: 'Bob'
    });

    await triviaHandler(context, req);

    // Should send notification for correct answer
    expect(createNotificationInternal).toHaveBeenCalledWith(
      'test-trip',
      'trivia_answer',
      expect.stringContaining('Bob answered correctly!'),
      expect.objectContaining({
        relatedId: 'round-123',
        travelerId: 'test-traveler',
        travelerName: 'Bob',
      })
    );
  });

  test('POST /answer should not send notification for incorrect answers', async () => {
    const { getEntity, upsertEntity } = require('../shared/tableStorage');
    
    context.bindingData.action = 'answer';
    req.method = 'POST';
    req.body = {
      roundId: 'round-123',
      answerIndex: 1, // Wrong answer
      answeredAt: new Date().toISOString()
    };

    // Mock active round
    const now = new Date();
    const questionEnd = new Date(now.getTime() + 10000);
    getEntity.mockResolvedValueOnce({
      rowKey: 'round-123',
      id: 'round-123',
      status: 'active',
      question: 'Test question?',
      answers: JSON.stringify(['A', 'B', 'C', 'D']),
      correctIndex: 0, // Correct answer is index 0
      countdownEndsAt: new Date(now.getTime() - 1000).toISOString(),
      questionEndsAt: questionEnd.toISOString(),
      responses: JSON.stringify([])
    });

    // Mock leaderboard update
    getEntity.mockResolvedValueOnce(null);
    upsertEntity.mockResolvedValue({});
    
    // Mock successful auth
    requireTravelerAuth.mockResolvedValueOnce({ 
      valid: true, 
      tripId: 'test-trip',
      travelerId: 'test-traveler',
      travelerName: 'Charlie'
    });

    await triviaHandler(context, req);

    // Should NOT send notification for incorrect answer
    expect(createNotificationInternal).not.toHaveBeenCalled();
  });
});
