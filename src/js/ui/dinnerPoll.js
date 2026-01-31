// ========================================
// DINNER POLL - "What's for Dinner?"
// ========================================

import { currentTripId } from '../state.js';
import { API_BASE } from '../config.js';
import { getStoredAccessCode, getCurrentTravelerId, isAdmin } from '../auth.js';
import { createEvent } from '../api.js';

// State
let currentStep = 'select-day';
let selectedDay = null;
let filters = { cuisineTypes: [], priceRange: [], deliveryOnly: false };
let optionCount = 4;
let generatedOptions = [];
let excludedOptions = new Set();
let activePolls = [];
let currentPoll = null;
let myVote = null;

// Dependencies injected by app.js
let DAYS, TRAVELERS, DESTINATIONS;

export function setDinnerPollDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
  DESTINATIONS = deps.DESTINATIONS;
}

// Check if there's an active poll for a specific date
export function getActivePollForDate(date) {
  return activePolls.find(p => p.status === 'active' && p.date === date) || null;
}

// Get all active polls (for external use)
export function getActivePolls() {
  return activePolls.filter(p => p.status === 'active');
}

// Refresh active polls from API (can be called externally)
export async function refreshActivePolls() {
  await loadActivePolls();
  return activePolls;
}

// ========================================
// API CALLS
// ========================================

async function fetchDinnerAPI(endpoint, method = 'GET', body = null) {
  const accessCode = getStoredAccessCode(currentTripId);
  const url = `${API_BASE}/dinners/${endpoint}?tripId=${encodeURIComponent(currentTripId)}&accessCode=${encodeURIComponent(accessCode)}`;

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
    console.error(`Dinner API error (${response.status}):`, text);
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

export function openDinnerPollModal() {
  let modal = document.getElementById('dinnerPollModal');
  if (!modal) {
    createDinnerPollModal();
    modal = document.getElementById('dinnerPollModal');
  }

  // Reset state
  currentStep = 'select-day';
  selectedDay = null;
  filters = { cuisineTypes: [], priceRange: [], deliveryOnly: false };
  optionCount = 4;
  generatedOptions = [];
  excludedOptions.clear();
  currentPoll = null;
  myVote = null;

  modal.classList.add('active');
  loadActivePolls();
  renderCurrentStep();
}

export function closeDinnerPollModal() {
  document.getElementById('dinnerPollModal')?.classList.remove('active');
}

function createDinnerPollModal() {
  const modal = document.createElement('div');
  modal.id = 'dinnerPollModal';
  modal.className = 'share-modal-overlay';
  modal.innerHTML = `
    <div class="share-modal dinner-poll-modal">
      <div class="dinner-poll-header">
        <h3><span class="material-symbols-outlined">restaurant_menu</span> What's for Dinner?</h3>
        <button class="modal-close" onclick="closeDinnerPollModal()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="dinner-poll-content" id="dinnerPollContent">
        <!-- Content rendered by step functions -->
      </div>
    </div>
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDinnerPollModal();
  });
  document.body.appendChild(modal);
}

// ========================================
// STEP RENDERING
// ========================================

function renderCurrentStep() {
  switch (currentStep) {
    case 'select-day':
      renderSelectDayStep();
      break;
    case 'configure':
      renderConfigureStep();
      break;
    case 'preview':
      renderPreviewStep();
      break;
    case 'poll':
      renderPollStep();
      break;
    case 'results':
      renderResultsStep();
      break;
  }
}

async function loadActivePolls() {
  const result = await fetchDinnerAPI('polls', 'GET');
  if (!result.error) {
    activePolls = result.polls || [];
  }
}

function getDaysNeedingDinner() {
  if (!DAYS) return [];

  return DAYS.filter(day => {
    const hasDinner = day.events?.some(e =>
      e.type === 'meal' &&
      e.time >= '17:00'
    );
    return !hasDinner;
  });
}

function renderSelectDayStep() {
  const container = document.getElementById('dinnerPollContent');
  const daysNeedingDinner = getDaysNeedingDinner();

  // Check for existing active polls
  const activePollDates = new Set(activePolls.filter(p => p.status === 'active').map(p => p.date));

  container.innerHTML = `
    <div class="dinner-step select-day-step">
      ${activePolls.length > 0 ? `
        <div class="dinner-active-polls">
          <h4>Active Polls</h4>
          <div class="active-polls-list">
            ${activePolls.filter(p => p.status === 'active').map(poll => `
              <button class="active-poll-btn" onclick="window.dinnerPollViewPoll('${poll.id}')">
                <span class="material-symbols-outlined">how_to_vote</span>
                <div class="poll-info">
                  <div class="poll-date">${formatPollDate(poll.date)}</div>
                  <div class="poll-votes">${poll.totalVotes} vote${poll.totalVotes !== 1 ? 's' : ''}</div>
                </div>
                <span class="material-symbols-outlined">chevron_right</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <h4>Create New Poll</h4>
      <p class="dinner-subtitle">Select a day that needs dinner plans:</p>

      <div class="dinner-days-grid">
        ${daysNeedingDinner.length === 0 ? `
          <div class="no-days-message">
            <span class="material-symbols-outlined">check_circle</span>
            <p>All days have dinner plans!</p>
          </div>
        ` : daysNeedingDinner.map(day => {
          const hasActivePoll = activePollDates.has(day.date);
          return `
            <label class="dinner-day-option ${hasActivePoll ? 'has-poll' : ''}">
              <input type="radio" name="dinnerDay" value="${day.date}"
                ${hasActivePoll ? 'disabled' : ''}
                onchange="window.dinnerPollSelectDay('${day.date}')">
              <div class="day-option-content">
                <div class="day-option-num">Day ${day.dayNum}</div>
                <div class="day-option-label">${day.label}</div>
                <div class="day-option-location">${day.location}</div>
                ${hasActivePoll ? '<div class="poll-active-badge">Poll Active</div>' : ''}
              </div>
            </label>
          `;
        }).join('')}
      </div>

      <div class="dinner-actions">
        <button class="dinner-btn secondary" onclick="closeDinnerPollModal()">Cancel</button>
        <button class="dinner-btn primary" id="nextToConfigure" disabled onclick="window.dinnerPollGoToConfigure()">
          Next
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  `;
}

function renderConfigureStep() {
  const container = document.getElementById('dinnerPollContent');
  const day = DAYS?.find(d => d.date === selectedDay);
  const dest = day?.destination ? DESTINATIONS?.[day.destination] : null;

  container.innerHTML = `
    <div class="dinner-step configure-step">
      <div class="dinner-step-header">
        <button class="dinner-back-btn" onclick="window.dinnerPollGoBack()">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h4>Configure Options</h4>
          <p class="dinner-subtitle">${day?.label || selectedDay} in ${dest?.city || day?.location || 'your destination'}</p>
        </div>
      </div>

      <div class="dinner-filters">
        <div class="filter-group">
          <label>Cuisine Types</label>
          <div class="filter-chips" id="cuisineChips">
            ${['Any', 'Italian', 'Greek', 'Asian', 'Mediterranean', 'American', 'Indian', 'Mexican', 'French'].map(c => `
              <button class="filter-chip ${c === 'Any' ? 'active' : ''}" data-value="${c.toLowerCase()}" onclick="window.dinnerPollToggleCuisine(this)">
                ${c}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="filter-group">
          <label>Price Range</label>
          <div class="filter-chips" id="priceChips">
            ${['$', '$$', '$$$', '$$$$'].map(p => `
              <button class="filter-chip" data-value="${p}" onclick="window.dinnerPollTogglePrice(this)">
                ${p}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="filter-group">
          <label>Delivery</label>
          <div class="filter-chips">
            <button class="filter-chip active" data-value="any" onclick="window.dinnerPollSetDelivery(false, this)">Either</button>
            <button class="filter-chip" data-value="yes" onclick="window.dinnerPollSetDelivery(true, this)">Delivery Only</button>
          </div>
        </div>

        <div class="filter-group">
          <label>Number of Options: <span id="optionCountDisplay">${optionCount}</span></label>
          <input type="range" min="3" max="5" value="${optionCount}" class="option-slider"
            oninput="window.dinnerPollSetOptionCount(this.value)">
        </div>
      </div>

      <div class="dinner-actions">
        <button class="dinner-btn secondary" onclick="window.dinnerPollGoBack()">Back</button>
        <button class="dinner-btn primary" onclick="window.dinnerPollGenerateOptions()">
          <img src="images/keys.png" alt="AI" class="ai-key-icon small">
          Generate Options
        </button>
      </div>
    </div>
  `;
}

function renderPreviewStep() {
  const container = document.getElementById('dinnerPollContent');

  container.innerHTML = `
    <div class="dinner-step preview-step">
      <div class="dinner-step-header">
        <button class="dinner-back-btn" onclick="window.dinnerPollGoBack()">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h4>Review Recommendations</h4>
          <p class="dinner-subtitle">Uncheck any options you want to exclude from the poll</p>
        </div>
      </div>

      <div class="dinner-options-preview" id="optionsPreview">
        ${generatedOptions.map((opt, idx) => `
          <div class="dinner-option-preview ${excludedOptions.has(opt.id) ? 'excluded' : ''} ${opt.historicalVotes > 0 ? 'has-history' : ''}">
            <label class="option-checkbox">
              <input type="checkbox" ${excludedOptions.has(opt.id) ? '' : 'checked'}
                onchange="window.dinnerPollToggleOption('${opt.id}', this.checked)">
              <span class="checkmark"></span>
            </label>
            <div class="option-details">
              <div class="option-header">
                <span class="option-name">${opt.name}</span>
                ${opt.historicalVotes > 0 ? `<span class="historical-votes"><span class="material-symbols-outlined">thumb_up</span>${opt.historicalVotes}</span>` : ''}
                ${opt.isNew ? '<span class="new-option-badge">New</span>' : ''}
                <span class="option-price">${opt.priceRange}</span>
              </div>
              <div class="option-cuisine">${opt.cuisine}${opt.hasDelivery ? ' • Delivery' : ''}</div>
              <div class="option-description">${opt.description}</div>
              <div class="option-reason">
                <span class="material-symbols-outlined">lightbulb</span>
                ${opt.aiReason}
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="dinner-actions">
        <button class="dinner-btn secondary" onclick="window.dinnerPollRegenerate()">
          <span class="material-symbols-outlined">refresh</span>
          Regenerate
        </button>
        <button class="dinner-btn primary" onclick="window.dinnerPollCreatePoll()" id="createPollBtn">
          <span class="material-symbols-outlined">how_to_vote</span>
          Create Poll
        </button>
      </div>
    </div>
  `;
}

function renderPollStep() {
  const container = document.getElementById('dinnerPollContent');
  const poll = currentPoll;

  if (!poll) {
    container.innerHTML = '<p>Loading poll...</p>';
    return;
  }

  const travelerId = getCurrentTravelerId();
  const isCreator = poll.createdBy === travelerId;
  const canClose = isCreator || isAdmin();

  // Find user's current vote
  myVote = poll.votes?.find(v => v.travelerId === travelerId)?.optionId || null;

  container.innerHTML = `
    <div class="dinner-step poll-step">
      <div class="dinner-step-header">
        <div>
          <h4>Vote for Dinner</h4>
          <p class="dinner-subtitle">${formatPollDate(poll.date)} • ${poll.totalVotes} vote${poll.totalVotes !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div class="dinner-vote-options">
        ${poll.options.map(opt => {
          const percentage = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
          const isMyVote = myVote === opt.id;
          return `
            <div class="dinner-vote-card ${isMyVote ? 'my-vote' : ''}" onclick="window.dinnerPollVote('${opt.id}')">
              <div class="vote-card-header">
                <div class="vote-card-info">
                  <span class="vote-card-name">${opt.name}</span>
                  <span class="vote-card-meta">${opt.cuisine} • ${opt.priceRange}</span>
                </div>
                <div class="vote-card-count">${opt.voteCount}</div>
              </div>
              <div class="vote-bar">
                <div class="vote-bar-fill" style="width: ${percentage}%"></div>
              </div>
              <div class="vote-card-desc">${opt.description}</div>
              ${isMyVote ? '<div class="my-vote-badge"><span class="material-symbols-outlined">check</span> Your vote</div>' : ''}
            </div>
          `;
        }).join('')}
      </div>

      <div class="dinner-actions">
        <button class="dinner-btn secondary" onclick="closeDinnerPollModal()">Close</button>
        ${canClose ? `
          <button class="dinner-btn primary" onclick="window.dinnerPollClosePoll()">
            <span class="material-symbols-outlined">done_all</span>
            Close Poll
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderResultsStep() {
  const container = document.getElementById('dinnerPollContent');
  const poll = currentPoll;

  if (!poll) {
    container.innerHTML = '<p>Loading results...</p>';
    return;
  }

  const travelerId = getCurrentTravelerId();
  const isCreator = poll.createdBy === travelerId;
  const canAddToItinerary = isCreator || isAdmin();

  // Sort options by vote count
  const sortedOptions = [...poll.options].sort((a, b) => b.voteCount - a.voteCount);

  container.innerHTML = `
    <div class="dinner-step results-step">
      <div class="dinner-step-header">
        <div>
          <h4>Poll Results</h4>
          <p class="dinner-subtitle">${formatPollDate(poll.date)} • ${poll.totalVotes} total vote${poll.totalVotes !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div class="dinner-results-list">
        ${sortedOptions.map((opt, idx) => {
          const percentage = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
          const isWinner = idx === 0;
          const isSelected = poll.selectedOptionId === opt.id;
          return `
            <div class="dinner-result-card ${isWinner ? 'winner' : ''} ${isSelected ? 'selected' : ''}">
              <div class="result-rank">${idx + 1}</div>
              <div class="result-details">
                <div class="result-header">
                  <span class="result-name">${opt.name}</span>
                  ${isWinner ? '<span class="winner-badge">Winner</span>' : ''}
                </div>
                <div class="result-meta">${opt.cuisine} • ${opt.priceRange}</div>
                <div class="result-votes">${opt.voteCount} vote${opt.voteCount !== 1 ? 's' : ''} (${percentage}%)</div>
              </div>
              ${canAddToItinerary && !poll.eventId ? `
                <button class="add-to-itinerary-btn" onclick="window.dinnerPollAddToItinerary('${opt.id}')">
                  <span class="material-symbols-outlined">add_circle</span>
                  Add to Itinerary
                </button>
              ` : ''}
              ${isSelected ? '<span class="selected-badge">Added</span>' : ''}
            </div>
          `;
        }).join('')}
      </div>

      <div class="dinner-actions">
        <button class="dinner-btn primary" onclick="closeDinnerPollModal()">Done</button>
      </div>
    </div>
  `;
}

// ========================================
// WINDOW FUNCTIONS (for onclick handlers)
// ========================================

window.dinnerPollSelectDay = function(date) {
  selectedDay = date;
  document.getElementById('nextToConfigure').disabled = false;
};

window.dinnerPollGoToConfigure = function() {
  if (!selectedDay) return;
  currentStep = 'configure';
  renderCurrentStep();
};

window.dinnerPollGoBack = function() {
  if (currentStep === 'configure') {
    currentStep = 'select-day';
  } else if (currentStep === 'preview') {
    currentStep = 'configure';
  } else if (currentStep === 'poll') {
    currentStep = 'select-day';
    currentPoll = null;
  } else if (currentStep === 'results') {
    currentStep = 'select-day';
    currentPoll = null;
  }
  renderCurrentStep();
};

window.dinnerPollToggleCuisine = function(btn) {
  const value = btn.dataset.value;

  if (value === 'any') {
    // Clear all other selections
    filters.cuisineTypes = [];
    document.querySelectorAll('#cuisineChips .filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.value === 'any');
    });
  } else {
    // Deselect "Any" and toggle this one
    document.querySelector('#cuisineChips .filter-chip[data-value="any"]')?.classList.remove('active');
    btn.classList.toggle('active');

    if (btn.classList.contains('active')) {
      if (!filters.cuisineTypes.includes(value)) {
        filters.cuisineTypes.push(value);
      }
    } else {
      filters.cuisineTypes = filters.cuisineTypes.filter(c => c !== value);
    }

    // If nothing selected, re-select "Any"
    if (filters.cuisineTypes.length === 0) {
      document.querySelector('#cuisineChips .filter-chip[data-value="any"]')?.classList.add('active');
    }
  }
};

window.dinnerPollTogglePrice = function(btn) {
  const value = btn.dataset.value;
  btn.classList.toggle('active');

  if (btn.classList.contains('active')) {
    if (!filters.priceRange.includes(value)) {
      filters.priceRange.push(value);
    }
  } else {
    filters.priceRange = filters.priceRange.filter(p => p !== value);
  }
};

window.dinnerPollSetDelivery = function(deliveryOnly, btn) {
  filters.deliveryOnly = deliveryOnly;
  btn.parentElement.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
};

window.dinnerPollSetOptionCount = function(count) {
  optionCount = parseInt(count);
  document.getElementById('optionCountDisplay').textContent = count;
};

window.dinnerPollGenerateOptions = async function() {
  const container = document.getElementById('dinnerPollContent');
  const day = DAYS?.find(d => d.date === selectedDay);
  const dest = day?.destination ? DESTINATIONS?.[day.destination] : null;

  // Show loading
  container.innerHTML = `
    <div class="dinner-loading">
      <div class="spinner"></div>
      <p>Generating restaurant recommendations...</p>
    </div>
  `;

  const destination = {
    city: dest?.city || day?.location || 'Unknown',
    country: dest?.country || ''
  };

  const result = await fetchDinnerAPI('recommend', 'POST', {
    destination,
    date: selectedDay,
    travelerCount: TRAVELERS?.length || 4,
    filters,
    optionCount
  });

  if (result.error) {
    container.innerHTML = `
      <div class="dinner-error">
        <span class="material-symbols-outlined">error</span>
        <p>${result.error}</p>
        <button class="dinner-btn secondary" onclick="window.dinnerPollGoBack()">Go Back</button>
      </div>
    `;
    return;
  }

  generatedOptions = result.options || [];
  excludedOptions.clear();
  currentStep = 'preview';
  renderCurrentStep();
};

window.dinnerPollToggleOption = function(optionId, included) {
  if (included) {
    excludedOptions.delete(optionId);
  } else {
    excludedOptions.add(optionId);
  }

  // Update button state
  const validCount = generatedOptions.length - excludedOptions.size;
  document.getElementById('createPollBtn').disabled = validCount < 2;
};

window.dinnerPollRegenerate = function() {
  currentStep = 'configure';
  renderCurrentStep();
};

window.dinnerPollCreatePoll = async function() {
  const options = generatedOptions.filter(opt => !excludedOptions.has(opt.id));

  if (options.length < 2) {
    showToast('Please include at least 2 options in the poll.', 'error');
    return;
  }

  const container = document.getElementById('dinnerPollContent');
  container.innerHTML = `
    <div class="dinner-loading">
      <div class="spinner"></div>
      <p>Creating poll...</p>
    </div>
  `;

  const result = await fetchDinnerAPI('polls', 'POST', {
    date: selectedDay,
    filters,
    options
  });

  if (result.error) {
    container.innerHTML = `
      <div class="dinner-error">
        <span class="material-symbols-outlined">error</span>
        <p>${result.error}</p>
        <button class="dinner-btn secondary" onclick="window.dinnerPollGoBack()">Go Back</button>
      </div>
    `;
    return;
  }

  currentPoll = result;
  currentStep = 'poll';
  renderCurrentStep();
};

window.dinnerPollViewPoll = async function(pollId) {
  const container = document.getElementById('dinnerPollContent');
  container.innerHTML = `
    <div class="dinner-loading">
      <div class="spinner"></div>
      <p>Loading poll...</p>
    </div>
  `;

  const result = await fetchDinnerAPI(`polls/${pollId}`, 'GET');

  if (result.error) {
    container.innerHTML = `
      <div class="dinner-error">
        <span class="material-symbols-outlined">error</span>
        <p>${result.error}</p>
        <button class="dinner-btn secondary" onclick="window.dinnerPollGoBack()">Go Back</button>
      </div>
    `;
    return;
  }

  currentPoll = result;

  if (result.status === 'active') {
    currentStep = 'poll';
  } else {
    currentStep = 'results';
  }

  renderCurrentStep();
};

window.dinnerPollVote = async function(optionId) {
  if (!currentPoll) return;

  const result = await fetchDinnerAPI(`vote/${currentPoll.id}`, 'POST', { optionId });

  if (result.error) {
    showToast(result.error, 'error');
    return;
  }

  currentPoll = result;
  renderCurrentStep();
  showToast('Vote recorded!', 'success');
};

window.dinnerPollClosePoll = async function() {
  if (!currentPoll) return;

  showConfirmModal(
    'Close Poll?',
    'No more votes will be accepted after closing.',
    'Close Poll',
    async () => {
      const result = await fetchDinnerAPI(`polls/${currentPoll.id}`, 'PUT', { action: 'close' });

      if (result.error) {
        showToast(result.error, 'error');
        return;
      }

      currentPoll = result;
      currentStep = 'results';
      renderCurrentStep();
      showToast('Poll closed successfully', 'success');
    }
  );
};

window.dinnerPollAddToItinerary = async function(optionId) {
  if (!currentPoll) return;

  const option = currentPoll.options.find(o => o.id === optionId);
  if (!option) return;

  // Show loading state on button
  const btn = document.querySelector(`[onclick="window.dinnerPollAddToItinerary('${optionId}')"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Adding...';
  }

  try {
    // Create the meal event
    const eventData = {
      date: currentPoll.date,
      time: '19:00',
      endTime: '21:00',
      type: 'meal',
      title: option.name,
      subtitle: `${option.cuisine} • ${option.priceRange}`,
      details: option.description,
      where: option.address,
      mapsLink: option.mapsLink,
      travelers: ['all'],
      isUserGenerated: true
    };

    const createdEvent = await createEvent(currentTripId, eventData);

    // Update poll with event ID
    const updatedPoll = await fetchDinnerAPI(`polls/${currentPoll.id}`, 'PUT', {
      selectedOptionId: optionId,
      eventId: createdEvent.id
    });

    if (updatedPoll.error) {
      throw new Error(updatedPoll.error);
    }

    // Update local poll state
    currentPoll = updatedPoll;

    // Refresh trip data to show new event
    if (window.refreshTripData) {
      await window.refreshTripData();
    }

    // Re-render results to show "Added" badge
    renderCurrentStep();

    // Show reservation prompt
    showReservationPrompt(option);

  } catch (err) {
    showToast('Failed to add to itinerary: ' + err.message, 'error');
    // Restore button
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Add to Itinerary';
    }
  }
};

function showReservationPrompt(restaurant) {
  const modal = document.createElement('div');
  modal.className = 'reservation-prompt-overlay';
  modal.id = 'reservationPromptModal';
  modal.innerHTML = `
    <div class="reservation-prompt">
      <div class="reservation-icon">
        <span class="material-symbols-outlined">restaurant</span>
      </div>
      <h4>Added to Itinerary!</h4>
      <div class="reservation-restaurant">
        <strong>${restaurant.name}</strong>
        <span>${restaurant.address}</span>
      </div>
      <p>Would you like to make a reservation?</p>
      <div class="reservation-options">
        ${restaurant.websiteUrl ? `
          <button class="reservation-btn" onclick="window.dinnerPollOpenUrl('${restaurant.websiteUrl}')">
            <span class="material-symbols-outlined">language</span>
            Visit Website
          </button>
        ` : ''}
        ${restaurant.phoneNumber ? `
          <button class="reservation-btn" onclick="window.dinnerPollCall('${restaurant.phoneNumber}')">
            <span class="material-symbols-outlined">call</span>
            Call Restaurant
          </button>
        ` : ''}
        <button class="reservation-btn" onclick="window.dinnerPollOpenUrl('${restaurant.mapsLink}')">
          <span class="material-symbols-outlined">directions</span>
          Get Directions
        </button>
      </div>
      <button class="reservation-skip" onclick="window.dinnerPollCloseReservationPrompt()">Skip</button>
    </div>
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) window.dinnerPollCloseReservationPrompt();
  });
  document.body.appendChild(modal);
}

window.dinnerPollOpenUrl = function(url) {
  window.open(url, '_blank');
};

window.dinnerPollCall = function(phone) {
  window.location.href = 'tel:' + phone;
};

window.dinnerPollCloseReservationPrompt = function() {
  const modal = document.getElementById('reservationPromptModal');
  modal?.remove();
  closeDinnerPollModal();
};

// ========================================
// CUSTOM MODALS & TOASTS
// ========================================

function showConfirmModal(title, message, confirmText, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'dinner-confirm-overlay';
  modal.id = 'dinnerConfirmModal';
  modal.innerHTML = `
    <div class="dinner-confirm-modal">
      <div class="confirm-icon">
        <span class="material-symbols-outlined">help</span>
      </div>
      <h4>${title}</h4>
      <p>${message}</p>
      <div class="confirm-actions">
        <button class="dinner-btn secondary" onclick="window.dinnerCloseConfirm()">Cancel</button>
        <button class="dinner-btn primary" id="confirmActionBtn">${confirmText}</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) window.dinnerCloseConfirm();
  });

  document.body.appendChild(modal);

  // Attach confirm handler
  document.getElementById('confirmActionBtn').onclick = async () => {
    window.dinnerCloseConfirm();
    await onConfirm();
  };
}

window.dinnerCloseConfirm = function() {
  document.getElementById('dinnerConfirmModal')?.remove();
};

function showToast(message, type = 'info') {
  // Remove existing toast
  document.getElementById('dinnerToast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'dinnerToast';
  toast.className = `dinner-toast ${type}`;

  const icon = type === 'success' ? 'check_circle' :
               type === 'error' ? 'error' : 'info';

  toast.innerHTML = `
    <span class="material-symbols-outlined">${icon}</span>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================================
// HELPERS
// ========================================

function formatPollDate(dateStr) {
  const day = DAYS?.find(d => d.date === dateStr);
  if (day) {
    return `Day ${day.dayNum} - ${day.label}`;
  }
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
