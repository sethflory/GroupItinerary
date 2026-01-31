// ========================================
// TIMEZONE CLOCKS WIDGET
// ========================================

import { getCurrentTrip } from '../state.js';

let DAYS = [];
let clockInterval = null;

// Stored preferences
let homeTimezone = localStorage.getItem('homeTimezone') || 'America/Chicago';
let homeCity = localStorage.getItem('homeCity') || 'Home';
let customTimezone = localStorage.getItem('customTimezone') || null;
let customCity = localStorage.getItem('customCity') || null;

// Common timezones for quick selection
const TIMEZONE_OPTIONS = [
  { tz: 'America/New_York', city: 'New York' },
  { tz: 'America/Chicago', city: 'Chicago' },
  { tz: 'America/Denver', city: 'Denver' },
  { tz: 'America/Los_Angeles', city: 'LA' },
  { tz: 'Europe/London', city: 'London' },
  { tz: 'Europe/Paris', city: 'Paris' },
  { tz: 'Europe/Athens', city: 'Athens' },
  { tz: 'Asia/Dubai', city: 'Dubai' },
  { tz: 'Asia/Kolkata', city: 'India' },
  { tz: 'Asia/Singapore', city: 'Singapore' },
  { tz: 'Asia/Tokyo', city: 'Tokyo' },
  { tz: 'Australia/Sydney', city: 'Sydney' }
];

// Location to timezone mapping
const LOCATION_TIMEZONES = {
  'athens': { tz: 'Europe/Athens', city: 'Athens' },
  'greece': { tz: 'Europe/Athens', city: 'Athens' },
  'santorini': { tz: 'Europe/Athens', city: 'Santorini' },
  'bangalore': { tz: 'Asia/Kolkata', city: 'Bangalore' },
  'india': { tz: 'Asia/Kolkata', city: 'India' },
  'delhi': { tz: 'Asia/Kolkata', city: 'Delhi' },
  'mumbai': { tz: 'Asia/Kolkata', city: 'Mumbai' },
  'london': { tz: 'Europe/London', city: 'London' },
  'paris': { tz: 'Europe/Paris', city: 'Paris' },
  'rome': { tz: 'Europe/Rome', city: 'Rome' },
  'tokyo': { tz: 'Asia/Tokyo', city: 'Tokyo' },
  'sydney': { tz: 'Australia/Sydney', city: 'Sydney' },
  'new york': { tz: 'America/New_York', city: 'New York' },
  'chicago': { tz: 'America/Chicago', city: 'Chicago' },
  'los angeles': { tz: 'America/Los_Angeles', city: 'LA' },
  'dubai': { tz: 'Asia/Dubai', city: 'Dubai' },
  'singapore': { tz: 'Asia/Singapore', city: 'Singapore' }
};

export function setTimezoneClocksDeps(deps) {
  DAYS = deps.DAYS || [];
}

// ========================================
// CURRENT LOCATION DETECTION
// ========================================

function getCurrentDayIndex() {
  const trip = getCurrentTrip();
  if (!trip || !DAYS.length) return 0;

  const now = new Date();
  const startDate = new Date(trip.startDate);

  if (now < startDate) return 0;

  const diffTime = now - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, Math.min(diffDays, DAYS.length - 1));
}

function getCurrentLocationTimezone() {
  const dayIndex = getCurrentDayIndex();
  const currentDay = DAYS[dayIndex];

  if (!currentDay) {
    return { tz: 'Europe/Athens', city: 'Destination' };
  }

  const location = (currentDay.location || '').toLowerCase();

  for (const [key, value] of Object.entries(LOCATION_TIMEZONES)) {
    if (location.includes(key)) {
      return value;
    }
  }

  // Fallback: try to detect from trip name
  const trip = getCurrentTrip();
  const tripName = (trip?.name || '').toLowerCase();

  for (const [key, value] of Object.entries(LOCATION_TIMEZONES)) {
    if (tripName.includes(key)) {
      return value;
    }
  }

  return { tz: 'Europe/Athens', city: 'Destination' };
}

// ========================================
// CLOCK UPDATES
// ========================================

function getTimeInTimezone(timezone) {
  try {
    const now = new Date();
    const options = { timeZone: timezone, hour: 'numeric', minute: 'numeric', hour12: false };
    const timeStr = now.toLocaleTimeString('en-US', options);
    const [hours24, minutes] = timeStr.split(':').map(Number);
    return { hours: hours24 % 12, minutes, hours24 };
  } catch (e) {
    return { hours: 0, minutes: 0, hours24: 12 };
  }
}

function isDaytime(hours24) {
  // Day is 6 AM to 8 PM (6-20)
  return hours24 >= 6 && hours24 < 20;
}

function updateClockHands(clockId, timezone) {
  const { hours, minutes, hours24 } = getTimeInTimezone(timezone);

  const hourHand = document.getElementById(`tzHour${clockId}`);
  const minuteHand = document.getElementById(`tzMinute${clockId}`);
  const sunMoon = document.getElementById(`tzSunMoon${clockId}`);

  if (hourHand) {
    const hourDeg = (hours * 30) + (minutes * 0.5);
    hourHand.style.transform = `rotate(${hourDeg}deg)`;
  }

  if (minuteHand) {
    const minuteDeg = minutes * 6;
    minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
  }

  if (sunMoon) {
    sunMoon.textContent = isDaytime(hours24) ? '☀️' : '🌙';
  }
}

function updateAllClocks() {
  // Clock 1 - Home timezone
  updateClockHands('1', homeTimezone);
  const cityLabel1 = document.getElementById('tzCity1');
  if (cityLabel1) cityLabel1.textContent = homeCity;

  // Clock 2 - Current destination (auto-detected)
  const currentLoc = getCurrentLocationTimezone();
  updateClockHands('2', currentLoc.tz);
  const cityLabel2 = document.getElementById('tzCity2');
  if (cityLabel2) cityLabel2.textContent = currentLoc.city;

  // Update clock 2 data attributes
  const clock2 = document.getElementById('tzClock2');
  if (clock2) {
    clock2.dataset.timezone = currentLoc.tz;
    clock2.dataset.city = currentLoc.city;
  }

  // Clock 3 - Custom timezone (if set)
  if (customTimezone) {
    const clock3 = document.getElementById('tzClock3');
    if (clock3 && clock3.classList.contains('tz-clock-custom')) {
      updateClockHands('3', customTimezone);
    }
  }
}

// ========================================
// TIMEZONE PICKER
// ========================================

let currentPickerTarget = null; // 'home' or 'custom'

export function changeHomeTimezone() {
  currentPickerTarget = 'home';
  showTimezonePicker('Change Home Timezone', true);
}

export function addTimezone() {
  currentPickerTarget = 'custom';
  showTimezonePicker('Add Timezone', !!customTimezone);
}

function showTimezonePicker(title, showRemove) {
  const existingModal = document.getElementById('tzPickerModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'tzPickerModal';
  modal.className = 'tz-picker-modal';
  modal.innerHTML = `
    <div class="tz-picker-content">
      <div class="tz-picker-header">
        <h4>${title}</h4>
        <button class="tz-picker-close" onclick="closeTimezonePicker()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="tz-picker-list">
        ${TIMEZONE_OPTIONS.map(opt => `
          <button class="tz-picker-option" onclick="selectTimezone('${opt.tz}', '${opt.city}')">
            <span class="tz-option-city">${opt.city}</span>
          </button>
        `).join('')}
      </div>
      ${showRemove && currentPickerTarget === 'custom' ? `
        <div class="tz-picker-footer">
          <button class="tz-picker-remove" onclick="removeCustomTimezone()">
            <span class="material-symbols-outlined">delete</span>
            Remove timezone
          </button>
        </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeTimezonePicker();
    }
  });
}

export function closeTimezonePicker() {
  const modal = document.getElementById('tzPickerModal');
  if (modal) {
    modal.remove();
  }
  currentPickerTarget = null;
}

export function selectTimezone(timezone, city) {
  if (currentPickerTarget === 'home') {
    // Update home timezone
    homeTimezone = timezone;
    homeCity = city;
    localStorage.setItem('homeTimezone', timezone);
    localStorage.setItem('homeCity', city);

    const clock1 = document.getElementById('tzClock1');
    if (clock1) {
      clock1.dataset.timezone = timezone;
      clock1.dataset.city = city;
    }
  } else {
    // Update custom timezone
    customTimezone = timezone;
    customCity = city;
    localStorage.setItem('customTimezone', timezone);
    localStorage.setItem('customCity', city);

    // Transform the add button into a real clock
    const clock3 = document.getElementById('tzClock3');
    if (clock3) {
      clock3.classList.remove('tz-clock-add');
      clock3.classList.add('tz-clock-custom');
      clock3.onclick = addTimezone;
      clock3.title = 'Change timezone';
      clock3.innerHTML = `
        <div class="clock-face">
          <div class="clock-hand hour" id="tzHour3"></div>
          <div class="clock-hand minute" id="tzMinute3"></div>
          <span class="sun-moon" id="tzSunMoon3">☀️</span>
        </div>
        <span class="clock-city" id="tzCity3">${city}</span>
      `;
    }
  }

  closeTimezonePicker();
  updateAllClocks();
}

export function removeCustomTimezone() {
  customTimezone = null;
  customCity = null;
  localStorage.removeItem('customTimezone');
  localStorage.removeItem('customCity');

  // Transform back to add button
  const clock3 = document.getElementById('tzClock3');
  if (clock3) {
    clock3.classList.add('tz-clock-add');
    clock3.classList.remove('tz-clock-custom');
    clock3.onclick = addTimezone;
    clock3.title = 'Add timezone';
    clock3.innerHTML = `
      <div class="clock-face clock-face-add">
        <span class="material-symbols-outlined">add</span>
      </div>
      <span class="clock-city">Add</span>
    `;
  }

  closeTimezonePicker();
}

// ========================================
// INITIALIZATION
// ========================================

export function initTimezoneClocks() {
  // Set up home clock as clickable
  const clock1 = document.getElementById('tzClock1');
  if (clock1) {
    clock1.style.cursor = 'pointer';
    clock1.onclick = changeHomeTimezone;
    clock1.title = 'Change home timezone';
    clock1.dataset.timezone = homeTimezone;
    clock1.dataset.city = homeCity;
  }

  // Restore custom timezone if saved
  if (customTimezone && customCity) {
    selectTimezone(customTimezone, customCity);
    currentPickerTarget = null; // Reset after restore
  }

  // Initial update
  updateAllClocks();

  // Update every minute
  if (clockInterval) {
    clearInterval(clockInterval);
  }
  clockInterval = setInterval(updateAllClocks, 60000);

  // Listen for day changes to update current destination
  window.addEventListener('dayChanged', updateAllClocks);
}

// ========================================
// WINDOW EXPORTS
// ========================================

window.addTimezone = addTimezone;
window.changeHomeTimezone = changeHomeTimezone;
window.closeTimezonePicker = closeTimezonePicker;
window.selectTimezone = selectTimezone;
window.removeCustomTimezone = removeCustomTimezone;
