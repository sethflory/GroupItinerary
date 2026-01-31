// ========================================
// CONTEXT BAR - Trip Phase Aware
// ========================================

import { getCurrentTrip } from '../state.js';

let DAYS = [];
let DESTINATIONS = [];
let currentWeather = null;

export function setContextBarDeps(deps) {
  DAYS = deps.DAYS || [];
  DESTINATIONS = deps.DESTINATIONS || [];
}

// ========================================
// TRIP PHASE DETECTION
// ========================================

export function getTripPhase() {
  const trip = getCurrentTrip();
  if (!trip) return 'unknown';

  const now = new Date();
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);

  if (now < startDate) {
    return 'pre-trip';
  } else if (now > endDate) {
    return 'post-trip';
  } else {
    return 'during';
  }
}

export function getCurrentDayNumber() {
  const trip = getCurrentTrip();
  if (!trip) return 1;

  const now = new Date();
  const startDate = new Date(trip.startDate);

  // If before trip, return 1
  if (now < startDate) return 1;

  // Calculate day number
  const diffTime = now - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(1, Math.min(diffDays + 1, DAYS.length));
}

export function getTotalDays() {
  return DAYS.length;
}

// ========================================
// COUNTDOWN (PRE-TRIP)
// ========================================

export function getCountdown() {
  const trip = getCurrentTrip();
  if (!trip) return null;

  const now = new Date();
  const startDate = new Date(trip.startDate);

  if (now >= startDate) return null;

  const diffMs = startDate - now;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return { days, hours, departureDate: startDate };
}

// ========================================
// CURRENT LOCATION
// ========================================

export function getCurrentLocation() {
  const phase = getTripPhase();

  if (phase === 'pre-trip' || phase === 'post-trip') {
    // Return first destination
    return DESTINATIONS[0]?.name || 'Your Trip';
  }

  const dayNum = getCurrentDayNumber();
  const currentDay = DAYS[dayNum - 1];

  return currentDay?.location || DESTINATIONS[0]?.name || 'Your Trip';
}


// ========================================
// LOCAL TIME
// ========================================

export function getLocalTime() {
  const location = getCurrentLocation();

  // Timezone mapping
  const timezones = {
    'Athens': 'Europe/Athens',
    'Greece': 'Europe/Athens',
    'Bangalore': 'Asia/Kolkata',
    'India': 'Asia/Kolkata',
    'Delhi': 'Asia/Kolkata',
    'Mumbai': 'Asia/Kolkata'
  };

  let timezone = 'UTC';
  for (const [key, tz] of Object.entries(timezones)) {
    if (location.toLowerCase().includes(key.toLowerCase())) {
      timezone = tz;
      break;
    }
  }

  try {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

// ========================================
// NEXT ACTIVITY
// ========================================

export function getNextActivity() {
  const phase = getTripPhase();

  if (phase === 'pre-trip') {
    // Return first activity of the trip
    for (const day of DAYS) {
      const activity = day.events?.find(e =>
        e.type === 'activity' || e.type === 'meal'
      );
      if (activity) {
        return {
          title: activity.title,
          time: activity.time,
          type: activity.type
        };
      }
    }
    return null;
  }

  if (phase === 'post-trip') {
    return null;
  }

  // During trip - find next upcoming activity
  const now = new Date();
  const dayNum = getCurrentDayNumber();
  const currentDay = DAYS[dayNum - 1];

  if (!currentDay?.events) return null;

  // Parse current time
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  for (const event of currentDay.events) {
    if (event.type !== 'activity' && event.type !== 'meal') continue;

    // Parse event time (e.g., "10:00 AM", "2:30 PM")
    const timeMatch = event.time?.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!timeMatch) continue;

    let eventHour = parseInt(timeMatch[1]);
    const eventMinute = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toUpperCase();

    if (ampm === 'PM' && eventHour !== 12) eventHour += 12;
    if (ampm === 'AM' && eventHour === 12) eventHour = 0;

    // Check if event is upcoming
    if (eventHour > currentHour || (eventHour === currentHour && eventMinute > currentMinute)) {
      return {
        title: event.title,
        time: event.time,
        type: event.type
      };
    }
  }

  // No more activities today, check tomorrow
  if (dayNum < DAYS.length) {
    const tomorrow = DAYS[dayNum];
    const activity = tomorrow?.events?.find(e =>
      e.type === 'activity' || e.type === 'meal'
    );
    if (activity) {
      return {
        title: activity.title,
        time: `Tomorrow ${activity.time}`,
        type: activity.type
      };
    }
  }

  return null;
}

// ========================================
// WEATHER
// ========================================

export function setWeather(weather) {
  currentWeather = weather;
  renderContextBar();
}

export function getWeatherDisplay() {
  if (!currentWeather) {
    // Return placeholder or fetch weather
    return { icon: '☀️', temp: '--°C' };
  }

  return {
    icon: currentWeather.icon || '☀️',
    temp: currentWeather.temp ? `${Math.round(currentWeather.temp)}°C` : '--°C',
    description: currentWeather.description || ''
  };
}

// ========================================
// PHOTO COUNT (POST-TRIP)
// ========================================

let photoCount = 0;

export function setPhotoCount(count) {
  photoCount = count;
}

// ========================================
// RENDER
// ========================================

export function renderContextBar() {
  const container = document.getElementById('contextBar');
  if (!container) return;

  const phase = getTripPhase();

  if (phase === 'pre-trip') {
    renderPreTripContext(container);
  } else if (phase === 'during') {
    renderDuringContext(container);
  } else {
    renderPostTripContext(container);
  }
}

function renderPreTripContext(container) {
  const countdown = getCountdown();
  if (!countdown) return;

  const dateStr = countdown.departureDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  container.innerHTML = `
    <div class="context-bar pre-trip">
      <span class="context-icon">✈️</span>
      <div class="context-main">
        <div class="context-title">${countdown.days} days • ${countdown.hours} hours until departure</div>
        <div class="context-sub">Departing ${dateStr}</div>
      </div>
    </div>
  `;
}

function renderDuringContext(container) {
  const dayNum = getCurrentDayNumber();
  const totalDays = getTotalDays();
  const location = getCurrentLocation();
  const localTime = getLocalTime();
  const weather = getWeatherDisplay();
  const nextActivity = getNextActivity();

  const nextText = nextActivity
    ? `Up next: ${nextActivity.title} (${nextActivity.time})`
    : 'No more activities today';

  container.innerHTML = `
    <div class="context-bar during">
      <span class="context-icon">📍</span>
      <div class="context-main">
        <div class="context-title">Day ${dayNum} of ${totalDays} • ${location} • ${localTime}</div>
        <div class="context-sub">
          <span class="weather-inline">${weather.icon} ${weather.temp}</span>
          ${nextText}
        </div>
      </div>
    </div>
  `;
}

function renderPostTripContext(container) {
  const totalDays = getTotalDays();

  container.innerHTML = `
    <div class="context-bar post-trip">
      <span class="context-icon">📸</span>
      <div class="context-main">
        <div class="context-title">Trip Complete! • ${photoCount} photos • ${totalDays} days of memories</div>
        <div class="context-sub">
          <button class="context-action-btn" onclick="window.openPhotoGallery?.()">View Trip Highlights</button>
          <button class="context-action-btn" onclick="window.openStatsShareModal?.()">Share Recap</button>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// INITIALIZATION
// ========================================

export function initContextBar() {
  renderContextBar();

  // Update every minute
  setInterval(renderContextBar, 60000);
}
