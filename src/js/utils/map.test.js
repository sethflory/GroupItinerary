// Mock the config module
jest.mock('../config.js', () => ({
  MAPBOX_TOKEN: 'test-token',
  MAP_STYLE: 'mapbox/streets-v12',
  MAP_MARKER_COLOR: 'ff7e5f'
}));

import {
  generateMapUrl,
  generateTripMapUrl,
  generateDayMapUrl,
  generateRoutePath,
  getTripMapSummary
} from './map.js';

describe('map utilities', () => {
  describe('generateMapUrl', () => {
    it('should return null for empty markers', () => {
      expect(generateMapUrl([])).toBeNull();
      expect(generateMapUrl(null)).toBeNull();
    });

    it('should generate URL with single marker', () => {
      const markers = [{ lat: 37.9838, lon: 23.7275, label: 'A' }];
      const url = generateMapUrl(markers);

      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('pin-l-a+ff7e5f');
      expect(url).toContain('23.7275');
      expect(url).toContain('37.9838');
      expect(url).toContain('access_token=test-token');
    });

    it('should use default label letters when not provided', () => {
      const markers = [
        { lat: 37.9838, lon: 23.7275 },
        { lat: 40.4168, lon: -3.7038 }
      ];
      const url = generateMapUrl(markers);

      expect(url).toContain('pin-l-a+ff7e5f');
      expect(url).toContain('pin-l-b+ff7e5f');
    });

    it('should respect custom dimensions', () => {
      const markers = [{ lat: 37.9838, lon: 23.7275 }];
      const url = generateMapUrl(markers, { width: 800, height: 600 });

      expect(url).toContain('800x600');
    });
  });

  describe('generateTripMapUrl', () => {
    const destinations = {
      athens: { city: 'Athens', country: 'Greece', lat: 37.9838, lon: 23.7275 },
      santorini: { city: 'Santorini', country: 'Greece', lat: 36.3932, lon: 25.4615 }
    };

    const days = [
      { date: '2025-06-15', location: 'athens' },
      { date: '2025-06-16', location: 'athens' },
      { date: '2025-06-17', location: 'santorini' }
    ];

    it('should generate URL with unique locations only', () => {
      const url = generateTripMapUrl(destinations, days);

      expect(url).toContain('api.mapbox.com');
      // Should have Athens and Santorini markers
      expect(url).toContain('23.7275');
      expect(url).toContain('25.4615');
    });

    it('should return null for empty destinations', () => {
      const url = generateTripMapUrl({}, days);
      expect(url).toBeNull();
    });
  });

  describe('generateDayMapUrl', () => {
    const destinations = {
      athens: { city: 'Athens', lat: 37.9838, lon: 23.7275 }
    };

    it('should generate URL for day with location', () => {
      const day = { date: '2025-06-15', location: 'athens' };
      const url = generateDayMapUrl(destinations, day);

      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('400x300'); // Default dimensions for day view
    });

    it('should return null for day without location', () => {
      const day = { date: '2025-06-15' };
      expect(generateDayMapUrl(destinations, day)).toBeNull();
    });

    it('should return null for unknown location', () => {
      const day = { date: '2025-06-15', location: 'unknown' };
      expect(generateDayMapUrl(destinations, day)).toBeNull();
    });
  });

  describe('generateRoutePath', () => {
    it('should return empty string for single marker', () => {
      const markers = [{ lat: 37.9838, lon: 23.7275 }];
      expect(generateRoutePath(markers)).toBe('');
    });

    it('should generate GeoJSON for multiple markers', () => {
      const markers = [
        { lat: 37.9838, lon: 23.7275 },
        { lat: 36.3932, lon: 25.4615 }
      ];
      const path = generateRoutePath(markers);
      const decoded = JSON.parse(decodeURIComponent(path));

      expect(decoded.type).toBe('Feature');
      expect(decoded.geometry.type).toBe('LineString');
      expect(decoded.geometry.coordinates).toHaveLength(2);
    });
  });

  describe('getTripMapSummary', () => {
    const destinations = {
      athens: { city: 'Athens', country: 'Greece' },
      santorini: { city: 'Santorini', country: 'Greece' },
      madrid: { city: 'Madrid', country: 'Spain' }
    };

    it('should return unique countries and cities', () => {
      const days = [
        { location: 'athens' },
        { location: 'athens' },
        { location: 'santorini' },
        { location: 'madrid' }
      ];

      const summary = getTripMapSummary(destinations, days);

      expect(summary.countries).toContain('Greece');
      expect(summary.countries).toContain('Spain');
      expect(summary.countries).toHaveLength(2);
      expect(summary.cities).toHaveLength(3);
      expect(summary.totalDays).toBe(4);
    });

    it('should handle days without locations', () => {
      const days = [
        { location: 'athens' },
        { date: '2025-06-16' }, // No location
        { location: 'unknown' } // Unknown location
      ];

      const summary = getTripMapSummary(destinations, days);

      expect(summary.cities).toEqual(['Athens']);
      expect(summary.totalDays).toBe(3);
    });
  });
});
