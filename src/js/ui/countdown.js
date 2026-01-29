// ========================================
// COUNTDOWN TIMER & TIMEZONE
// ========================================

import { getCurrentTrip } from '../state.js';
import { isFeatureEnabled } from '../config.js';

let DAYS, DESTINATIONS;
let currentDayIndex = 0;

export function setCountdownDeps(deps) {
  DAYS = deps.DAYS;
  DESTINATIONS = deps.DESTINATIONS;
}

export function setCountdownDayIndex(index) {
  currentDayIndex = index;
}

function getTripStart() {
  return new Date(getCurrentTrip().startDate);
}

function getTripEnd() {
  return new Date(getCurrentTrip().endDate);
}

export function updateCountdown() {
  if (!isFeatureEnabled('COUNTDOWN_TIMER')) return;

  const container = document.getElementById('countdownWidget');
  if (!container) return;

  const now = new Date();
  const start = getTripStart();
  const end = getTripEnd();

  let label, targetDate;

  if (now < start) {
    label = 'Trip starts in';
    targetDate = start;
    container.classList.remove('trip-active', 'trip-ended');
  } else if (now >= start && now <= end) {
    label = 'Trip in progress!';
    targetDate = null;
    container.classList.add('trip-active');
    container.classList.remove('trip-ended');
  } else {
    label = 'Trip ended';
    targetDate = null;
    container.classList.add('trip-ended');
    container.classList.remove('trip-active');
  }

  const labelEl = container.querySelector('.countdown-label');
  const timerEl = container.querySelector('.countdown-timer');

  if (labelEl) labelEl.textContent = label;

  if (targetDate && timerEl) {
    const diff = targetDate - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    timerEl.innerHTML = `
      <div class="countdown-unit"><span>${days}</span><small>days</small></div>
      <div class="countdown-unit"><span>${hours}</span><small>hrs</small></div>
      <div class="countdown-unit"><span>${minutes}</span><small>min</small></div>
      <div class="countdown-unit"><span>${seconds}</span><small>sec</small></div>
    `;
  } else if (timerEl) {
    timerEl.innerHTML = '';
  }
}

export function updateTimezone() {
  if (!isFeatureEnabled('TIMEZONE_DISPLAY')) return;

  const container = document.getElementById('timezoneWidget');
  if (!container) return;

  const now = new Date();

  // Get current day's destination (location is the airport code, destination might be day type)
  const currentDay = DAYS[currentDayIndex];
  const destCode = currentDay?.location || currentDay?.destination;
  const dest = DESTINATIONS[destCode];

  if (!dest || !dest.timezone) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  // Home time (ET)
  const homeTime = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Destination time
  const destTime = now.toLocaleTimeString('en-US', {
    timeZone: dest.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Calculate offset
  const homeOffset = -5; // ET
  const destOffset = dest.utcOffset || 0;
  const diff = destOffset - homeOffset;
  const diffStr = diff > 0 ? `+${diff}h` : `${diff}h`;

  container.innerHTML = `
    <div class="tz-clocks">
      <div class="tz-clock">
        <span class="tz-flag">🇺🇸</span>
        <div class="tz-time-group">
          <span class="tz-time">${homeTime}</span>
          <span class="tz-label">Home (ET)</span>
        </div>
      </div>
      <div class="tz-arrow">
        <span class="material-symbols-outlined">arrow_forward</span>
        <span class="tz-offset">${diffStr}</span>
      </div>
      <div class="tz-clock">
        <span class="tz-flag">${getCountryFlag(dest.country)}</span>
        <div class="tz-time-group">
          <span class="tz-time">${destTime}</span>
          <span class="tz-label">${dest.city}</span>
        </div>
      </div>
    </div>
  `;
}

function getCountryFlag(country) {
  const flags = {
    'Greece': '🇬🇷',
    'India': '🇮🇳',
    'UAE': '🇦🇪',
    'USA': '🇺🇸'
  };
  return flags[country] || '🌍';
}

export function updateTodayButton() {
  const btn = document.getElementById('todayBtn');
  if (!btn) return;

  const today = new Date().toISOString().split('T')[0];
  const tripStart = getTripStart().toISOString().split('T')[0];
  const tripEnd = getTripEnd().toISOString().split('T')[0];

  // Show button only during trip dates
  if (today >= tripStart && today <= tripEnd) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}

// Start intervals
let countdownInterval = null;
let timezoneInterval = null;

export function startTimers() {
  updateCountdown();
  updateTimezone();
  updateTodayButton();

  countdownInterval = setInterval(updateCountdown, 1000);
  timezoneInterval = setInterval(updateTimezone, 60000);
  setInterval(updateTodayButton, 60000);
}

export function stopTimers() {
  if (countdownInterval) clearInterval(countdownInterval);
  if (timezoneInterval) clearInterval(timezoneInterval);
}
