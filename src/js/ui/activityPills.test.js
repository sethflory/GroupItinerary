// Mock dependencies
jest.mock('../state.js', () => ({
  currentTripId: 'test-trip'
}));

jest.mock('../config.js', () => ({
  API_BASE: '/api'
}));

jest.mock('../auth.js', () => ({
  getStoredAccessCode: jest.fn(() => 'test-access-code')
}));

jest.mock('../api.js', () => ({
  fetchActiveHunt: jest.fn()
}));

// Mock fetch globally
global.fetch = jest.fn();

import { getStoredAccessCode } from '../auth.js';
import { fetchActiveHunt } from '../api.js';

describe('Activity Pills - Trivia Integration', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup DOM
    document.body.innerHTML = '<div id="activityPills"></div>';
    
    // Mock fetch to return empty responses by default
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ games: [], polls: [] })
    });
    
    // Mock fetchActiveHunt to return null by default
    fetchActiveHunt.mockResolvedValue({ hunt: null });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should fetch active trivia round from API', async () => {
    const activityPillsModule = await import('./activityPills.js');
    
    // Mock API responses
    global.fetch.mockImplementation((url) => {
      if (url.includes('/trivia/rounds')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            active: true,
            round: {
              id: 'round-123',
              question: 'Test question?',
              category: 'general',
              status: 'active',
              responseCount: 2
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ games: [], polls: [] })
      });
    });

    // Trigger activity refresh
    await activityPillsModule.startActivityPolling(100);
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 150));

    // Verify trivia API was called with correct parameters
    const triviaCalls = Array.from(global.fetch.mock.calls).filter(call => 
      call[0].includes('/trivia/rounds')
    );
    expect(triviaCalls.length).toBeGreaterThan(0);
    expect(triviaCalls[0][0]).toContain('test-trip');
    expect(triviaCalls[0][0]).toContain('accessCode=test-access-code');
    
    activityPillsModule.stopActivityPolling();
  });

  it('should render trivia pill when round is active', async () => {
    const activityPillsModule = await import('./activityPills.js');
    
    // Mock active trivia round
    global.fetch.mockImplementation((url) => {
      if (url.includes('/trivia/rounds')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            active: true,
            round: {
              id: 'round-123',
              question: 'What is the capital of Greece?',
              category: 'general',
              status: 'active',
              responseCount: 3
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ games: [], polls: [] })
      });
    });

    // Start polling
    await activityPillsModule.startActivityPolling(100);
    
    // Wait for async operations and DOM updates
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check if trivia pill was rendered
    const container = document.getElementById('activityPills');
    const triviaPill = container.querySelector('.activity-pill.trivia');
    
    expect(triviaPill).toBeTruthy();
    expect(triviaPill.textContent).toContain('Trip Trivia');
    expect(triviaPill.textContent).toContain('3'); // response count
    
    activityPillsModule.stopActivityPolling();
  });

  it('should not render trivia pill when no round is active', async () => {
    const activityPillsModule = await import('./activityPills.js');
    
    // Mock no active trivia round
    global.fetch.mockImplementation((url) => {
      if (url.includes('/trivia/rounds')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ active: false })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ games: [], polls: [] })
      });
    });

    // Start polling
    await activityPillsModule.startActivityPolling(100);
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check that trivia pill was not rendered
    const container = document.getElementById('activityPills');
    const triviaPill = container.querySelector('.activity-pill.trivia');
    
    expect(triviaPill).toBeFalsy();
    
    activityPillsModule.stopActivityPolling();
  });

  it('should show correct category emoji for different trivia categories', async () => {
    const activityPillsModule = await import('./activityPills.js');
    
    const categories = [
      { category: 'general', emoji: '🌍' },
      { category: 'funny', emoji: '😄' },
      { category: 'historical', emoji: '🏛️' },
      { category: 'food', emoji: '🍽️' },
      { category: 'expert', emoji: '🎓' }
    ];

    for (const { category, emoji } of categories) {
      // Clear container
      document.getElementById('activityPills').innerHTML = '';
      
      // Mock trivia round with specific category
      global.fetch.mockImplementation((url) => {
        if (url.includes('/trivia/rounds')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              active: true,
              round: {
                id: 'round-123',
                question: 'Test question?',
                category: category,
                status: 'active',
                responseCount: 1
              }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ games: [], polls: [] })
        });
      });

      // Refresh activities
      await activityPillsModule.startActivityPolling(100);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check emoji
      const container = document.getElementById('activityPills');
      const triviaPill = container.querySelector('.activity-pill.trivia');
      
      expect(triviaPill).toBeTruthy();
      expect(triviaPill.querySelector('.pill-icon').textContent).toBe(emoji);
      
      activityPillsModule.stopActivityPolling();
    }
  });

  it('should handle API errors gracefully', async () => {
    const activityPillsModule = await import('./activityPills.js');
    
    // Mock API error
    global.fetch.mockImplementation((url) => {
      if (url.includes('/trivia/rounds')) {
        return Promise.resolve({
          ok: false,
          status: 500
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ games: [], polls: [] })
      });
    });

    // Should not throw error
    expect(() => activityPillsModule.startActivityPolling(100)).not.toThrow();
    
    await new Promise(resolve => setTimeout(resolve, 150));

    // Container should exist but no trivia pill
    const container = document.getElementById('activityPills');
    expect(container).toBeTruthy();
    
    activityPillsModule.stopActivityPolling();
  });
});
