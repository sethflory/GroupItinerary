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
  // If "all", empty, or includes all travelers, show "Everyone" badge
  if (!travelers || travelers.length === 0 || travelers.includes('all') || travelers.length === TRAVELERS.length) {
    const allIncluded = !travelers || travelers.length === 0 || travelers.includes('all') ||
      TRAVELERS.every(t => travelers.includes(t.id));

    if (allIncluded) {
      return `<span class="traveler-pills">
        <span class="traveler-pill group-pill everyone" title="Everyone">Everyone</span>
      </span>`;
    }
  }

  // Get groups from localStorage
  const storedGroups = localStorage.getItem(`tripGroups_${window.state?.currentTripId || ''}`);
  const customGroups = storedGroups ? JSON.parse(storedGroups) : [];

  // Build list of what to display
  const displayItems = [];
  const coveredTravelerIds = new Set();

  // Check each group to see if all its members are in the travelers list
  for (const group of customGroups) {
    const groupMembers = TRAVELERS.filter(t => (t.groups || []).includes(group.id));
    if (groupMembers.length > 0) {
      const allMembersIncluded = groupMembers.every(t => travelers.includes(t.id));
      if (allMembersIncluded) {
        displayItems.push({
          type: 'group',
          id: group.id,
          name: group.name,
          color: group.color,
          icon: group.icon
        });
        groupMembers.forEach(t => coveredTravelerIds.add(t.id));
      }
    }
  }

  // Add individual travelers who aren't covered by any displayed group
  const defaultColors = ['#4a90d9', '#d94a8c', '#2c7a7b', '#805ad5', '#dd6b20', '#38a169'];
  for (let i = 0; i < travelers.length; i++) {
    const travelerId = travelers[i];
    if (!coveredTravelerIds.has(travelerId)) {
      const traveler = TRAVELERS.find(t => t.id === travelerId);
      displayItems.push({
        type: 'individual',
        id: travelerId,
        name: traveler?.name || travelerId,
        initials: traveler?.initials || travelerId.substring(0, 2).toUpperCase(),
        color: traveler?.color || defaultColors[i % defaultColors.length]
      });
    }
  }

  // If nothing to display, show raw traveler IDs as pills (handles case where TRAVELERS not yet loaded)
  if (displayItems.length === 0) {
    // Default colors for when traveler data isn't loaded
    const defaultColors = ['#4a90d9', '#d94a8c', '#2c7a7b', '#805ad5', '#dd6b20', '#38a169'];
    return `<span class="traveler-pills">
      ${travelers.map((id, idx) => {
        const t = TRAVELERS.find(tr => tr.id === id);
        const initials = t?.initials || id.substring(0, 2).toUpperCase();
        const name = t?.name || id;
        const color = t?.color || defaultColors[idx % defaultColors.length];
        return `<span class="traveler-pill active" style="background-color: ${color}" title="${name}">${initials}</span>`;
      }).join('')}
    </span>`;
  }

  // Render the display items
  return `<span class="traveler-pills">
    ${displayItems.map(item => {
      if (item.type === 'group') {
        return `<span class="traveler-pill group-pill" style="background-color: ${item.color}" title="${item.name}">
          <span class="material-symbols-outlined" style="font-size: 14px">${item.icon || 'group'}</span>
          ${compact ? '' : item.name}
        </span>`;
      } else {
        return `<span class="traveler-pill active" style="background-color: ${item.color}" title="${item.name}">${item.initials}</span>`;
      }
    }).join('')}
  </span>`;
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
