// ========================================
// MAP UTILITIES
// ========================================
// Generate static map images for sharing

import { MAPBOX_TOKEN, MAP_STYLE, MAP_MARKER_COLOR } from '../config.js';

/**
 * Generate a Mapbox Static Image URL
 * @param {Array} markers - Array of {lat, lon, label} objects
 * @param {Object} options - width, height, padding
 * @returns {string} Mapbox Static Image URL
 */
export function generateMapUrl(markers, options = {}) {
  const {
    width = 600,
    height = 400,
    padding = 50
  } = options;

  if (!markers || markers.length === 0) {
    return null;
  }

  // Build marker string for Mapbox
  // Format: pin-s+color(lon,lat),pin-s+color(lon,lat)
  const markerString = markers
    .map((m, i) => {
      const label = m.label || String.fromCharCode(65 + i); // A, B, C, ...
      return `pin-l-${label.toLowerCase()}+${MAP_MARKER_COLOR}(${m.lon},${m.lat})`;
    })
    .join(',');

  // Calculate bounds to auto-fit all markers
  const lons = markers.map(m => m.lon);
  const lats = markers.map(m => m.lat);

  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Use auto bounds fitting
  const bounds = `[${minLon},${minLat},${maxLon},${maxLat}]`;

  // Mapbox Static Images API URL with auto-fit
  const url = `https://api.mapbox.com/styles/v1/${MAP_STYLE}/static/${markerString}/auto/${width}x${height}?padding=${padding}&access_token=${MAPBOX_TOKEN}`;

  return url;
}

/**
 * Generate map URL for entire trip route
 * @param {Object} destinations - DESTINATIONS object with lat/lon
 * @param {Array} days - DAYS array with location codes
 * @returns {string} Map URL
 */
export function generateTripMapUrl(destinations, days, options = {}) {
  // Get unique locations in trip order
  const visitedLocations = [];
  const seen = new Set();

  days.forEach(day => {
    if (day.location && !seen.has(day.location)) {
      seen.add(day.location);
      const dest = destinations[day.location];
      if (dest && dest.lat && dest.lon) {
        visitedLocations.push({
          lat: dest.lat,
          lon: dest.lon,
          label: dest.city?.[0] || day.location[0],
          name: dest.city || dest.name
        });
      }
    }
  });

  return generateMapUrl(visitedLocations, options);
}

/**
 * Generate map URL for a single day
 * @param {Object} destinations - DESTINATIONS object
 * @param {Object} day - Day object with location
 * @returns {string} Map URL
 */
export function generateDayMapUrl(destinations, day, options = {}) {
  if (!day?.location) return null;

  const dest = destinations[day.location];
  if (!dest?.lat || !dest?.lon) return null;

  return generateMapUrl([{
    lat: dest.lat,
    lon: dest.lon,
    label: dest.city?.[0] || 'A',
    name: dest.city || dest.name
  }], { ...options, width: 400, height: 300 });
}

/**
 * Generate a path/route line between markers
 * @param {Array} markers - Array of {lat, lon} objects
 * @returns {string} GeoJSON path string for Mapbox
 */
export function generateRoutePath(markers) {
  if (markers.length < 2) return '';

  const coordinates = markers.map(m => [m.lon, m.lat]);
  const geojson = {
    type: 'Feature',
    properties: { 'stroke': '#ff7e5f', 'stroke-width': 3 },
    geometry: {
      type: 'LineString',
      coordinates
    }
  };

  return encodeURIComponent(JSON.stringify(geojson));
}

/**
 * Get trip summary for map overlay
 * @param {Object} destinations - DESTINATIONS object
 * @param {Array} days - DAYS array
 * @returns {Object} Summary with countries, cities, etc.
 */
export function getTripMapSummary(destinations, days) {
  const countries = new Set();
  const cities = new Set();

  days.forEach(day => {
    const dest = destinations[day.location];
    if (dest) {
      if (dest.country) countries.add(dest.country);
      if (dest.city) cities.add(dest.city);
    }
  });

  return {
    countries: Array.from(countries),
    cities: Array.from(cities),
    totalDays: days.length
  };
}
