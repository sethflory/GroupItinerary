// ========================================
// SAW IT! - "What Will We See" Game
// ========================================

import { currentTripId } from '../state.js';
import { API_BASE } from '../config.js';
import { getStoredAccessCode, getCurrentTravelerId, getDisplayName, isAdmin } from '../auth.js';
import { uploadPhoto as apiUploadPhoto } from '../api.js';

// State
let currentStep = 'configure';  // configure, preview, game, results, savedList
let selectedOrigin = null;      // { type, eventId?, name, lat, lon }
let transportMode = 'walk';
let generatedItems = [];
let activeGame = null;
let currentEventId = null;
let currentEvent = null;
let savedList = null;           // Personal saved list for current event
let savedListEventIds = [];     // Cache of event IDs that have saved lists

// Dependencies injected by app.js
let DAYS, TRAVELERS, DESTINATIONS, HOTELS;

export function setSawItDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
  DESTINATIONS = deps.DESTINATIONS;
  HOTELS = deps.HOTELS;

  // Load saved lists on init
  loadSavedListEventIds();
}

// Check if an event has a saved list (for icon display)
export function hasEventSavedList(eventId) {
  return savedListEventIds.includes(eventId);
}

// Load which events have saved lists
async function loadSavedListEventIds() {
  try {
    const result = await fetchSawItAPI('lists', 'GET');
    if (!result.error && result.eventIds) {
      savedListEventIds = result.eventIds;
    }
  } catch (err) {
    console.log('Could not load saved lists:', err.message);
  }
}

// Refresh saved list cache (called after saving)
export async function refreshSavedLists() {
  await loadSavedListEventIds();
}

// ========================================
// HELPERS
// ========================================

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Get estimated time based on distance and transport mode
function getEstimatedTime(distanceKm, mode) {
  if (!distanceKm) return null;
  // Walking: ~5 km/h, Driving in city: ~25 km/h
  const speedKmh = mode === 'walk' ? 5 : 25;
  const hours = distanceKm / speedKmh;
  const minutes = Math.round(hours * 60);

  if (minutes < 60) {
    return `${minutes} min`;
  } else {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
}

// Format distance for display
function formatDistance(distanceKm) {
  if (!distanceKm) return null;
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

// ========================================
// API CALLS
// ========================================

async function fetchSawItAPI(endpoint, method = 'GET', body = null) {
  const accessCode = getStoredAccessCode(currentTripId);
  const url = `${API_BASE}/sawit/${endpoint}?tripId=${encodeURIComponent(currentTripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };

  if (body) {
    options.body = JSON.stringify({ ...body, tripId: currentTripId, accessCode });
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    console.error(`Saw It API error (${response.status}):`, text);
    try {
      return { error: JSON.parse(text).error || `Error: ${response.status}` };
    } catch {
      return { error: `API error: ${response.status}` };
    }
  }

  return response.json();
}

// ========================================
// MODAL
// ========================================

export function openWhatsYouWillSee(eventId) {
  let modal = document.getElementById('sawItModal');
  if (!modal) {
    createSawItModal();
    modal = document.getElementById('sawItModal');
  }

  // Reset state
  currentStep = 'configure';
  selectedOrigin = null;
  transportMode = 'walk';
  generatedItems = [];
  activeGame = null;
  currentEventId = eventId;
  currentEvent = findEventById(eventId);

  modal.classList.add('active');
  checkExistingGame(eventId);
}

export function closeSawItModal() {
  document.getElementById('sawItModal')?.classList.remove('active');
}

function createSawItModal() {
  const modal = document.createElement('div');
  modal.id = 'sawItModal';
  modal.className = 'share-modal-overlay';
  modal.innerHTML = `
    <div class="share-modal saw-it-modal">
      <div class="saw-it-header">
        <h3><span class="material-symbols-outlined">visibility</span> What Will We See</h3>
        <button class="modal-close" onclick="closeSawItModal()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="saw-it-content" id="sawItContent">
        <!-- Content rendered by step functions -->
      </div>
    </div>
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSawItModal();
  });
  document.body.appendChild(modal);
}

// ========================================
// STEP RENDERING
// ========================================

function renderCurrentStep() {
  switch (currentStep) {
    case 'configure':
      renderConfigureStep();
      break;
    case 'preview':
      renderPreviewStep();
      break;
    case 'game':
      renderGameStep();
      break;
    case 'results':
      renderResultsStep();
      break;
    case 'savedList':
      renderSavedListStep();
      break;
  }
}

async function checkExistingGame(eventId) {
  // Check for active game first
  const gameResult = await fetchSawItAPI(`game/${eventId}`, 'GET');

  if (!gameResult.error && gameResult.id) {
    activeGame = gameResult;
    if (gameResult.status === 'active') {
      currentStep = 'game';
      renderCurrentStep();
      return;
    } else {
      currentStep = 'results';
      renderCurrentStep();
      return;
    }
  }

  // Check for saved personal list
  const listResult = await fetchSawItAPI(`list/${eventId}`, 'GET');

  if (!listResult.error && listResult.id) {
    savedList = listResult;
    currentStep = 'savedList';
    renderCurrentStep();
    return;
  }

  renderCurrentStep();
}

function renderConfigureStep() {
  const container = document.getElementById('sawItContent');
  const event = currentEvent;

  if (!event) {
    container.innerHTML = `<div class="saw-it-error"><span class="material-symbols-outlined">error</span><p>Event not found</p></div>`;
    return;
  }

  const prevEvent = getPreviousEvent(currentEventId);
  const hotelForDay = getHotelForDay(event.date);

  // Pre-select origin if only one option
  if (!selectedOrigin) {
    if (prevEvent) {
      selectedOrigin = {
        type: 'previous_event',
        eventId: prevEvent.id,
        name: prevEvent.title,
        lat: prevEvent.lat || getDestinationCoords(event.date)?.lat,
        lon: prevEvent.lon || getDestinationCoords(event.date)?.lon
      };
    } else if (hotelForDay) {
      selectedOrigin = {
        type: 'hotel',
        eventId: hotelForDay.id,
        name: hotelForDay.title,
        lat: hotelForDay.lat,
        lon: hotelForDay.lon
      };
    }
  }

  // Show existing game banner if one exists
  const existingGameBanner = activeGame ? `
    <div class="saw-it-existing-game">
      <div class="existing-game-header">
        <span class="material-symbols-outlined">sports_esports</span>
        <span>Game in Progress!</span>
      </div>
      <div class="existing-game-info">
        ${activeGame.sightings?.length || 0} sightings • ${getUniqueSpotters(activeGame)} players
      </div>
      <button class="join-game-btn" onclick="window.sawItJoinGame()">
        <span class="material-symbols-outlined">play_arrow</span>
        Join Game
      </button>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="saw-it-step configure-step">
      ${existingGameBanner}

      <div class="saw-it-step-header">
        <div>
          <h4>Plan Your Route</h4>
          <p class="saw-it-subtitle">To: ${event.title}</p>
        </div>
      </div>

      <div class="saw-it-origin-options">
        <h5 style="margin: 0 0 0.5rem; font-size: 0.9rem;">Where are you coming from?</h5>

        ${prevEvent ? `
          <label class="saw-it-origin-option">
            <input type="radio" name="origin" value="previous_event"
              ${selectedOrigin?.type === 'previous_event' ? 'checked' : ''}
              onchange="window.sawItSelectOrigin('previous_event', '${prevEvent.id}', '${escapeAttr(prevEvent.title)}')">
            <div class="origin-option-content">
              <div class="origin-option-icon">
                <span class="material-symbols-outlined">schedule</span>
              </div>
              <div class="origin-option-details">
                <div class="origin-option-label">Previous Event</div>
                <div class="origin-option-name">${prevEvent.title}</div>
              </div>
            </div>
          </label>
        ` : ''}

        ${hotelForDay ? `
          <label class="saw-it-origin-option">
            <input type="radio" name="origin" value="hotel"
              ${selectedOrigin?.type === 'hotel' ? 'checked' : ''}
              onchange="window.sawItSelectOrigin('hotel', '${hotelForDay.id}', '${escapeAttr(hotelForDay.title)}')">
            <div class="origin-option-content">
              <div class="origin-option-icon">
                <span class="material-symbols-outlined">hotel</span>
              </div>
              <div class="origin-option-details">
                <div class="origin-option-label">Hotel</div>
                <div class="origin-option-name">${hotelForDay.title}</div>
              </div>
            </div>
          </label>
        ` : ''}

        <label class="saw-it-origin-option ${!prevEvent && !hotelForDay ? '' : ''}">
          <input type="radio" name="origin" value="custom"
            ${selectedOrigin?.type === 'custom' ? 'checked' : ''}
            onchange="window.sawItSelectOrigin('custom', null, 'Custom Location')">
          <div class="origin-option-content">
            <div class="origin-option-icon">
              <span class="material-symbols-outlined">location_on</span>
            </div>
            <div class="origin-option-details">
              <div class="origin-option-label">Pick on Map</div>
              <div class="origin-option-name">Choose a custom starting point</div>
            </div>
          </div>
        </label>
      </div>

      ${selectedOrigin?.type === 'custom' ? `
        <div class="saw-it-map-picker" onclick="window.sawItOpenMapPicker()">
          <div>
            <span class="material-symbols-outlined" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">map</span>
            ${selectedOrigin?.name === 'Custom Location' ? 'Click to select location' : selectedOrigin?.name}
          </div>
        </div>
      ` : ''}

      <div class="saw-it-transport">
        <label>How are you getting there?</label>
        <div class="transport-toggle">
          <button class="transport-btn ${transportMode === 'walk' ? 'active' : ''}" onclick="window.sawItSetTransport('walk')">
            <span class="material-symbols-outlined">directions_walk</span>
            Walk
          </button>
          <button class="transport-btn ${transportMode === 'drive' ? 'active' : ''}" onclick="window.sawItSetTransport('drive')">
            <span class="material-symbols-outlined">directions_car</span>
            Drive
          </button>
        </div>
      </div>

      ${renderPathFacts(event)}

      <div class="saw-it-actions">
        <button class="saw-it-action-btn secondary" onclick="closeSawItModal()">Cancel</button>
        <button class="saw-it-action-btn primary"
          ${!selectedOrigin ? 'disabled' : ''}
          onclick="window.sawItGenerateList()">
          <span class="material-symbols-outlined">auto_awesome</span>
          Generate List
        </button>
      </div>
    </div>
  `;
}

function renderPathFacts(event) {
  if (!selectedOrigin || !event) return '';

  // Get destination coordinates from event
  const destLat = event.lat || getDestinationCoords(event.date)?.lat;
  const destLon = event.lon || getDestinationCoords(event.date)?.lon;
  const originLat = selectedOrigin.lat;
  const originLon = selectedOrigin.lon;

  // Calculate distance
  const distance = calculateDistance(originLat, originLon, destLat, destLon);
  const formattedDistance = formatDistance(distance);
  const estimatedTime = getEstimatedTime(distance, transportMode);

  if (!formattedDistance) return '';

  return `
    <div class="saw-it-path-facts">
      <div class="path-facts-header">
        <span class="material-symbols-outlined">route</span>
        <span>Route Overview</span>
      </div>
      <div class="path-facts-grid">
        <div class="path-fact">
          <span class="material-symbols-outlined">straighten</span>
          <div>
            <div class="path-fact-value">${formattedDistance}</div>
            <div class="path-fact-label">Distance</div>
          </div>
        </div>
        <div class="path-fact">
          <span class="material-symbols-outlined">schedule</span>
          <div>
            <div class="path-fact-value">${estimatedTime || '--'}</div>
            <div class="path-fact-label">Est. ${transportMode === 'walk' ? 'Walking' : 'Driving'}</div>
          </div>
        </div>
      </div>
      <div class="path-facts-route">
        <div class="path-point origin">
          <span class="material-symbols-outlined">radio_button_checked</span>
          <span>${selectedOrigin.name}</span>
        </div>
        <div class="path-line"></div>
        <div class="path-point destination">
          <span class="material-symbols-outlined">location_on</span>
          <span>${event.title}</span>
        </div>
      </div>
    </div>
  `;
}

function renderPreviewStep() {
  const container = document.getElementById('sawItContent');
  const event = currentEvent;

  const getCategoryIcon = (cat) => {
    const icons = {
      landmark: 'account_balance',
      architecture: 'domain',
      street_art: 'palette',
      nature: 'park',
      food: 'restaurant',
      culture: 'theater_comedy',
      view: 'landscape'
    };
    return icons[cat] || 'place';
  };

  container.innerHTML = `
    <div class="saw-it-step preview-step">
      <div class="saw-it-step-header">
        <button class="saw-it-back-btn" onclick="window.sawItGoBack()">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h4>What Will We See</h4>
          <p class="saw-it-subtitle">${transportMode === 'walk' ? 'Walking' : 'Driving'} to ${event?.title || 'destination'}</p>
        </div>
      </div>

      <div class="saw-it-items-preview">
        ${generatedItems.map((item, idx) => `
          <div class="saw-it-item-preview">
            <div class="item-order">${idx + 1}</div>
            <div class="item-details">
              <div class="item-header">
                <span class="item-name">${item.name}</span>
                <span class="item-category ${item.category}">${item.category.replace('_', ' ')}</span>
              </div>
              <div class="item-description">${item.description}</div>
              <div class="item-look-for">
                <span class="material-symbols-outlined">search</span>
                <span>${item.lookFor}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="saw-it-actions">
        <button class="saw-it-action-btn secondary" onclick="window.sawItRegenerate()">
          <span class="material-symbols-outlined">refresh</span>
          Regenerate
        </button>
        <button class="saw-it-action-btn secondary" onclick="window.sawItJustForMe()">
          <span class="material-symbols-outlined">person</span>
          Just for Me
        </button>
        <button class="saw-it-action-btn primary game" onclick="window.sawItStartGame()">
          <span class="material-symbols-outlined">sports_esports</span>
          Start Game
        </button>
      </div>
    </div>
  `;
}

function renderGameStep() {
  const container = document.getElementById('sawItContent');
  const game = activeGame;

  if (!game) {
    container.innerHTML = '<p>Loading game...</p>';
    return;
  }

  const travelerId = getCurrentTravelerId();
  const travelerName = getDisplayName();
  const isCreator = game.createdBy === travelerId;
  const canEndGame = isCreator || isAdmin();
  const travelerCount = TRAVELERS?.length || 4;

  // Calculate my points
  const myPoints = calculateMyPoints(game);

  // Parse items and sightings
  const items = parseJSON(game.items, []);
  const sightings = parseJSON(game.sightings, []);

  container.innerHTML = `
    <div class="saw-it-step game-step">
      <div class="saw-it-step-header">
        <div>
          <h4>
            <span class="material-symbols-outlined" style="color: #22c55e;">sports_esports</span>
            Saw it!
          </h4>
          <p class="saw-it-subtitle">To: ${game.eventTitle || 'destination'}</p>
        </div>
      </div>

      <div class="saw-it-points-bar">
        <span class="points-label">Your Points</span>
        <span class="points-value">${myPoints}</span>
      </div>

      <div class="saw-it-game-items">
        ${items.map((item, idx) => {
          const itemSightings = sightings.filter(s => s.itemId === item.id);
          const mySighting = itemSightings.find(s => s.travelerId === travelerId);
          const firstSpotter = itemSightings.length > 0 ? itemSightings[0] : null;
          const spotCount = itemSightings.length;

          return `
            <div class="saw-it-game-item ${spotCount > 0 ? 'spotted' : ''} ${mySighting ? 'my-spot' : ''}">
              <div class="game-item-header">
                <div class="game-item-info">
                  <span class="game-item-order">${idx + 1}</span>
                  <span class="game-item-name">${item.name}</span>
                </div>
                <div class="game-item-status ${spotCount === travelerCount ? 'complete' : ''}">
                  <span class="material-symbols-outlined">${spotCount > 0 ? 'check_circle' : 'radio_button_unchecked'}</span>
                  ${spotCount}/${travelerCount}
                </div>
              </div>
              ${firstSpotter && !mySighting ? `
                <div class="game-item-first-spotter">
                  <span class="trophy">🏆</span> ${firstSpotter.travelerName} spotted first!
                </div>
              ` : ''}
              ${mySighting ? `
                <div class="game-item-first-spotter">
                  <span class="material-symbols-outlined" style="color: #22c55e; font-size: 1rem; vertical-align: middle;">check</span>
                  You spotted this! (+${mySighting.points} pts${mySighting.photoUrl ? ', +1 photo' : ''}${mySighting.sharedToSocial ? ', +1 share' : ''})
                </div>
              ` : `
                <div class="game-item-actions">
                  <button class="saw-it-btn with-photo" onclick="window.sawItSpotWithPhoto('${item.id}')">
                    <span class="material-symbols-outlined">photo_camera</span>
                    Saw it!
                  </button>
                  <button class="saw-it-btn no-photo" onclick="window.sawItSpotNoPhoto('${item.id}')">
                    No photo
                  </button>
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>

      <div class="saw-it-actions">
        <button class="saw-it-action-btn secondary" onclick="closeSawItModal()">Close</button>
        ${canEndGame ? `
          <button class="saw-it-action-btn primary" onclick="window.sawItEndGame()">
            <span class="material-symbols-outlined">done_all</span>
            End Game
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderSavedListStep() {
  const container = document.getElementById('sawItContent');
  const list = savedList;

  if (!list) {
    container.innerHTML = '<p>Loading list...</p>';
    return;
  }

  const items = parseJSON(list.items, []);

  container.innerHTML = `
    <div class="saw-it-step saved-list-step">
      <div class="saw-it-step-header">
        <div>
          <h4>
            <span class="material-symbols-outlined" style="color: var(--color-sky);">format_list_bulleted</span>
            Your Saved List
          </h4>
          <p class="saw-it-subtitle">${list.transportMode === 'walk' ? 'Walking' : 'Driving'} to ${list.eventTitle || 'destination'}</p>
        </div>
      </div>

      <div class="saw-it-items-preview">
        ${items.map((item, idx) => `
          <div class="saw-it-item-preview">
            <div class="item-order">${idx + 1}</div>
            <div class="item-details">
              <div class="item-header">
                <span class="item-name">${item.name}</span>
                <span class="item-category ${item.category}">${(item.category || '').replace('_', ' ')}</span>
              </div>
              <div class="item-description">${item.description}</div>
              <div class="item-look-for">
                <span class="material-symbols-outlined">search</span>
                <span>${item.lookFor}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="saw-it-actions">
        <button class="saw-it-action-btn secondary" onclick="window.sawItCreateNewList()">
          <span class="material-symbols-outlined">refresh</span>
          New List
        </button>
        <button class="saw-it-action-btn primary game" onclick="window.sawItStartGameFromSaved()">
          <span class="material-symbols-outlined">sports_esports</span>
          Start Game
        </button>
        <button class="saw-it-action-btn secondary" onclick="closeSawItModal()">Close</button>
      </div>
    </div>
  `;
}

function renderResultsStep() {
  const container = document.getElementById('sawItContent');
  const game = activeGame;

  if (!game) {
    container.innerHTML = '<p>Loading results...</p>';
    return;
  }

  const travelerId = getCurrentTravelerId();
  const sightings = parseJSON(game.sightings, []);

  // Calculate leaderboard
  const leaderboard = calculateLeaderboard(game);

  // Get all photos
  const photos = sightings.filter(s => s.photoUrl);

  container.innerHTML = `
    <div class="saw-it-step results-step">
      <div class="saw-it-step-header">
        <div>
          <h4>Game Complete!</h4>
          <p class="saw-it-subtitle">${game.eventTitle || 'destination'}</p>
        </div>
      </div>

      <div class="saw-it-leaderboard">
        <h4><span class="material-symbols-outlined">emoji_events</span> Leaderboard</h4>
        <div class="leaderboard-list">
          ${leaderboard.map((entry, idx) => `
            <div class="leaderboard-entry ${idx === 0 ? 'winner' : ''} ${entry.travelerId === travelerId ? 'me' : ''}">
              <div class="leaderboard-rank">${idx + 1}</div>
              <div class="leaderboard-name">
                ${entry.travelerName}
                ${entry.travelerId === travelerId ? ' (You)' : ''}
                ${idx === 0 ? ' 🏆' : ''}
              </div>
              <div class="leaderboard-points">${entry.totalPoints}</div>
            </div>
          `).join('')}
        </div>
      </div>

      ${photos.length > 0 ? `
        <div class="saw-it-photos">
          <h4><span class="material-symbols-outlined">photo_library</span> Trip Memories</h4>
          <div class="photos-grid">
            ${photos.map(p => `
              <div class="photo-thumb" onclick="window.openLightbox('${p.photoUrl}', '${escapeAttr(p.itemName || '')}', '${escapeAttr(p.travelerName)}', '')">
                <img src="${p.photoUrl}" alt="${p.itemName || 'Sighting'}">
                <div class="photo-thumb-overlay">${p.travelerName}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="saw-it-actions">
        <button class="saw-it-action-btn primary" onclick="closeSawItModal()">Done</button>
      </div>
    </div>
  `;
}

// ========================================
// WINDOW FUNCTIONS (for onclick handlers)
// ========================================

window.sawItSelectOrigin = function(type, eventId, name) {
  const coords = getDestinationCoords(currentEvent?.date);
  selectedOrigin = {
    type,
    eventId,
    name,
    lat: coords?.lat,
    lon: coords?.lon
  };

  // Re-render to update UI
  renderCurrentStep();
};

window.sawItSetTransport = function(mode) {
  transportMode = mode;
  document.querySelectorAll('.transport-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(mode));
  });
};

window.sawItOpenMapPicker = function() {
  // For now, show a simple prompt - in production, would integrate a map picker
  const location = prompt('Enter location name or address:');
  if (location) {
    selectedOrigin = {
      type: 'custom',
      eventId: null,
      name: location,
      lat: null,
      lon: null
    };
    renderCurrentStep();
  }
};

window.sawItGenerateList = async function() {
  if (!selectedOrigin) return;

  const container = document.getElementById('sawItContent');
  container.innerHTML = `
    <div class="saw-it-loading">
      <div class="spinner"></div>
      <p>Discovering interesting sights along your route...</p>
    </div>
  `;

  const event = currentEvent;
  const coords = getDestinationCoords(event?.date);

  const result = await fetchSawItAPI('generate', 'POST', {
    origin: selectedOrigin,
    destination: {
      name: event?.title || 'Destination',
      lat: event?.lat || coords?.lat,
      lon: event?.lon || coords?.lon
    },
    transportMode,
    city: getDestinationCity(event?.date),
    country: getDestinationCountry(event?.date),
    itemCount: 5
  });

  if (result.error) {
    container.innerHTML = `
      <div class="saw-it-error">
        <span class="material-symbols-outlined">error</span>
        <p>${result.error}</p>
        <button class="saw-it-action-btn secondary" onclick="window.sawItGoBack()">Go Back</button>
      </div>
    `;
    return;
  }

  generatedItems = result.items || [];
  currentStep = 'preview';
  renderCurrentStep();
};

window.sawItGoBack = function() {
  if (currentStep === 'preview') {
    currentStep = 'configure';
  } else if (currentStep === 'game' || currentStep === 'results') {
    currentStep = 'configure';
    activeGame = null;
  } else if (currentStep === 'savedList') {
    currentStep = 'configure';
    savedList = null;
  }
  renderCurrentStep();
};

window.sawItRegenerate = function() {
  window.sawItGenerateList();
};

window.sawItJustForMe = async function() {
  const container = document.getElementById('sawItContent');
  container.innerHTML = `
    <div class="saw-it-loading">
      <div class="spinner"></div>
      <p>Saving your list...</p>
    </div>
  `;

  const event = currentEvent;
  const coords = getDestinationCoords(event?.date);

  const result = await fetchSawItAPI('list', 'POST', {
    eventId: currentEventId,
    eventTitle: event?.title || 'Destination',
    origin: selectedOrigin,
    destination: {
      name: event?.title || 'Destination',
      lat: event?.lat || coords?.lat,
      lon: event?.lon || coords?.lon
    },
    transportMode,
    items: generatedItems
  });

  if (result.error) {
    showToast('Failed to save list: ' + result.error, 'error');
    currentStep = 'preview';
    renderCurrentStep();
    return;
  }

  // Update saved list cache
  if (!savedListEventIds.includes(currentEventId)) {
    savedListEventIds.push(currentEventId);
  }

  // Update the dayView to show the list icon
  if (window.renderDayDetail) {
    window.renderDayDetail();
  }

  savedList = result;
  currentStep = 'savedList';
  renderCurrentStep();
  showToast('List saved!', 'success');
};

window.sawItCreateNewList = function() {
  savedList = null;
  currentStep = 'configure';
  renderCurrentStep();
};

window.sawItStartGameFromSaved = async function() {
  if (!savedList) return;

  const container = document.getElementById('sawItContent');
  container.innerHTML = `
    <div class="saw-it-loading">
      <div class="spinner"></div>
      <p>Starting game...</p>
    </div>
  `;

  const items = parseJSON(savedList.items, []);

  const result = await fetchSawItAPI('game', 'POST', {
    eventId: savedList.eventId,
    eventTitle: savedList.eventTitle,
    origin: savedList.origin,
    destination: savedList.destination,
    transportMode: savedList.transportMode,
    items
  });

  if (result.error) {
    container.innerHTML = `
      <div class="saw-it-error">
        <span class="material-symbols-outlined">error</span>
        <p>${result.error}</p>
        <button class="saw-it-action-btn secondary" onclick="window.sawItGoBack()">Go Back</button>
      </div>
    `;
    return;
  }

  activeGame = result;
  currentStep = 'game';
  renderCurrentStep();
  showToast('Game started! Other travelers can now join.', 'success');
};

window.sawItStartGame = async function() {
  const container = document.getElementById('sawItContent');
  container.innerHTML = `
    <div class="saw-it-loading">
      <div class="spinner"></div>
      <p>Starting game...</p>
    </div>
  `;

  const event = currentEvent;
  const coords = getDestinationCoords(event?.date);

  const result = await fetchSawItAPI('game', 'POST', {
    eventId: currentEventId,
    eventTitle: event?.title || 'Destination',
    origin: selectedOrigin,
    destination: {
      name: event?.title || 'Destination',
      lat: event?.lat || coords?.lat,
      lon: event?.lon || coords?.lon
    },
    transportMode,
    items: generatedItems
  });

  if (result.error) {
    container.innerHTML = `
      <div class="saw-it-error">
        <span class="material-symbols-outlined">error</span>
        <p>${result.error}</p>
        <button class="saw-it-action-btn secondary" onclick="window.sawItGoBack()">Go Back</button>
      </div>
    `;
    return;
  }

  activeGame = result;
  currentStep = 'game';
  renderCurrentStep();
  showToast('Game started! Other travelers can now join.', 'success');
};

window.sawItJoinGame = function() {
  currentStep = 'game';
  renderCurrentStep();
};

window.sawItSpotWithPhoto = async function(itemId) {
  // Create file input for photo capture
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment'; // Prefer rear camera on mobile

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show loading on the button
    const btn = document.querySelector(`[onclick="window.sawItSpotWithPhoto('${itemId}')"]`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Uploading...';
    }

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (readerEvent) => {
        const fileData = readerEvent.target.result;

        // Upload photo
        const photoResult = await apiUploadPhoto(currentTripId, {
          fileName: `sawit_${activeGame.eventId}_${itemId}_${Date.now()}.jpg`,
          fileData,
          caption: `Saw it! ${getItemName(itemId)}`,
          uploadedBy: getDisplayName()
        });

        // Record sighting with photo
        await recordSighting(itemId, photoResult.url);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showToast('Failed to upload photo: ' + err.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">photo_camera</span> Saw it!';
      }
    }
  };

  input.click();
};

window.sawItSpotNoPhoto = async function(itemId) {
  const btn = document.querySelector(`[onclick="window.sawItSpotNoPhoto('${itemId}')"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Recording...';
  }

  await recordSighting(itemId, null);
};

async function recordSighting(itemId, photoUrl) {
  const result = await fetchSawItAPI(`game/${activeGame.eventId}/sight`, 'POST', {
    itemId,
    photoUrl
  });

  if (result.error) {
    showToast(result.error, 'error');
    renderCurrentStep();
    return;
  }

  activeGame = result;

  // Show social share prompt if photo was taken
  if (photoUrl) {
    showSharePrompt(itemId, photoUrl, result.points);
  } else {
    showToast(`Spotted! +${result.points || 1} points`, 'success');
  }

  renderCurrentStep();
}

function showSharePrompt(itemId, photoUrl, points) {
  const item = getItemById(itemId);

  const modal = document.createElement('div');
  modal.className = 'social-share-prompt';
  modal.id = 'sharePromptModal';
  modal.innerHTML = `
    <div class="share-prompt-content">
      <div class="share-prompt-icon">
        <span class="material-symbols-outlined">celebration</span>
      </div>
      <h4>Nice! You spotted it!</h4>
      <img src="${photoUrl}" class="share-prompt-photo" alt="Your sighting">
      <div class="share-prompt-points">
        <span class="material-symbols-outlined">add</span>
        ${points} points earned!
      </div>
      <div class="share-prompt-saved">
        <span class="material-symbols-outlined">check_circle</span>
        Photo saved to Trip Memories
      </div>
      <p>Post to social media for +1 bonus point?</p>
      <div class="share-prompt-actions">
        <button class="share-prompt-btn secondary" onclick="window.sawItCloseSharePrompt()">Done</button>
        <button class="share-prompt-btn primary" onclick="window.sawItShareToSocial('${itemId}', '${escapeAttr(item?.name || '')}', '${photoUrl}')">
          <span class="material-symbols-outlined">ios_share</span>
          Post to Social
        </button>
      </div>
    </div>
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) window.sawItCloseSharePrompt();
  });
  document.body.appendChild(modal);
}

window.sawItCloseSharePrompt = function() {
  document.getElementById('sharePromptModal')?.remove();
};

window.sawItShareToSocial = async function(itemId, itemName, photoUrl) {
  // Use Web Share API if available
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Saw it! ${itemName}`,
        text: `Spotted ${itemName} on my trip!`,
        url: photoUrl
      });

      // Record social share
      await fetchSawItAPI(`game/${activeGame.eventId}/share`, 'POST', { itemId });
      showToast('Posted! +1 bonus point', 'success');

      // Refresh game data
      const result = await fetchSawItAPI(`game/${activeGame.eventId}`, 'GET');
      if (!result.error) {
        activeGame = result;
        renderCurrentStep();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.log('Share failed:', err);
      }
    }
  } else {
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`Saw it! ${itemName} on my trip! ${photoUrl}`);
      showToast('Link copied to clipboard!', 'success');
    } catch (err) {
      showToast('Could not share', 'error');
    }
  }

  window.sawItCloseSharePrompt();
};

window.sawItEndGame = async function() {
  showConfirmModal(
    'End Game?',
    'This will close the game and show final results.',
    'End Game',
    async () => {
      const result = await fetchSawItAPI(`game/${activeGame.eventId}`, 'PUT', { action: 'complete' });

      if (result.error) {
        showToast(result.error, 'error');
        return;
      }

      activeGame = result;
      currentStep = 'results';
      renderCurrentStep();
      showToast('Game completed!', 'success');
    }
  );
};

// ========================================
// HELPER FUNCTIONS
// ========================================

function findEventById(eventId) {
  if (!DAYS) return null;
  for (const day of DAYS) {
    const event = day.events?.find(e => e.id === eventId);
    if (event) {
      event.date = day.date;
      return event;
    }
  }
  return null;
}

function getPreviousEvent(eventId) {
  if (!DAYS) return null;
  for (const day of DAYS) {
    const events = day.events || [];
    const idx = events.findIndex(e => e.id === eventId);
    if (idx > 0) {
      return events[idx - 1];
    }
  }
  return null;
}

function getHotelForDay(date) {
  if (!DAYS) return null;
  const day = DAYS.find(d => d.date === date);
  if (!day) return null;
  return day.events?.find(e => e.type === 'hotel');
}

function getDestinationCoords(date) {
  if (!DAYS || !DESTINATIONS) return null;
  const day = DAYS.find(d => d.date === date);
  if (!day || !day.destination) return null;
  const dest = DESTINATIONS[day.destination];
  return dest ? { lat: dest.lat, lon: dest.lon } : null;
}

function getDestinationCity(date) {
  if (!DAYS || !DESTINATIONS) return 'Unknown';
  const day = DAYS.find(d => d.date === date);
  if (!day || !day.destination) return day?.location || 'Unknown';
  const dest = DESTINATIONS[day.destination];
  return dest?.city || day.location || 'Unknown';
}

function getDestinationCountry(date) {
  if (!DAYS || !DESTINATIONS) return '';
  const day = DAYS.find(d => d.date === date);
  if (!day || !day.destination) return '';
  const dest = DESTINATIONS[day.destination];
  return dest?.country || '';
}

function getItemName(itemId) {
  const items = parseJSON(activeGame?.items, []);
  const item = items.find(i => i.id === itemId);
  return item?.name || 'Item';
}

function getItemById(itemId) {
  const items = parseJSON(activeGame?.items, []);
  return items.find(i => i.id === itemId);
}

function calculateMyPoints(game) {
  const travelerId = getCurrentTravelerId();
  const sightings = parseJSON(game?.sightings, []);
  return sightings
    .filter(s => s.travelerId === travelerId)
    .reduce((sum, s) => sum + (s.points || 0) + (s.photoUrl ? 1 : 0) + (s.sharedToSocial ? 1 : 0), 0);
}

function calculateLeaderboard(game) {
  const sightings = parseJSON(game?.sightings, []);
  const pointsByTraveler = {};

  sightings.forEach(s => {
    if (!pointsByTraveler[s.travelerId]) {
      pointsByTraveler[s.travelerId] = {
        travelerId: s.travelerId,
        travelerName: s.travelerName,
        totalPoints: 0
      };
    }
    pointsByTraveler[s.travelerId].totalPoints +=
      (s.points || 0) + (s.photoUrl ? 1 : 0) + (s.sharedToSocial ? 1 : 0);
  });

  return Object.values(pointsByTraveler)
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

function getUniqueSpotters(game) {
  const sightings = parseJSON(game?.sightings, []);
  const unique = new Set(sightings.map(s => s.travelerId));
  return unique.size;
}

function parseJSON(str, defaultVal) {
  if (!str) return defaultVal;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return defaultVal;
  }
}

function escapeAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ========================================
// UI HELPERS
// ========================================

function showConfirmModal(title, message, confirmText, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'saw-it-confirm-overlay';
  modal.id = 'sawItConfirmModal';
  modal.innerHTML = `
    <div class="saw-it-confirm-modal">
      <div class="confirm-icon">
        <span class="material-symbols-outlined">help</span>
      </div>
      <h4>${title}</h4>
      <p>${message}</p>
      <div class="confirm-actions">
        <button class="saw-it-action-btn secondary" onclick="window.sawItCloseConfirm()">Cancel</button>
        <button class="saw-it-action-btn primary" id="sawItConfirmBtn">${confirmText}</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) window.sawItCloseConfirm();
  });

  document.body.appendChild(modal);

  document.getElementById('sawItConfirmBtn').onclick = async () => {
    window.sawItCloseConfirm();
    await onConfirm();
  };
}

window.sawItCloseConfirm = function() {
  document.getElementById('sawItConfirmModal')?.remove();
};

function showToast(message, type = 'info') {
  document.getElementById('sawItToast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'sawItToast';
  toast.className = `saw-it-toast ${type}`;

  const icon = type === 'success' ? 'check_circle' :
               type === 'error' ? 'error' : 'info';

  toast.innerHTML = `
    <span class="material-symbols-outlined">${icon}</span>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
