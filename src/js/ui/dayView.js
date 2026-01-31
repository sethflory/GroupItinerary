// ========================================
// DAY VIEW RENDERING
// ========================================

import { currentTripId } from '../state.js';
import { isFeatureEnabled } from '../config.js';
import { isForTraveler, formatTime, renderTravelerPills, getEventIcon } from '../utils.js';

// These will be set by app.js
let DAYS, TRAVELERS, DESTINATIONS, CAROUSELS, HOTEL, PHASES;
let currentDayIndex = 0;
let currentTravelerFilter = 'all';
let currentPhase = null;

export function setDayViewDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
  DESTINATIONS = deps.DESTINATIONS;
  CAROUSELS = deps.CAROUSELS;
  HOTEL = deps.HOTEL;
  PHASES = deps.PHASES;
}

export function setCurrentDayIndex(index) {
  currentDayIndex = index;
}

export function setTravelerFilter(filter) {
  currentTravelerFilter = filter;
}

export function setPhase(phase) {
  currentPhase = phase;
}

export function getCurrentDayIndex() {
  return currentDayIndex;
}

export function goToDay(index) {
  if (index >= 0 && index < DAYS.length) {
    currentDayIndex = index;
    renderDayList();
    renderDayDetail();

    // Scroll day into view in sidebar
    const dayItems = document.querySelectorAll('.day-item');
    if (dayItems[index]) {
      dayItems[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

export function goToToday() {
  const today = new Date().toISOString().split('T')[0];
  const todayIndex = DAYS.findIndex(d => d.date === today);

  if (todayIndex >= 0) {
    goToDay(todayIndex);
  } else {
    // Find the closest upcoming day
    const now = new Date();
    let closestIndex = 0;
    let closestDiff = Infinity;

    DAYS.forEach((day, index) => {
      const dayDate = new Date(day.date);
      const diff = Math.abs(dayDate - now);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = index;
      }
    });

    goToDay(closestIndex);
  }
}

export function renderDayList() {
  const container = document.getElementById('dayList');
  if (!container) return;

  // Filter days by phase if set
  let filteredDays = DAYS;
  if (currentPhase && PHASES[currentPhase]) {
    const phase = PHASES[currentPhase];
    filteredDays = DAYS.filter(d => d.date >= phase.startDate && d.date <= phase.endDate);
  }

  container.innerHTML = filteredDays.map((day, idx) => {
    const actualIndex = DAYS.indexOf(day);
    const isActive = actualIndex === currentDayIndex;
    const dayEvents = day.events || [];
    const isForMe = dayEvents.some(e => isForTraveler(e.travelers, currentTravelerFilter));

    return `
      <div class="day-item ${isActive ? 'active' : ''} ${!isForMe && currentTravelerFilter !== 'all' ? 'not-mine' : ''}"
           onclick="goToDay(${actualIndex})">
        <div class="day-item-header">
          <span class="day-item-date">${day.label}</span>
          <span class="day-item-num">Day ${day.dayNum}</span>
        </div>
        <div class="day-item-title">${day.theme}</div>
        <div class="day-item-location">
          <span class="material-symbols-outlined">location_on</span>
          ${day.location}
        </div>
      </div>
    `;
  }).join('');
}

export function renderDayDetail() {
  const container = document.getElementById('dayDetail');
  if (!container || !DAYS[currentDayIndex]) return;

  const day = DAYS[currentDayIndex];
  const dest = DESTINATIONS[day.destination] || {};
  const events = day.events || [];

  // Separate events by type
  const flights = events.filter(e => e.type === 'flight');
  const activities = events.filter(e => e.type === 'activity');
  const meals = events.filter(e => e.type === 'meal');
  const hotels = events.filter(e => e.type === 'hotel');
  const otherEvents = events.filter(e => !['flight', 'activity', 'meal', 'hotel'].includes(e.type));

  // Set background class
  container.className = `day-detail ${day.destination}-bg`;

  container.innerHTML = `
    <div class="day-header">
      <div class="day-header-main">
        <div class="day-header-date">Day ${day.dayNum} • ${day.label}</div>
        <h2 class="day-header-title">${day.theme}</h2>
        <div class="day-header-subtitle">${day.location} ${dest.city ? `• ${dest.city}, ${dest.country}` : ''}</div>
        ${renderDinnerPollButton(day.date)}
      </div>
      <div class="day-meta-cards">
        ${day.estimatedSteps ? `
          <div class="day-meta-card">
            <span class="material-symbols-outlined">directions_walk</span>
            <div>
              <strong>${day.estimatedSteps.toLocaleString()}</strong>
              <div class="sub">est. steps</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    ${day.destinationInfo ? `
      <div class="destination-card ${day.destination}">
        <div class="destination-name">${dest.city || day.location}</div>
        <div class="destination-info">${day.destinationInfo}</div>
      </div>
    ` : ''}

    <div class="events-list">
      ${flights.length ? flights.map(e => renderEventCard(e)).join('') : ''}
      ${hotels.length ? hotels.map(e => renderEventCard(e)).join('') : ''}
      ${activities.length ? activities.map(e => renderEventCard(e)).join('') : ''}
      ${meals.length ? meals.map(e => renderEventCard(e)).join('') : ''}
      ${otherEvents.length ? otherEvents.map(e => renderEventCard(e)).join('') : ''}

      <button class="add-event-btn" onclick="openAddEventForm('${day.date}')">
        <span class="material-symbols-outlined">add_circle</span>
        Add Event or Moment
      </button>
    </div>

    ${renderDayNavigation()}
  `;
}

export function renderEventCard(e, notMine = false) {
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
            ${(e.type === 'activity' || e.type === 'meal') ? `
              <button class="event-see-btn ${window.hasEventSavedList && window.hasEventSavedList(e.id) ? 'has-list' : ''}"
                      onclick="openWhatsYouWillSee('${e.id}')"
                      title="${window.hasEventSavedList && window.hasEventSavedList(e.id) ? 'View saved list' : 'What you will see'}">
                <span class="material-symbols-outlined">${window.hasEventSavedList && window.hasEventSavedList(e.id) ? 'format_list_bulleted' : 'visibility'}</span>
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
      ${e.carousel && CAROUSELS[e.carousel] ? renderCarousel(e.carousel) : ''}
      ${e.mapsLink || e.where ? `
        <div class="event-links">
          ${e.mapsLink ? `<a href="${e.mapsLink}" target="_blank" class="event-link"><span class="material-symbols-outlined">map</span>Maps</a>` : ''}
          ${e.where ? `<span class="event-link" style="cursor:default"><span class="material-symbols-outlined">location_on</span>${e.where}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

export function renderCarousel(carouselId) {
  const carousel = CAROUSELS[carouselId];
  if (!carousel) return '';

  const images = carousel.images || [];

  return `
    <div class="event-carousel" id="carousel-${carouselId}">
      <div class="carousel-track">
        ${images.map((img, i) => {
          const safeCaption = (img.caption || '').replace(/'/g, "\\'");
          return `
          <div class="carousel-slide ${i === 0 ? 'active' : ''}" onclick="openLightbox('${img.url}', '${safeCaption}', '', '')">
            <img src="${img.url}" alt="${img.caption || ''}" loading="lazy">
            ${img.caption ? `<div class="carousel-caption">${img.caption}</div>` : ''}
          </div>
        `}).join('')}
      </div>
      ${images.length > 1 ? `
        <div class="carousel-nav">
          <button class="carousel-btn prev" onclick="moveCarousel('${carouselId}', -1)">
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <div class="carousel-dots">
            ${images.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide('${carouselId}', ${i})"></span>`).join('')}
          </div>
          <button class="carousel-btn next" onclick="moveCarousel('${carouselId}', 1)">
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

export function renderDayNavigation() {
  const prevDay = currentDayIndex > 0 ? DAYS[currentDayIndex - 1] : null;
  const nextDay = currentDayIndex < DAYS.length - 1 ? DAYS[currentDayIndex + 1] : null;

  return `
    <div class="day-navigation">
      ${prevDay ? `
        <button class="day-nav-btn prev" onclick="goToDay(${currentDayIndex - 1})">
          <span class="material-symbols-outlined">chevron_left</span>
          Day ${prevDay.dayNum}
        </button>
      ` : '<div class="day-nav-placeholder"></div>'}

      ${nextDay ? `
        <button class="day-nav-btn next" onclick="goToDay(${currentDayIndex + 1})">
          Day ${nextDay.dayNum}
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      ` : '<div class="day-nav-placeholder"></div>'}
    </div>
  `;
}

// Carousel navigation
const carouselStates = {};

export function moveCarousel(carouselId, direction) {
  const carousel = CAROUSELS[carouselId];
  if (!carousel) return;

  const total = carousel.images.length;
  const current = carouselStates[carouselId] || 0;
  const next = (current + direction + total) % total;

  carouselStates[carouselId] = next;

  const container = document.getElementById(`carousel-${carouselId}`);
  if (!container) return;

  const slides = container.querySelectorAll('.carousel-slide');
  const dots = container.querySelectorAll('.carousel-dot');

  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === next);
  });

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === next);
  });
}

export function goToSlide(carouselId, index) {
  carouselStates[carouselId] = index;

  const container = document.getElementById(`carousel-${carouselId}`);
  if (!container) return;

  const slides = container.querySelectorAll('.carousel-slide');
  const dots = container.querySelectorAll('.carousel-dot');

  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
  });

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

// Render dinner poll button with active indicator
function renderDinnerPollButton(date) {
  // Check if there's an active poll for this date
  const activePoll = window.getActivePollForDate ? window.getActivePollForDate(date) : null;

  if (activePoll) {
    return `
      <button class="dinner-poll-btn has-active-poll" onclick="openDinnerPollModal()">
        <span class="poll-indicator"></span>
        <span class="material-symbols-outlined">restaurant_menu</span>
        Vote Now! (${activePoll.totalVotes || 0} votes)
      </button>
    `;
  }

  return `
    <button class="dinner-poll-btn" onclick="openDinnerPollModal()">
      <span class="material-symbols-outlined">restaurant_menu</span>
      What's for Dinner?
    </button>
  `;
}
