// ========================================
// MAP VIEW - Traveler Locations
// ========================================

import { currentTripId, TRAVELERS, DESTINATIONS, HOTEL } from '../state.js';
import { fetchLocations } from '../api.js';

// Module state
let map = null;
let markers = {};
let isInitialized = false;
let refreshIntervalId = null;

const REFRESH_INTERVAL = 30 * 1000; // 30 seconds

// ========================================
// INITIALIZATION
// ========================================

export function initMapView() {
  if (isInitialized) return;
  isInitialized = true;
  console.log('[MapView] Initialized');
}

export function showMapView() {
  const container = document.getElementById('mapView');
  if (!container) return;

  container.classList.add('visible');

  // Initialize map if needed
  if (!map) {
    initializeMap();
  }

  // Start refreshing locations
  refreshLocations();
  startLocationRefresh();
}

export function hideMapView() {
  const container = document.getElementById('mapView');
  if (container) {
    container.classList.remove('visible');
  }

  stopLocationRefresh();
}

// ========================================
// MAP SETUP
// ========================================

function initializeMap() {
  const container = document.getElementById('mapViewMap');
  if (!container || !window.L) {
    console.warn('[MapView] Map container or Leaflet not available');
    return;
  }

  // Get initial center from hotel or first destination
  let initialCenter = [37.9838, 23.7275]; // Default: Athens
  let initialZoom = 13;

  if (HOTEL?.lat && HOTEL?.lon) {
    initialCenter = [HOTEL.lat, HOTEL.lon];
  } else {
    const firstDest = Object.values(DESTINATIONS)[0];
    if (firstDest?.lat && firstDest?.lon) {
      initialCenter = [firstDest.lat, firstDest.lon];
    }
  }

  // Create map
  map = L.map(container, {
    center: initialCenter,
    zoom: initialZoom,
    zoomControl: true
  });

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  // Add hotel marker if available
  if (HOTEL?.lat && HOTEL?.lon) {
    const hotelIcon = L.divIcon({
      className: 'map-marker map-marker-hotel',
      html: '<span class="material-symbols-outlined">hotel</span>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker([HOTEL.lat, HOTEL.lon], { icon: hotelIcon })
      .addTo(map)
      .bindPopup(`<strong>${HOTEL.name || 'Hotel'}</strong>`);
  }

  console.log('[MapView] Map initialized');
}

// ========================================
// LOCATION UPDATES
// ========================================

async function refreshLocations() {
  try {
    const locations = await fetchLocations(currentTripId);
    console.log('[MapView] Fetched locations:', locations.length);
    updateMarkers(locations);
  } catch (error) {
    console.warn('[MapView] Failed to fetch locations:', error.message);
  }
}

function updateMarkers(locations) {
  if (!map) return;

  const validPositions = [];

  // Update or create markers for each location
  locations.forEach(loc => {
    if (!loc.lat || !loc.lon) return;

    const traveler = TRAVELERS.find(t => t.id === loc.travelerId);
    if (!traveler) return;

    validPositions.push([loc.lat, loc.lon]);

    if (markers[loc.travelerId]) {
      // Update existing marker position
      markers[loc.travelerId].setLatLng([loc.lat, loc.lon]);
      markers[loc.travelerId].setPopupContent(createPopupContent(traveler, loc));
    } else {
      // Create new marker
      const icon = createTravelerIcon(traveler);
      const marker = L.marker([loc.lat, loc.lon], { icon })
        .addTo(map)
        .bindPopup(createPopupContent(traveler, loc));

      markers[loc.travelerId] = marker;
    }
  });

  // Remove markers for travelers no longer sharing
  const activeIds = locations.map(l => l.travelerId);
  Object.keys(markers).forEach(id => {
    if (!activeIds.includes(id)) {
      map.removeLayer(markers[id]);
      delete markers[id];
    }
  });

  // Fit bounds to show all markers if we have any
  if (validPositions.length > 0) {
    // Include hotel in bounds if available
    if (HOTEL?.lat && HOTEL?.lon) {
      validPositions.push([HOTEL.lat, HOTEL.lon]);
    }

    if (validPositions.length === 1) {
      map.setView(validPositions[0], 15);
    } else {
      const bounds = L.latLngBounds(validPositions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
}

function createTravelerIcon(traveler) {
  return L.divIcon({
    className: 'map-marker map-marker-traveler',
    html: `<div class="traveler-marker" style="background: ${traveler.color || '#667085'}">
      <span class="traveler-initials">${traveler.initials || '?'}</span>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

function createPopupContent(traveler, location) {
  const lastSeen = formatLastSeen(location.updatedAt);
  return `
    <div class="traveler-popup">
      <strong>${escapeHtml(traveler.name)}</strong>
      <div class="popup-last-seen">Last seen ${lastSeen}</div>
    </div>
  `;
}

function formatLastSeen(timestamp) {
  if (!timestamp) return 'recently';

  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMinutes = Math.floor((now - then) / (1000 * 60));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes === 1) return '1 min ago';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  return 'over a day ago';
}

// ========================================
// REFRESH CONTROL
// ========================================

function startLocationRefresh() {
  if (refreshIntervalId) return;
  refreshIntervalId = setInterval(refreshLocations, REFRESH_INTERVAL);
}

function stopLocationRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

// ========================================
// CLEANUP
// ========================================

export function destroyMapView() {
  stopLocationRefresh();

  if (map) {
    map.remove();
    map = null;
  }

  markers = {};
  isInitialized = false;
}

// ========================================
// HELPERS
// ========================================

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
