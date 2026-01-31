// ========================================
// MAP VIEW - Traveler Locations
// ========================================

import { currentTripId } from '../state.js';
import { fetchLocations } from '../api.js';

// Module state
let map = null;
let markers = {};
let isInitialized = false;
let refreshIntervalId = null;

const REFRESH_INTERVAL = 30 * 1000; // 30 seconds

// Get data from window (set by app.js after data loads)
function getTravelers() {
  return window.TRAVELERS || [];
}

function getDestinations() {
  return window.DESTINATIONS || {};
}

function getHotel() {
  return window.HOTEL || null;
}

// ========================================
// INITIALIZATION
// ========================================

export function initMapView() {
  if (isInitialized) return;
  isInitialized = true;
  console.log('[MapView] Initialized');
}

export async function showMapView() {
  const container = document.getElementById('mapView');
  if (!container) return;

  container.classList.add('visible');

  // Initialize map if needed
  if (!map) {
    await initializeMap();
  }

  // Clear existing markers and force fresh fetch every time map is shown
  clearAllMarkers();
  await refreshLocations();
  startLocationRefresh();
}

function clearAllMarkers() {
  Object.values(markers).forEach(marker => {
    if (map) map.removeLayer(marker);
  });
  markers = {};
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

async function initializeMap() {
  const container = document.getElementById('mapViewMap');
  if (!container || !window.L) {
    console.warn('[MapView] Map container or Leaflet not available');
    return;
  }

  const hotel = getHotel();
  const destinations = getDestinations();

  // Start with a default center, will adjust after
  let initialCenter = [37.9838, 23.7275]; // Default: Athens
  let initialZoom = 13;

  // Try to get user's current location for initial center
  let userLocation = null;
  if (navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000
        });
      });
      userLocation = [position.coords.latitude, position.coords.longitude];
      initialCenter = userLocation;
      console.log('[MapView] Using user location as center');
    } catch (e) {
      console.log('[MapView] Could not get user location, using fallback');
    }
  }

  // If no user location, try hotel or destination
  if (!userLocation) {
    if (hotel?.lat && hotel?.lon) {
      initialCenter = [hotel.lat, hotel.lon];
    } else {
      const firstDest = Object.values(destinations)[0];
      if (firstDest?.lat && firstDest?.lon) {
        initialCenter = [firstDest.lat, firstDest.lon];
      }
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
  if (hotel?.lat && hotel?.lon) {
    const hotelIcon = L.divIcon({
      className: 'map-marker map-marker-hotel',
      html: '<span class="material-symbols-outlined">hotel</span>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker([hotel.lat, hotel.lon], { icon: hotelIcon })
      .addTo(map)
      .bindPopup(`<strong>${hotel.name || 'Hotel'}</strong>`);
  }

  console.log('[MapView] Map initialized');
}

// ========================================
// LOCATION UPDATES
// ========================================

async function refreshLocations() {
  try {
    const locations = await fetchLocations(currentTripId);
    updateMarkers(locations);
  } catch (error) {
    console.warn('[MapView] Failed to fetch locations:', error.message);
  }
}

function updateMarkers(locations) {
  if (!map) return;

  const travelers = getTravelers();
  const hotel = getHotel();
  const validPositions = [];

  // Jitter disabled for testing stacked markers
  // const jitteredLocations = applyLocationJitter(locations);
  const jitteredLocations = locations;

  for (let i = 0; i < jitteredLocations.length; i++) {
    const loc = jitteredLocations[i];

    if (!loc.lat || !loc.lon) continue;

    // Find traveler in array, or create fallback
    let traveler = travelers.find(t => t.id === loc.travelerId);
    if (!traveler) {
      traveler = {
        id: loc.travelerId,
        name: loc.displayName || loc.travelerId,
        initials: (loc.displayName || loc.travelerId).substring(0, 2).toUpperCase(),
        color: '#667085'
      };
    }

    validPositions.push([loc.lat, loc.lon]);

    try {
      const markerKey = loc.travelerId;
      const lastSeen = formatLastSeen(loc.updatedAt);
      const tooltipContent = `<strong>${traveler.name}</strong><br><span class="tooltip-time">Last seen ${lastSeen}</span>`;
      const popupContent = `
        <div class="traveler-popup">
          <strong>${traveler.name}</strong>
          <div class="popup-last-seen">Last seen ${lastSeen}</div>
          ${loc.accuracy ? `<div class="popup-accuracy">Accuracy: ~${Math.round(loc.accuracy)}m</div>` : ''}
        </div>
      `;

      if (markers[markerKey]) {
        markers[markerKey].setLatLng([loc.lat, loc.lon]);
        markers[markerKey].setTooltipContent(tooltipContent);
        markers[markerKey].setPopupContent(popupContent);
      } else {
        const color = traveler.color || '#ff0000';

        const marker = L.circleMarker([loc.lat, loc.lon], {
          radius: 20,
          fillColor: color,
          color: '#fff',
          weight: 3,
          fillOpacity: 0.9
        })
          .addTo(map)
          .bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -10],
            className: 'traveler-tooltip'
          })
          .bindPopup(popupContent);

        markers[markerKey] = marker;
      }
    } catch (err) {
      console.error('[MapView] Error creating marker:', err);
    }
  }

  // Remove markers for travelers no longer sharing
  const activeIds = locations.map(l => l.travelerId);
  Object.keys(markers).forEach(id => {
    if (!activeIds.includes(id)) {
      map.removeLayer(markers[id]);
      delete markers[id];
    }
  });

  // Fit bounds to show all traveler markers (don't include hotel - it may be far away)
  if (validPositions.length > 0) {
    if (validPositions.length === 1) {
      map.setView(validPositions[0], 15);
    } else {
      const bounds = L.latLngBounds(validPositions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
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

// Apply jitter to markers that are too close together
function applyLocationJitter(locations) {
  const PROXIMITY_THRESHOLD = 0.001; // ~100 meters
  const JITTER_AMOUNT = 0.002; // ~200 meters offset - very visible

  // Create a copy to avoid mutating original
  const result = locations.map(loc => ({ ...loc }));

  // Always spread markers in a circle if there are multiple
  if (result.length > 1) {
    for (let i = 0; i < result.length; i++) {
      const angle = (i * 2 * Math.PI) / result.length;
      result[i].lat += Math.cos(angle) * JITTER_AMOUNT;
      result[i].lon += Math.sin(angle) * JITTER_AMOUNT;
    }
    console.log('[MapView] Applied jitter to all markers');
  }

  return result;
}
