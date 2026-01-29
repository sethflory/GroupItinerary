// ========================================
// NAVIGATION - Phases, Travelers, Trip Selector
// ========================================

import { currentTripId, getCurrentTrip, setCurrentTripId } from '../state.js';
import { TRIPS, isFeatureEnabled } from '../config.js';
import { revokeAccess, isAccessGranted, showLockScreen } from '../auth.js';

let TRAVELERS, PHASES, DAYS;
let currentTravelerFilter = 'all';
let currentPhase = null;
let currentView = 'journey';
let onFilterChange = null;
let onPhaseChange = null;
let onViewChange = null;

export function setNavigationDeps(deps) {
  TRAVELERS = deps.TRAVELERS;
  PHASES = deps.PHASES;
  DAYS = deps.DAYS;
}

export function setNavigationCallbacks(callbacks) {
  onFilterChange = callbacks.onFilterChange;
  onPhaseChange = callbacks.onPhaseChange;
  onViewChange = callbacks.onViewChange;
}

// ========================================
// TRAVELER TOGGLE
// ========================================

export function renderTravelerToggle() {
  const container = document.getElementById('travelerToggle');
  if (!container) return;

  const allBtn = `
    <button class="traveler-btn ${currentTravelerFilter === 'all' ? 'active' : ''}"
            onclick="setTravelerFilter('all')">
      All
    </button>
  `;

  const travelerBtns = TRAVELERS.map(t => `
    <button class="traveler-btn ${currentTravelerFilter === t.id ? 'active' : ''}"
            onclick="setTravelerFilter('${t.id}')">
      <span class="dot" style="background: ${t.color}"></span>
      ${t.name}
    </button>
  `).join('');

  container.innerHTML = allBtn + travelerBtns;
}

export function setTravelerFilter(filter) {
  currentTravelerFilter = filter;
  renderTravelerToggle();
  if (onFilterChange) onFilterChange(filter);
}

export function getTravelerFilter() {
  return currentTravelerFilter;
}

// ========================================
// PHASE TABS
// ========================================

export function renderPhaseTabs() {
  const container = document.getElementById('phaseTabs');
  if (!container || !PHASES) return;

  container.innerHTML = Object.entries(PHASES).map(([key, phase]) => {
    const isActive = currentPhase === key;
    const phaseDays = DAYS.filter(d => d.date >= phase.startDate && d.date <= phase.endDate);
    const isDisabled = phaseDays.length === 0;

    return `
      <button class="phase-tab ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}"
              onclick="${isDisabled ? '' : `setPhase('${key}')`}"
              ${isDisabled ? 'disabled' : ''}>
        <span>${phase.icon}</span>
        <span>${phase.label}</span>
        <span class="phase-tab-dates">${phase.dates}</span>
      </button>
    `;
  }).join('');

  // Add Today button
  container.innerHTML += `
    <button class="today-btn" id="todayBtn" onclick="goToToday()">
      <span class="material-symbols-outlined">today</span>
      Today
    </button>
  `;
}

export function setPhase(phase) {
  currentPhase = phase;
  renderPhaseTabs();
  if (onPhaseChange) onPhaseChange(phase);
}

export function getPhase() {
  return currentPhase;
}

// ========================================
// VIEW TOGGLE
// ========================================

export function setView(view) {
  currentView = view;

  const journeyView = document.getElementById('journeyView');
  const listView = document.getElementById('listView');
  const journeyBtn = document.getElementById('journeyViewBtn');
  const listBtn = document.getElementById('listViewBtn');

  if (view === 'journey') {
    journeyView?.classList.remove('hidden');
    listView?.classList.remove('visible');
    journeyBtn?.classList.add('active');
    listBtn?.classList.remove('active');
  } else {
    journeyView?.classList.add('hidden');
    listView?.classList.add('visible');
    journeyBtn?.classList.remove('active');
    listBtn?.classList.add('active');
  }

  if (onViewChange) onViewChange(view);
}

export function getView() {
  return currentView;
}

// ========================================
// TRIP SELECTOR
// ========================================

export function renderTripSelector() {
  const container = document.getElementById('tripSelectorDropdown');
  const currentTrip = getCurrentTrip();
  const titleEl = document.getElementById('tripTitle');
  const datesEl = document.getElementById('tripDates');

  if (titleEl) titleEl.textContent = currentTrip.name;
  if (datesEl) datesEl.textContent = currentTrip.dates;

  if (!container) return;

  container.innerHTML = Object.values(TRIPS).map(trip => `
    <div class="trip-option ${trip.id === currentTripId ? 'active' : ''}"
         onclick="switchTrip('${trip.id}')">
      <div class="trip-option-icon">${trip.icon}</div>
      <div class="trip-option-info">
        <div class="trip-option-name">${trip.name}</div>
        <div class="trip-option-dates">${trip.dates}</div>
      </div>
      <span class="trip-option-badge ${trip.badge}">${trip.badge}</span>
    </div>
  `).join('');

  // Add lock option
  container.innerHTML += `
    <div class="trip-option" onclick="lockTrip()">
      <div class="trip-option-icon">🔒</div>
      <div class="trip-option-info">
        <div class="trip-option-name">Lock Trip</div>
        <div class="trip-option-dates">Require access code again</div>
      </div>
    </div>
  `;
}

export function toggleTripSelector() {
  document.getElementById('tripSelectorDropdown').classList.toggle('visible');
}

export function switchTrip(tripId) {
  if (tripId === currentTripId) {
    toggleTripSelector();
    return;
  }

  setCurrentTripId(tripId);
  toggleTripSelector();

  // Check if we have access to the new trip
  if (!isAccessGranted(tripId)) {
    showLockScreen();
  }

  // Reload the page to reset all state
  window.location.reload();
}

export function lockTrip() {
  revokeAccess(currentTripId);
  toggleTripSelector();
  showLockScreen();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const selector = document.querySelector('.trip-selector-wrapper');
  const dropdown = document.getElementById('tripSelectorDropdown');
  if (selector && dropdown && !selector.contains(e.target)) {
    dropdown.classList.remove('visible');
  }
});
