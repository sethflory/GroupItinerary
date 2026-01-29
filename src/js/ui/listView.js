// ========================================
// LIST VIEW RENDERING
// ========================================

import { isForTraveler, getEventIcon, formatTime, renderTravelerPills } from '../utils.js';
import { isFeatureEnabled } from '../config.js';
import { fetchWeather } from '../api.js';

let DAYS, TRAVELERS, DESTINATIONS, CAROUSELS;
let currentTravelerFilter = 'all';

const WEATHER_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

export function setListViewDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
  DESTINATIONS = deps.DESTINATIONS;
  CAROUSELS = deps.CAROUSELS;
}

export function setListViewTravelerFilter(filter) {
  currentTravelerFilter = filter;
}

function renderEventCard(e, notMine = false) {
  const isNotMine = notMine || (currentTravelerFilter !== 'all' && !isForTraveler(e.travelers, currentTravelerFilter));
  const iconName = getEventIcon(e.type);

  return `
    <div class="event-card ${e.type} ${isNotMine ? 'not-mine' : ''}">
      <div class="event-main">
        <div class="event-header">
          <div class="event-icon ${e.type}">
            <span class="material-symbols-outlined">${iconName}</span>
          </div>
          <div class="event-content">
            <div class="event-time">${formatTime(e.time)}${e.endTime ? ` - ${formatTime(e.endTime)}` : ''}</div>
            <div class="event-title">${e.title}</div>
            ${e.subtitle ? `<div class="event-subtitle">${e.subtitle}</div>` : ''}
            <div class="event-badges">
              ${renderTravelerPills(e.travelers)}
              ${e.status === 'pending' ? '<span class="event-badge status-pending">Pending</span>' : ''}
              ${e.airline ? `<span class="event-badge airline-${e.airline}">${e.flightCode}</span>` : ''}
              ${(e.badges || []).map(b => `<span class="event-badge ${b}">${b}</span>`).join('')}
            </div>
          </div>
          <div class="event-actions">
            ${isFeatureEnabled('AI_INSIGHTS') ? `
              <button class="ai-insights-btn" onclick="openAiInsights('${e.id}', '${(e.title || '').replace(/'/g, "\\'")}', '${(e.details || '').replace(/'/g, "\\'")}')" title="AI Insights">
                <span class="material-symbols-outlined">smart_toy</span>
              </button>
            ` : ''}
            <button class="event-share-btn" onclick="openShareModal('${e.id}')" title="Create post">
              <span class="material-symbols-outlined">share</span>
            </button>
            <button class="event-edit-btn" onclick="openEditEventForm('${e.id}')" title="Edit event">
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="event-delete-btn" onclick="deleteEvent('${e.id}')" title="Delete event">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
      </div>
      ${e.details ? `<div class="event-details"><p>${e.details}</p></div>` : ''}
      ${e.mapsLink || e.where ? `
        <div class="event-links">
          ${e.mapsLink ? `<a href="${e.mapsLink}" target="_blank" class="event-link"><span class="material-symbols-outlined">map</span>Maps</a>` : ''}
          ${e.where ? `<span class="event-link" style="cursor:default"><span class="material-symbols-outlined">location_on</span>${e.where}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

export function renderListView() {
  const listDays = document.getElementById('listDays');
  if (!listDays || !DAYS) return;

  listDays.innerHTML = DAYS.map((day, i) => {
    const eventsForMe = day.events.filter(e => isForTraveler(e.travelers, currentTravelerFilter));
    if (currentTravelerFilter !== 'all' && eventsForMe.length === 0) return '';

    const dest = DESTINATIONS[day.location];
    const flightCount = eventsForMe.filter(e => e.type === 'flight').length;
    const activityCount = eventsForMe.filter(e => e.type === 'activity').length;
    const mealCount = eventsForMe.filter(e => e.type === 'meal').length;

    return `
      <div class="list-day" data-day="${i}">
        <div class="list-day-header" onclick="toggleListDay(${i})">
          <span class="list-day-badge">Day ${day.dayNum}</span>
          <span class="list-day-title">${day.theme}</span>
          <span class="list-day-summary">
            ${flightCount ? `<span class="material-symbols-outlined">flight</span>${flightCount}` : ''}
            ${activityCount ? `<span class="material-symbols-outlined">hiking</span>${activityCount}` : ''}
            ${mealCount ? `<span class="material-symbols-outlined">restaurant</span>${mealCount}` : ''}
          </span>
          <span class="list-day-weather" data-location="${day.location}"></span>
          <span class="list-day-location">
            <span class="material-symbols-outlined">location_on</span>
            ${dest?.city || day.location}
          </span>
          <span class="material-symbols-outlined list-day-toggle">expand_more</span>
        </div>
        <div class="list-day-content">
          <div class="list-day-events">
            ${eventsForMe.map(e => renderEventCard(e, false)).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Fetch weather for list view
  updateListViewWeather();

  // Apply feature flags to newly rendered elements
  if (window.applyFeatureFlags) {
    window.applyFeatureFlags();
  }
}

export function toggleListDay(dayIndex) {
  const dayEl = document.querySelector(`.list-day[data-day="${dayIndex}"]`);
  if (dayEl) {
    dayEl.classList.toggle('expanded');
  }
}

export function expandAllDays() {
  document.querySelectorAll('.list-day').forEach(el => el.classList.add('expanded'));
}

export function collapseAllDays() {
  document.querySelectorAll('.list-day').forEach(el => el.classList.remove('expanded'));
}

async function updateListViewWeather() {
  // Get unique locations from visible days
  const weatherElements = document.querySelectorAll('.list-day-weather[data-location]');
  const locations = [...new Set([...weatherElements].map(el => el.dataset.location))];

  // Fetch weather for each unique location
  for (const loc of locations) {
    try {
      const weather = await fetchWeather(loc);
      if (weather) {
        // Update all elements with this location
        document.querySelectorAll(`.list-day-weather[data-location="${loc}"]`).forEach(el => {
          el.innerHTML = `<span class="weather-emoji">${WEATHER_ICONS[weather.code] || '🌡️'}</span>${weather.temp}°`;
        });
      }
    } catch (e) {
      console.log('Weather fetch failed for', loc);
    }
  }
}
