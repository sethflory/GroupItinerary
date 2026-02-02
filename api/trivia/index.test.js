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

const { queryByPartition } = require('../shared/tableStorage');
const { requireTravelerAuth, sendSuccess, sendError } = require('../shared/validation');

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
