const sawItHandler = require('./index');

// Mock table storage
jest.mock('../shared/tableStorage', () => ({
  TABLES: {
    SAW_IT_GAMES: 'SawItGames',
    SAW_IT_LISTS: 'SawItLists'
  },
  ensureTable: jest.fn().mockResolvedValue({}),
  getEntity: jest.fn(),
  queryByPartition: jest.fn(),
  upsertEntity: jest.fn().mockResolvedValue({}),
  deleteEntity: jest.fn().mockResolvedValue(true),
  generateRowKey: jest.fn().mockReturnValue('game_123456_abc123')
}));

// Mock validation
jest.mock('../shared/validation', () => ({
  getHeaders: jest.fn().mockReturnValue({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }),
  handleOptions: jest.fn((context) => {
    context.res = { status: 204 };
  }),
  requireTravelerAuth: jest.fn(),
  sendError: jest.fn((context, error, status, headers) => {
    context.res = { status, headers, body: { error } };
  }),
  sendSuccess: jest.fn((context, body, status, headers) => {
    context.res = { status, headers, body };
  })
}));

const { getEntity, upsertEntity, deleteEntity, queryByPartition } = require('../shared/tableStorage');
const { requireTravelerAuth, sendError, sendSuccess } = require('../shared/validation');

describe('Saw It API', () => {
  let context;
  let mockAuth;

  beforeEach(() => {
    context = { res: {}, bindingData: {} };
    mockAuth = {
      tripId: 'trip123',
      travelerId: 'traveler1',
      travelerName: 'Test User',
      isAdmin: false
    };
    requireTravelerAuth.mockResolvedValue(mockAuth);
    jest.clearAllMocks();
  });

  describe('OPTIONS request', () => {
    it('should handle CORS preflight', async () => {
      const req = { method: 'OPTIONS' };
      await sawItHandler(context, req);
      expect(context.res.status).toBe(204);
    });
  });

  describe('GET /game/{eventId}', () => {
    it('should return null id when no game exists', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      getEntity.mockResolvedValue(null);

      await sawItHandler(context, { method: 'GET', query: {} });

      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        { id: null },
        200,
        expect.any(Object)
      );
    });

    it('should return game when it exists', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      const mockGame = {
        id: 'game123',
        tripId: 'trip123',
        eventId: 'event123',
        eventTitle: 'Test Event',
        status: 'active',
        createdBy: 'traveler1',
        items: JSON.stringify([{ id: 'item_1', name: 'Test Item' }]),
        sightings: JSON.stringify([])
      };
      getEntity.mockResolvedValue(mockGame);

      await sawItHandler(context, { method: 'GET', query: {} });

      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        expect.objectContaining({
          id: 'game123',
          eventId: 'event123',
          status: 'active'
        }),
        200,
        expect.any(Object)
      );
    });
  });

  describe('POST /game (create game)', () => {
    it('should reject when eventId is missing', async () => {
      context.bindingData = { action: 'game' };

      await sawItHandler(context, {
        method: 'POST',
        query: {},
        body: { items: [{ id: 'item_1' }] }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'Missing eventId',
        400,
        expect.any(Object)
      );
    });

    it('should reject when items is missing', async () => {
      context.bindingData = { action: 'game' };

      await sawItHandler(context, {
        method: 'POST',
        query: {},
        body: { eventId: 'event123' }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'Missing items',
        400,
        expect.any(Object)
      );
    });

    it('should reject when active game already exists', async () => {
      context.bindingData = { action: 'game' };
      getEntity.mockResolvedValue({ status: 'active' });

      await sawItHandler(context, {
        method: 'POST',
        query: {},
        body: {
          eventId: 'event123',
          items: [{ id: 'item_1', name: 'Test' }]
        }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'A game already exists for this event',
        400,
        expect.any(Object)
      );
    });

    it('should create game successfully', async () => {
      context.bindingData = { action: 'game' };
      getEntity.mockResolvedValue(null);

      await sawItHandler(context, {
        method: 'POST',
        query: {},
        body: {
          eventId: 'event123',
          eventTitle: 'Test Event',
          items: [{ id: 'item_1', name: 'Test Item' }],
          transportMode: 'walk'
        }
      });

      expect(upsertEntity).toHaveBeenCalled();
      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        expect.objectContaining({
          eventId: 'event123',
          status: 'active'
        }),
        201,
        expect.any(Object)
      );
    });
  });

  describe('PUT /game/{eventId} (update game)', () => {
    it('should return 404 when game not found', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      getEntity.mockResolvedValue(null);

      await sawItHandler(context, {
        method: 'PUT',
        query: {},
        body: { action: 'complete' }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'Game not found',
        404,
        expect.any(Object)
      );
    });

    it('should reject when user is not creator or admin', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      getEntity.mockResolvedValue({
        createdBy: 'otherUser',
        status: 'active'
      });
      mockAuth.isAdmin = false;
      mockAuth.travelerId = 'traveler1';

      await sawItHandler(context, {
        method: 'PUT',
        query: {},
        body: { action: 'complete' }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'Only game creator or admin can modify',
        403,
        expect.any(Object)
      );
    });

    it('should complete game when creator requests', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      const mockGame = {
        createdBy: 'traveler1',
        status: 'active',
        items: '[]',
        sightings: '[]'
      };
      getEntity.mockResolvedValue(mockGame);

      await sawItHandler(context, {
        method: 'PUT',
        query: {},
        body: { action: 'complete' }
      });

      expect(upsertEntity).toHaveBeenCalledWith(
        'SawItGames',
        expect.objectContaining({
          status: 'completed'
        })
      );
    });

    it('should delete game on reset action', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      getEntity.mockResolvedValue({
        createdBy: 'traveler1',
        status: 'active'
      });

      await sawItHandler(context, {
        method: 'PUT',
        query: {},
        body: { action: 'reset' }
      });

      expect(deleteEntity).toHaveBeenCalled();
      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        { deleted: true },
        200,
        expect.any(Object)
      );
    });
  });

  describe('POST /list (save personal list)', () => {
    it('should reject when eventId is missing', async () => {
      context.bindingData = { action: 'list' };

      await sawItHandler(context, {
        method: 'POST',
        query: {},
        body: { items: [{ id: 'item_1' }] }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'Missing eventId',
        400,
        expect.any(Object)
      );
    });

    it('should reject when items is missing', async () => {
      context.bindingData = { action: 'list' };

      await sawItHandler(context, {
        method: 'POST',
        query: {},
        body: { eventId: 'event123' }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'Missing items',
        400,
        expect.any(Object)
      );
    });

    it('should save list successfully', async () => {
      context.bindingData = { action: 'list' };

      await sawItHandler(context, {
        method: 'POST',
        query: {},
        body: {
          eventId: 'event123',
          eventTitle: 'Test Event',
          items: [{ id: 'item_1', name: 'Test Item' }],
          transportMode: 'walk'
        }
      });

      expect(upsertEntity).toHaveBeenCalledWith(
        'SawItLists',
        expect.objectContaining({
          eventId: 'event123',
          travelerId: 'traveler1'
        })
      );
      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        expect.objectContaining({
          eventId: 'event123'
        }),
        201,
        expect.any(Object)
      );
    });
  });

  describe('GET /list/{eventId}', () => {
    it('should return null id when no list exists', async () => {
      context.bindingData = { action: 'list', eventId: 'event123' };
      getEntity.mockResolvedValue(null);

      await sawItHandler(context, { method: 'GET', query: {} });

      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        { id: null },
        200,
        expect.any(Object)
      );
    });

    it('should return list when it exists', async () => {
      context.bindingData = { action: 'list', eventId: 'event123' };
      const mockList = {
        rowKey: 'list_event123_traveler1',
        tripId: 'trip123',
        eventId: 'event123',
        eventTitle: 'Test Event',
        travelerId: 'traveler1',
        items: JSON.stringify([{ id: 'item_1', name: 'Test Item' }])
      };
      getEntity.mockResolvedValue(mockList);

      await sawItHandler(context, { method: 'GET', query: {} });

      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        expect.objectContaining({
          eventId: 'event123',
          travelerId: 'traveler1'
        }),
        200,
        expect.any(Object)
      );
    });
  });

  describe('GET /lists', () => {
    it('should return all lists for current user', async () => {
      context.bindingData = { action: 'lists' };
      queryByPartition.mockResolvedValue([
        {
          rowKey: 'list_event1_traveler1',
          eventId: 'event1',
          travelerId: 'traveler1',
          items: '[]'
        },
        {
          rowKey: 'list_event2_traveler1',
          eventId: 'event2',
          travelerId: 'traveler1',
          items: '[]'
        },
        {
          rowKey: 'list_event3_otherUser',
          eventId: 'event3',
          travelerId: 'otherUser',
          items: '[]'
        }
      ]);

      await sawItHandler(context, { method: 'GET', query: {} });

      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        expect.objectContaining({
          eventIds: ['event1', 'event2'],
          lists: expect.arrayContaining([
            expect.objectContaining({ eventId: 'event1' }),
            expect.objectContaining({ eventId: 'event2' })
          ])
        }),
        200,
        expect.any(Object)
      );
    });
  });

  describe('Points calculation', () => {
    it('should award maximum points to first spotter', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      const mockGame = {
        status: 'active',
        items: JSON.stringify([{ id: 'item_1', name: 'Test Item' }]),
        sightings: JSON.stringify([])
      };
      getEntity.mockResolvedValue(mockGame);

      await sawItHandler(context, {
        method: 'POST',
        query: { subAction: 'sight' },
        body: { itemId: 'item_1' }
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        expect.objectContaining({
          points: 4 // Default traveler count is 4
        }),
        200,
        expect.any(Object)
      );
    });

    it('should award fewer points to subsequent spotters', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      const mockGame = {
        status: 'active',
        items: JSON.stringify([{ id: 'item_1', name: 'Test Item' }]),
        sightings: JSON.stringify([
          { itemId: 'item_1', travelerId: 'otherUser', points: 4 }
        ])
      };
      getEntity.mockResolvedValue(mockGame);

      await sawItHandler(context, {
        method: 'POST',
        query: { subAction: 'sight' },
        body: { itemId: 'item_1' }
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        context,
        expect.objectContaining({
          points: 3 // Second spotter gets 3 points
        }),
        200,
        expect.any(Object)
      );
    });

    it('should reject duplicate sighting from same user', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      const mockGame = {
        status: 'active',
        items: JSON.stringify([{ id: 'item_1', name: 'Test Item' }]),
        sightings: JSON.stringify([
          { itemId: 'item_1', travelerId: 'traveler1', points: 4 }
        ])
      };
      getEntity.mockResolvedValue(mockGame);

      await sawItHandler(context, {
        method: 'POST',
        query: { subAction: 'sight' },
        body: { itemId: 'item_1' }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'You already spotted this item',
        400,
        expect.any(Object)
      );
    });
  });

  describe('Social share', () => {
    it('should mark sighting as shared', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      const mockGame = {
        status: 'active',
        items: JSON.stringify([{ id: 'item_1', name: 'Test Item' }]),
        sightings: JSON.stringify([
          { itemId: 'item_1', travelerId: 'traveler1', sharedToSocial: false }
        ])
      };
      getEntity.mockResolvedValue(mockGame);

      await sawItHandler(context, {
        method: 'POST',
        query: { subAction: 'share' },
        body: { itemId: 'item_1' }
      });

      expect(upsertEntity).toHaveBeenCalledWith(
        'SawItGames',
        expect.objectContaining({
          sightings: expect.stringContaining('"sharedToSocial":true')
        })
      );
    });

    it('should reject if already shared', async () => {
      context.bindingData = { action: 'game', eventId: 'event123' };
      const mockGame = {
        status: 'active',
        items: JSON.stringify([{ id: 'item_1', name: 'Test Item' }]),
        sightings: JSON.stringify([
          { itemId: 'item_1', travelerId: 'traveler1', sharedToSocial: true }
        ])
      };
      getEntity.mockResolvedValue(mockGame);

      await sawItHandler(context, {
        method: 'POST',
        query: { subAction: 'share' },
        body: { itemId: 'item_1' }
      });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'Already shared',
        400,
        expect.any(Object)
      );
    });
  });

  describe('Unknown action', () => {
    it('should return 404 for unknown action', async () => {
      context.bindingData = { action: 'unknown' };

      await sawItHandler(context, { method: 'GET', query: {} });

      expect(sendError).toHaveBeenCalledWith(
        context,
        'Unknown action: unknown',
        404,
        expect.any(Object)
      );
    });
  });
});
