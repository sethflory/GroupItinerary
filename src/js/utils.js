// ========================================
// UTILITY FUNCTIONS
// ========================================

import { TRAVELERS, TRAVELER_INITIALS, currentTravelerFilter } from './state.js';

// ========================================
// TRAVELER HELPERS
// ========================================

export function isForTraveler(travelers, travelerId) {
  if (!travelers || travelers.includes('all')) return true;
  if (travelerId === 'all') return true;
  return travelers.includes(travelerId);
}

export function getGroupBadgeClass(travelers) {
  if (!travelers || travelers.includes('all')) return 'group';
  const traveler = TRAVELERS.find(t => t.id === travelers[0]);
  return traveler ? `group ${traveler.group}` : 'group';
}

export function getGroupLabel(travelers) {
  if (!travelers || travelers.includes('all')) return 'Everyone';
  return travelers.map(id => TRAVELER_INITIALS[id] || id).join(', ');
}

export function renderTravelerPills(travelers, compact = false) {
  const travelerList = (!travelers || travelers.includes('all'))
    ? TRAVELERS.map(t => t.id)
    : travelers;

  return `
    <span class="traveler-pills">
      ${TRAVELERS.map(t => {
        const isActive = travelerList.includes(t.id);
        return `<span class="traveler-pill ${isActive ? 'active' : 'inactive'} ${t.id}"
                      style="${isActive ? `background-color: ${t.color}` : ''}"
                      title="${t.name}">${t.initials}</span>`;
      }).join('')}
    </span>
  `;
}

// ========================================
// TIME FORMATTING
// ========================================

export function formatTime(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function formatTimeRange(startTime, endTime) {
  if (!startTime) return '';
  if (!endTime) return formatTime(startTime);
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

// ========================================
// CALCULATIONS
// ========================================

export function calculateTotalMiles(travelerId, days) {
  let total = 0;
  for (const day of days) {
    for (const event of day.events || []) {
      if (event.type === 'flight' && event.miles && isForTraveler(event.travelers, travelerId)) {
        total += event.miles;
      }
    }
  }
  return total;
}

export function calculateFlightCount(travelerId, days) {
  let count = 0;
  for (const day of days) {
    for (const event of day.events || []) {
      if (event.type === 'flight' && event.flightCode && isForTraveler(event.travelers, travelerId)) {
        count++;
      }
    }
  }
  return count;
}

export function calculateTotalSteps(travelerId, days) {
  let total = 0;
  for (const day of days) {
    if (day.estimatedSteps && isForTraveler(['all'], travelerId)) {
      total += day.estimatedSteps;
    }
    for (const event of day.events || []) {
      if (event.walkingSteps && isForTraveler(event.travelers, travelerId)) {
        total += event.walkingSteps;
      }
    }
  }
  return total;
}

export function calculateGroundTravelTime(days, travelerFilter) {
  let totalMinutes = 0;
  for (const day of days) {
    for (const event of day.events || []) {
      if (event.travelTime && isForTraveler(event.travelers, travelerFilter)) {
        totalMinutes += event.travelTime;
      }
    }
  }
  return totalMinutes;
}

// ========================================
// TEXT HELPERS
// ========================================

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatAiResponse(text) {
  // Convert markdown-style formatting to HTML
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// ========================================
// EVENT TYPE HELPERS
// ========================================

export function getEventIcon(type) {
  const icons = {
    flight: 'flight',
    activity: 'hiking',
    meal: 'restaurant',
    hotel: 'hotel'
  };
  return icons[type] || 'event';
}

export function getEventTypeLabel(type) {
  const labels = {
    flight: 'Flight',
    activity: 'Activity',
    meal: 'Meal',
    hotel: 'Hotel'
  };
  return labels[type] || 'Event';
}

// ========================================
// WEATHER HELPERS
// ========================================

export function getWeatherIcon(code) {
  const weatherIcons = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
    45: '🌫️', 48: '🌫️',
    51: '🌧️', 53: '🌧️', 55: '🌧️',
    61: '🌧️', 63: '🌧️', 65: '🌧️',
    71: '🌨️', 73: '🌨️', 75: '🌨️',
    80: '🌦️', 81: '🌦️', 82: '🌦️',
    95: '⛈️', 96: '⛈️', 99: '⛈️'
  };
  return weatherIcons[code] || '🌡️';
}

export function getWeatherDescription(code) {
  const descriptions = {
    0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
    80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
    95: 'Thunderstorm', 96: 'Hail', 99: 'Heavy Hail'
  };
  return descriptions[code] || '';
}
