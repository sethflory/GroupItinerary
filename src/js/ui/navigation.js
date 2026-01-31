// ========================================
// NAVIGATION - Phases, Travelers, Trip Selector
// ========================================

import { currentTripId, getCurrentTrip, setCurrentTripId } from '../state.js';
import { TRIPS, isFeatureEnabled } from '../config.js';
import { revokeAccess, isAccessGranted, showLockScreen, getCurrentTravelerId } from '../auth.js';

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

  const currentUserId = getCurrentTravelerId();
  const currentUser = TRAVELERS.find(t => t.id === currentUserId);
  const otherTravelers = TRAVELERS.filter(t => t.id !== currentUserId);

  // Check if current filter is "other" (not all and not me)
  const isOtherSelected = currentTravelerFilter !== 'all' && currentTravelerFilter !== currentUserId;
  const selectedOther = isOtherSelected ? TRAVELERS.find(t => t.id === currentTravelerFilter) : null;

  // All button
  const allBtn = `
    <button class="traveler-btn ${currentTravelerFilter === 'all' ? 'active' : ''}"
            onclick="setTravelerFilter('all')">
      <span class="material-symbols-outlined">group</span>
      All
    </button>
  `;

  // Me button (only if user is a traveler, not admin)
  const meBtn = currentUser ? `
    <button class="traveler-btn ${currentTravelerFilter === currentUserId ? 'active' : ''}"
            onclick="setTravelerFilter('${currentUserId}')">
      <span class="dot" style="background: ${currentUser.color}"></span>
      Me
    </button>
  ` : '';

  // Others dropdown (only if there are other travelers)
  const othersBtn = otherTravelers.length > 0 ? `
    <div class="traveler-dropdown-wrapper">
      <button class="traveler-btn ${isOtherSelected ? 'active' : ''}"
              onclick="toggleTravelerDropdown(event)">
        ${selectedOther ? `<span class="dot" style="background: ${selectedOther.color}"></span>${selectedOther.name}` : '<span class="material-symbols-outlined">person</span>Other'}
        <span class="material-symbols-outlined dropdown-arrow">expand_more</span>
      </button>
      <div class="traveler-dropdown" id="travelerDropdown">
        ${otherTravelers.map(t => `
          <div class="traveler-dropdown-item ${currentTravelerFilter === t.id ? 'active' : ''}"
               onclick="setTravelerFilter('${t.id}')">
            <span class="dot" style="background: ${t.color}"></span>
            ${t.name}
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  container.innerHTML = allBtn + meBtn + othersBtn;
}

export function toggleTravelerDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('travelerDropdown');
  if (dropdown) {
    dropdown.classList.toggle('visible');
  }
}

// Close traveler dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.traveler-dropdown-wrapper');
  const dropdown = document.getElementById('travelerDropdown');
  if (wrapper && dropdown && !wrapper.contains(e.target)) {
    dropdown.classList.remove('visible');
  }
});

export function setTravelerFilter(filter) {
  currentTravelerFilter = filter;
  // Close dropdown if open
  const dropdown = document.getElementById('travelerDropdown');
  if (dropdown) dropdown.classList.remove('visible');
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
  // Phase tabs removed - using simplified day navigation instead
  return;
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

  // Also close day dropdown
  const dayDropdown = document.getElementById('dayDropdown');
  const dayMenu = document.getElementById('dayDropdownMenu');
  if (dayDropdown && dayMenu && !dayDropdown.contains(e.target) && !dayMenu.contains(e.target)) {
    dayDropdown.classList.remove('open');
    dayMenu.classList.remove('visible');
  }
});

// ========================================
// DAY DROPDOWN (Action Bar)
// ========================================

let currentDayIndex = 0;

export function renderDayDropdown() {
  const menu = document.getElementById('dayDropdownMenu');
  const label = document.getElementById('dayDropdownLabel');
  if (!menu || !DAYS) return;

  const today = new Date();
  const trip = getCurrentTrip();
  const startDate = trip ? new Date(trip.startDate) : null;

  menu.innerHTML = DAYS.map((day, index) => {
    const isActive = index === currentDayIndex;
    const isToday = startDate && isSameDay(addDays(startDate, index), today);
    const classes = `day-dropdown-item ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`;

    return `
      <div class="${classes}" onclick="selectDay(${index})">
        <span class="day-num">Day ${index + 1}</span>
        <span class="day-location">${day.location || ''}</span>
        ${isToday ? '<span class="today-badge">Today</span>' : ''}
      </div>
    `;
  }).join('');

  if (label) {
    label.textContent = `Day ${currentDayIndex + 1}`;
  }
}

export function toggleDayDropdown() {
  const dropdown = document.getElementById('dayDropdown');
  const menu = document.getElementById('dayDropdownMenu');

  if (dropdown && menu) {
    dropdown.classList.toggle('open');
    menu.classList.toggle('visible');
  }
}

export function selectDay(dayIndex) {
  currentDayIndex = dayIndex;
  toggleDayDropdown();
  renderDayDropdown();

  // Trigger day change
  if (typeof window.goToDay === 'function') {
    window.goToDay(dayIndex);
  }
}

export function setCurrentDayIndex(index) {
  currentDayIndex = index;
  renderDayDropdown();
}

// Helpers
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ========================================
// DAY NAVIGATION (Prev/Next)
// ========================================

export function goToPrevDay() {
  if (currentDayIndex > 0) {
    selectDay(currentDayIndex - 1);
  }
  updateDayNavButtons();
}

export function goToNextDay() {
  if (DAYS && currentDayIndex < DAYS.length - 1) {
    selectDay(currentDayIndex + 1);
  }
  updateDayNavButtons();
}

export function updateDayNavButtons() {
  const prevBtn = document.getElementById('prevDayBtn');
  const nextBtn = document.getElementById('nextDayBtn');
  const prevBtnBottom = document.getElementById('prevDayBtnBottom');
  const nextBtnBottom = document.getElementById('nextDayBtnBottom');

  const isFirst = currentDayIndex === 0;
  const isLast = !DAYS || currentDayIndex >= DAYS.length - 1;

  if (prevBtn) prevBtn.disabled = isFirst;
  if (nextBtn) nextBtn.disabled = isLast;
  if (prevBtnBottom) prevBtnBottom.disabled = isFirst;
  if (nextBtnBottom) nextBtnBottom.disabled = isLast;
}
