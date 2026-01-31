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

    // Sync the action bar day dropdown
    if (typeof window.setCurrentDayIndex === 'function') {
      window.setCurrentDayIndex(index);
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
  // Day list sidebar removed - using simplified navigation with prev/next arrows
  return;
}

export function renderDayDetail() {
  const container = document.getElementById('dayDetail');
  if (!container || !DAYS[currentDayIndex]) return;

  const day = DAYS[currentDayIndex];
  const dest = DESTINATIONS[day.destination] || {};
  const events = day.events || [];

  // Get personalization data if available
  const personalization = window.tripPersonalization;
  const dayNickname = personalization?.dayNicknames?.[day.dayNum] || day.theme;
  let dayBg = personalization?.dayBackgrounds?.[day.dayNum];

  // DEMO MODE: Show sample Unsplash image for API approval screenshot
  // TODO: Remove this after Unsplash approval
  if (!dayBg && window.UNSPLASH_DEMO_MODE) {
    dayBg = {
      url: 'https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?w=1200&q=80',
      credit: 'Konstantinos Papaioannou',
      creditUrl: 'https://unsplash.com/@konsn'
    };
  }

  // Separate events by type
  const flights = events.filter(e => e.type === 'flight');
  const activities = events.filter(e => e.type === 'activity');
  const meals = events.filter(e => e.type === 'meal');
  const hotels = events.filter(e => e.type === 'hotel');
  const otherEvents = events.filter(e => !['flight', 'activity', 'meal', 'hotel'].includes(e.type));

  // Set background class and custom background image
  // If we have a custom AI background, don't apply destination-specific bg class
  if (dayBg?.url) {
    container.className = 'day-detail has-custom-bg';
    container.style.setProperty('--day-bg-image', `url('${dayBg.url}')`);
  } else {
    container.className = `day-detail ${day.destination}-bg`;
    container.style.removeProperty('--day-bg-image');
  }

  const isFirst = currentDayIndex === 0;
  const isLast = currentDayIndex >= DAYS.length - 1;

  container.innerHTML = `
    <div class="day-header">
      <button class="day-nav-arrow ${isFirst ? 'disabled' : ''}" onclick="goToPrevDay()" ${isFirst ? 'disabled' : ''} title="Previous Day">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>
      <div class="day-header-main">
        <div class="day-header-top">
          <span class="day-header-date">Day ${day.dayNum}</span>
          <span class="day-header-label">${day.label}</span>
        </div>
        <h2 class="day-header-title">${dayNickname}</h2>
        ${renderDinnerPollButton(day)}
      </div>
      <button class="day-nav-arrow ${isLast ? 'disabled' : ''}" onclick="goToNextDay()" ${isLast ? 'disabled' : ''} title="Next Day">
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
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

    ${dayBg?.credit ? `
      <div class="unsplash-attribution">
        Photo by <a href="${dayBg.creditUrl}?utm_source=GroupItinerary&utm_medium=referral" target="_blank" rel="noopener">${dayBg.credit}</a> on <a href="https://unsplash.com?utm_source=GroupItinerary&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>
      </div>
    ` : ''}
  `;
}

export function renderEventCard(e, notMine = false) {
  const isNotMine = notMine || (currentTravelerFilter !== 'all' && !isForTraveler(e.travelers, currentTravelerFilter));
  const iconName = getEventIcon(e.type);

  // Get event card config from personalization (new format)
  const personalization = window.tripPersonalization;
  const eventCard = personalization?.eventCards?.[e.id];

  // Priority: user-selected images > AI personalization > legacy format
  let cardImages = [];
  let cardStyle = 'minimal';

  // Check for user-selected linked photos first
  if (e.linkedPhotos && e.linkedPhotos.length > 0) {
    cardImages = e.linkedPhotos.map(p =>
      typeof p === 'string' ? { url: p, thumb: p } : p
    );
    cardStyle = cardImages.length > 1 ? 'carousel' : 'hero';
  } else if (eventCard?.images?.length > 0) {
    // AI personalization images
    cardImages = eventCard.images;
    cardStyle = eventCard.cardStyle || 'minimal';
  } else if (e.linkedPhotoUrl) {
    // Legacy single image format
    cardImages = [{ url: e.linkedPhotoUrl, thumb: e.linkedPhotoUrl }];
    cardStyle = 'hero';
  }

  // Fallback to legacy eventImages format
  let eventImage = cardImages[0] || personalization?.eventImages?.[e.id];

  // DEMO MODE: Show sample event image for first activity
  if (!eventImage && window.UNSPLASH_DEMO_MODE && e.type === 'activity') {
    eventImage = {
      url: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=80',
      thumb: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=400&q=80',
      credit: 'Spencer Davis',
      creditUrl: 'https://unsplash.com/@spencerdavis'
    };
  }

  // Check if this card has AI-enhanced content
  const isAiEnhanced = eventCard != null || personalization?.eventImages?.[e.id] != null;
  const hasImage = cardStyle !== 'minimal' && (eventImage?.url || cardImages.length > 0);

  return `
    <div class="event-card ${e.type} ${isNotMine ? 'not-mine' : ''} ${hasImage ? 'has-image' : ''} ${isAiEnhanced ? 'ai-enhanced' : ''} card-style-${cardStyle}">
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
            ${(e.type === 'activity' || e.type === 'meal') ? `
              <button class="event-see-btn ${window.hasEventSavedList && window.hasEventSavedList(e.id) ? 'has-list' : ''}"
                      onclick="openWhatsYouWillSee('${e.id}')"
                      title="${window.hasEventSavedList && window.hasEventSavedList(e.id) ? 'View saved list' : 'What will we see'}">
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
      ${renderEventMedia(e.id, cardStyle, cardImages, eventImage, e.title)}
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

function renderEventMedia(eventId, cardStyle, images, fallbackImage, title) {
  // Minimal cards have no media
  if (cardStyle === 'minimal' || (!images.length && !fallbackImage?.url)) {
    return '';
  }

  // Carousel: multiple images to swipe through
  if (cardStyle === 'carousel' && images.length > 1) {
    return `
      <div class="event-carousel" data-event-id="${eventId}">
        <div class="event-carousel-track">
          ${images.map((img, idx) => `
            <div class="event-carousel-slide ${idx === 0 ? 'active' : ''}">
              <img src="${img.url}" alt="${title}" loading="lazy">
            </div>
          `).join('')}
        </div>
        <div class="event-carousel-dots">
          ${images.map((_, idx) => `
            <button class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="slideEventCarousel('${eventId}', ${idx})"></button>
          `).join('')}
        </div>
        <button class="carousel-arrow prev" onclick="slideEventCarousel('${eventId}', 'prev')">
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        <button class="carousel-arrow next" onclick="slideEventCarousel('${eventId}', 'next')">
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
        ${renderImageAttribution(images[0])}
      </div>
    `;
  }

  // Hero or Accent: single image
  const img = images[0] || fallbackImage;
  if (img?.url) {
    return `
      <div class="event-image ${cardStyle === 'hero' ? 'hero-image' : ''}">
        <img src="${img.url}" alt="${title}" loading="lazy">
        ${renderImageAttribution(img)}
      </div>
    `;
  }

  return '';
}

function renderImageAttribution(img) {
  if (!img?.credit) return '';
  return `
    <div class="event-image-attribution">
      Photo by <a href="${img.creditUrl || '#'}?utm_source=GroupItinerary&utm_medium=referral" target="_blank" rel="noopener">${img.credit}</a> on <a href="https://unsplash.com?utm_source=GroupItinerary&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>
    </div>
  `;
}

// Carousel navigation for event cards
window.slideEventCarousel = function(eventId, direction) {
  const carousel = document.querySelector(`.event-carousel[data-event-id="${eventId}"]`);
  if (!carousel) return;

  const slides = carousel.querySelectorAll('.event-carousel-slide');
  const dots = carousel.querySelectorAll('.carousel-dot');
  let currentIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));

  if (direction === 'prev') {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
  } else if (direction === 'next') {
    currentIndex = (currentIndex + 1) % slides.length;
  } else if (typeof direction === 'number') {
    currentIndex = direction;
  }

  slides.forEach((s, i) => s.classList.toggle('active', i === currentIndex));
  dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));

  // Update attribution for current slide
  const eventCard = window.tripPersonalization?.eventCards?.[eventId];
  const currentImg = eventCard?.images?.[currentIndex];
  const attribution = carousel.querySelector('.event-image-attribution');
  if (attribution && currentImg?.credit) {
    attribution.innerHTML = `Photo by <a href="${currentImg.creditUrl || '#'}?utm_source=GroupItinerary&utm_medium=referral" target="_blank" rel="noopener">${currentImg.credit}</a> on <a href="https://unsplash.com?utm_source=GroupItinerary&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>`;
  }
};

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
// Hides button if there's already a dinner event on this day
function renderDinnerPollButton(day) {
  // Check if there's already a dinner event on this day
  // Dinner = meal event with time >= 17:00 or title contains "dinner"
  const events = day.events || [];
  const hasDinner = events.some(e => {
    if (e.type !== 'meal') return false;
    // Check if it's a dinner time (5pm or later)
    const timeMatch = e.time?.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      if (hour >= 17) return true;
    }
    // Or if the title contains "dinner"
    if (e.title?.toLowerCase().includes('dinner')) return true;
    return false;
  });

  // Don't show button if there's already a dinner planned
  if (hasDinner) {
    return '';
  }

  // Check if there's an active poll for this date
  const activePoll = window.getActivePollForDate ? window.getActivePollForDate(day.date) : null;

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
