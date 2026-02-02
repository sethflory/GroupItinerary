// Mock the state module
jest.mock('./state.js', () => ({
  TRAVELERS: [],
  TRAVELER_INITIALS: {},
  currentTravelerFilter: 'all'
}));

import { countTripMemoryPhotos } from './utils.js';

describe('countTripMemoryPhotos', () => {
  it('should return 0 for empty days array', () => {
    expect(countTripMemoryPhotos([])).toBe(0);
    expect(countTripMemoryPhotos(null)).toBe(0);
    expect(countTripMemoryPhotos(undefined)).toBe(0);
  });

  it('should return 0 for days without events', () => {
    const days = [
      { date: '2025-06-15', location: 'athens' },
      { date: '2025-06-16', location: 'athens' }
    ];
    expect(countTripMemoryPhotos(days)).toBe(0);
  });

  it('should return 0 for events without linked photos', () => {
    const days = [
      {
        date: '2025-06-15',
        events: [
          { title: 'Event 1', type: 'activity' },
          { title: 'Event 2', type: 'meal' }
        ]
      }
    ];
    expect(countTripMemoryPhotos(days)).toBe(0);
  });

  it('should count single event with linkedPhotoUrl', () => {
    const days = [
      {
        date: '2025-06-15',
        events: [
          { title: 'Event 1', linkedPhotoUrl: 'https://example.com/photo1.jpg' }
        ]
      }
    ];
    expect(countTripMemoryPhotos(days)).toBe(1);
  });

  it('should count multiple events with unique linkedPhotoUrls', () => {
    const days = [
      {
        date: '2025-06-15',
        events: [
          { title: 'Event 1', linkedPhotoUrl: 'https://example.com/photo1.jpg' },
          { title: 'Event 2', linkedPhotoUrl: 'https://example.com/photo2.jpg' }
        ]
      },
      {
        date: '2025-06-16',
        events: [
          { title: 'Event 3', linkedPhotoUrl: 'https://example.com/photo3.jpg' }
        ]
      }
    ];
    expect(countTripMemoryPhotos(days)).toBe(3);
  });

  it('should not count duplicate linkedPhotoUrls', () => {
    const days = [
      {
        date: '2025-06-15',
        events: [
          { title: 'Event 1', linkedPhotoUrl: 'https://example.com/photo1.jpg' },
          { title: 'Event 2', linkedPhotoUrl: 'https://example.com/photo1.jpg' }
        ]
      }
    ];
    expect(countTripMemoryPhotos(days)).toBe(1);
  });

  it('should count photos from linkedPhotos array', () => {
    const days = [
      {
        date: '2025-06-15',
        events: [
          {
            title: 'Event 1',
            linkedPhotos: [
              'https://example.com/photo1.jpg',
              'https://example.com/photo2.jpg'
            ]
          }
        ]
      }
    ];
    expect(countTripMemoryPhotos(days)).toBe(2);
  });

  it('should count both linkedPhotoUrl and linkedPhotos array without duplicates', () => {
    const days = [
      {
        date: '2025-06-15',
        events: [
          {
            title: 'Event 1',
            linkedPhotoUrl: 'https://example.com/photo1.jpg',
            linkedPhotos: [
              'https://example.com/photo1.jpg',
              'https://example.com/photo2.jpg'
            ]
          }
        ]
      }
    ];
    // Should count unique photos only: photo1 and photo2 = 2
    expect(countTripMemoryPhotos(days)).toBe(2);
  });

  it('should handle mixed events with and without photos', () => {
    const days = [
      {
        date: '2025-06-15',
        events: [
          { title: 'Event 1', type: 'activity' },
          { title: 'Event 2', linkedPhotoUrl: 'https://example.com/photo1.jpg' },
          { title: 'Event 3', type: 'meal' },
          {
            title: 'Event 4',
            linkedPhotos: ['https://example.com/photo2.jpg']
          }
        ]
      }
    ];
    expect(countTripMemoryPhotos(days)).toBe(2);
  });

  it('should handle empty strings and null values in linkedPhotos', () => {
    const days = [
      {
        date: '2025-06-15',
        events: [
          {
            title: 'Event 1',
            linkedPhotos: [
              'https://example.com/photo1.jpg',
              '',
              null,
              'https://example.com/photo2.jpg'
            ]
          }
        ]
      }
    ];
    expect(countTripMemoryPhotos(days)).toBe(2);
  });
});
