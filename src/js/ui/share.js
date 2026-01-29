// ========================================
// SHARE POST FUNCTIONALITY
// ========================================

import { currentTripId, getCurrentTrip } from '../state.js';
import { escapeHtml } from '../utils.js';

let DAYS, TRAVELERS, DESTINATIONS;
let selectedShareEvents = [];
let currentPostStyle = 0;

const POST_STYLES = [
  { name: 'excited', prefix: '✈️ ', suffix: ' #TravelDreams #Wanderlust' },
  { name: 'casual', prefix: '🌍 ', suffix: ' #Travel #Adventure' },
  { name: 'elegant', prefix: '🗺️ ', suffix: ' #ExploringTheWorld' },
  { name: 'foodie', prefix: '🍽️ ', suffix: ' #FoodieTravel #Yum' }
];

const LOCATION_EMOJIS = {
  'ATH': '🇬🇷',
  'CMH': '🇺🇸',
  'EWR': '🛫',
  'DXB': '🇦🇪',
  'BLR': '🇮🇳'
};

const TYPE_EMOJIS = {
  'flight': '✈️',
  'hotel': '🏨',
  'meal': '🍽️',
  'activity': '🎯',
  'lounge': '🍸'
};

const LOCATION_NAMES = {
  'ATH': 'Athens',
  'CMH': 'Columbus',
  'EWR': 'Newark',
  'DXB': 'Dubai',
  'BLR': 'Bangalore'
};

export function setShareDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
  DESTINATIONS = deps.DESTINATIONS;
}

function getAllShareableEvents() {
  const events = [];
  DAYS.forEach((day, dayIndex) => {
    (day.events || []).forEach(event => {
      events.push({
        ...event,
        dayLabel: day.label,
        dayIndex,
        location: day.location
      });
    });
  });
  return events;
}

export function openShareModal(eventId) {
  const allEvents = getAllShareableEvents();
  const event = allEvents.find(e => e.id === eventId);
  if (event) {
    selectedShareEvents = [event];
  }
  currentPostStyle = 0;
  renderShareModal();
  document.getElementById('shareModal').classList.add('active');
  generatePostContent();
}

export function openStatsShareModal() {
  const trip = getCurrentTrip();

  // Calculate trip stats
  const totalMiles = DAYS.flatMap(d => d.events || [])
    .filter(e => e.miles)
    .reduce((sum, e) => sum + e.miles, 0);

  const totalSteps = DAYS.reduce((sum, d) => sum + (d.estimatedSteps || 0), 0);

  const countries = [...new Set(DAYS.map(d => DESTINATIONS[d.location]?.country).filter(Boolean))];

  const cities = [...new Set(DAYS.map(d => DESTINATIONS[d.location]?.city).filter(Boolean))];

  const totalDays = DAYS.length;

  const flightCount = DAYS.flatMap(d => d.events || []).filter(e => e.type === 'flight').length;

  // Calculate countdown
  const now = new Date();
  const tripStart = new Date(trip.startDate);
  const tripEnd = new Date(trip.endDate);
  let countdownText = '';
  if (now < tripStart) {
    const diff = tripStart - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    countdownText = `⏳ ${days} days to go!`;
  } else if (now >= tripStart && now <= tripEnd) {
    countdownText = `✈️ Currently on the adventure!`;
  } else {
    countdownText = `✅ Trip complete!`;
  }

  // Generate fun stats post
  const posts = [
    `🌍 Epic adventure loading...\n\n` +
    `📍 ${countries.length} countries: ${countries.join(' → ')}\n` +
    `🏙️ ${cities.length} cities to explore\n` +
    `✈️ ${flightCount} flights covering ${totalMiles.toLocaleString()}+ miles\n` +
    `👟 ~${(totalSteps/1000).toFixed(0)}k steps planned\n` +
    `📅 ${totalDays} days of adventure\n\n` +
    `${countdownText}\n\n` +
    `#TravelPlanning #Wanderlust #Adventure`,

    `✈️ Trip stats that make me smile:\n\n` +
    `🗺️ ${totalMiles.toLocaleString()} miles\n` +
    `🌏 ${countries.length} countries\n` +
    `🏨 ${cities.length} cities\n` +
    `📆 ${totalDays} days\n` +
    `👣 ${(totalSteps/1000).toFixed(0)}k steps\n\n` +
    `${countdownText} 🎉\n\n` +
    `#TravelStats #Exploring`,

    `🎒 Packing for:\n\n` +
    `${countries.map(c => c === 'Greece' ? '🇬🇷 Greece' : c === 'India' ? '🇮🇳 India' : c === 'UAE' ? '🇦🇪 UAE' : c === 'USA' ? '🇺🇸 USA' : c).join('\n')}\n\n` +
    `${totalMiles.toLocaleString()} miles • ${totalDays} days • ${flightCount} flights\n\n` +
    `${countdownText}\n\n` +
    `#TravelPrep #WorldTraveler`
  ];

  // Pick a random post style
  const randomPost = posts[Math.floor(Math.random() * posts.length)];

  // Clear selected events and set stats mode
  selectedShareEvents = [];

  // Open modal and set content
  document.getElementById('shareModal').classList.add('active');
  document.getElementById('shareSelectedEvents').innerHTML = `
    <span class="share-event-chip">
      <span class="material-symbols-outlined">bar_chart</span>
      Trip Stats
    </span>
  `;
  document.getElementById('shareEventPicker').classList.remove('active');
  document.querySelector('.share-add-events').style.display = 'none';
  document.getElementById('shareTextarea').value = randomPost;
  updateCharCount();

  // Store that we're in stats mode for regenerate
  window.statsShareMode = true;
  window.statsPostOptions = posts;
  window.statsPostIndex = posts.indexOf(randomPost);
}

export function closeShareModal() {
  // Reset stats mode
  window.statsShareMode = false;
  const addEventsEl = document.querySelector('.share-add-events');
  if (addEventsEl) addEventsEl.style.display = '';

  document.getElementById('shareModal').classList.remove('active');
  document.getElementById('shareEventPicker').classList.remove('active');
  selectedShareEvents = [];
}

function renderShareModal() {
  renderSelectedEvents();
  renderEventPicker();
}

function renderSelectedEvents() {
  const container = document.getElementById('shareSelectedEvents');
  if (!container) return;

  container.innerHTML = selectedShareEvents.map(event => `
    <span class="share-event-chip">
      <span class="material-symbols-outlined">${TYPE_EMOJIS[event.type] ? 'check' : 'event'}</span>
      ${escapeHtml(event.title)}
      ${selectedShareEvents.length > 1 ? `<span class="material-symbols-outlined remove-event" onclick="removeShareEvent('${event.id}')">close</span>` : ''}
    </span>
  `).join('');
}

function renderEventPicker() {
  const allEvents = getAllShareableEvents();
  const selectedIds = selectedShareEvents.map(e => e.id);
  const container = document.getElementById('shareEventPicker');
  if (!container) return;

  container.innerHTML = allEvents
    .filter(e => !selectedIds.includes(e.id))
    .map(event => `
      <div class="share-event-option" onclick="addShareEvent('${event.id}')">
        <span>${TYPE_EMOJIS[event.type] || '📍'}</span>
        <span>${escapeHtml(event.title)}</span>
        <span class="event-day">${event.dayLabel}</span>
      </div>
    `).join('');
}

export function toggleEventPicker() {
  document.getElementById('shareEventPicker').classList.toggle('active');
}

export function addShareEvent(eventId) {
  const allEvents = getAllShareableEvents();
  const event = allEvents.find(e => e.id === eventId);
  if (event && !selectedShareEvents.find(e => e.id === eventId)) {
    selectedShareEvents.push(event);
    renderShareModal();
    generatePostContent();
  }
  document.getElementById('shareEventPicker').classList.remove('active');
}

export function removeShareEvent(eventId) {
  selectedShareEvents = selectedShareEvents.filter(e => e.id !== eventId);
  if (selectedShareEvents.length === 0) {
    closeShareModal();
  } else {
    renderShareModal();
    generatePostContent();
  }
}

export function generatePostContent() {
  const style = POST_STYLES[currentPostStyle];
  let content = style.prefix;

  // Group events by location
  const locations = [...new Set(selectedShareEvents.map(e => e.location))];

  if (selectedShareEvents.length === 1) {
    const event = selectedShareEvents[0];
    const emoji = LOCATION_EMOJIS[event.location] || '📍';

    if (event.type === 'flight') {
      content += `Taking off! ${event.title}`;
    } else if (event.type === 'hotel') {
      content += `Checking into ${event.title} ${emoji}`;
    } else if (event.type === 'meal') {
      content += `Time for ${event.title.toLowerCase()} in ${LOCATION_NAMES[event.location] || event.location} ${emoji}`;
    } else if (event.type === 'activity') {
      content += `${event.title} in ${LOCATION_NAMES[event.location] || event.location} ${emoji}`;
    } else {
      content += `${event.title} ${emoji}`;
    }
  } else {
    // Multiple events
    const locationEmojis = locations.map(l => LOCATION_EMOJIS[l] || '📍').join(' ');

    if (locations.length > 1) {
      content += `Trip highlights: ${locations.map(l => LOCATION_NAMES[l]).join(' → ')} ${locationEmojis}\n\n`;
    } else {
      content += `${LOCATION_NAMES[locations[0]] || locations[0]} adventures ${LOCATION_EMOJIS[locations[0]] || '📍'}\n\n`;
    }

    selectedShareEvents.forEach(event => {
      const emoji = TYPE_EMOJIS[event.type] || '📍';
      content += `${emoji} ${event.title}\n`;
    });
  }

  content += style.suffix;

  document.getElementById('shareTextarea').value = content;
  updateCharCount();
}

export function regeneratePost() {
  if (window.statsShareMode && window.statsPostOptions) {
    window.statsPostIndex = (window.statsPostIndex + 1) % window.statsPostOptions.length;
    document.getElementById('shareTextarea').value = window.statsPostOptions[window.statsPostIndex];
    updateCharCount();
  } else {
    currentPostStyle = (currentPostStyle + 1) % POST_STYLES.length;
    generatePostContent();
  }
}

export function updateCharCount() {
  const textarea = document.getElementById('shareTextarea');
  const count = textarea.value.length;
  const countEl = document.getElementById('shareCharCount');
  if (countEl) {
    countEl.textContent = `${count} / 280`;
    countEl.classList.toggle('over', count > 280);
  }
}

export function shareToTwitter() {
  const text = document.getElementById('shareTextarea').value;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'width=550,height=420');
}

export function shareToFacebook() {
  const text = document.getElementById('shareTextarea').value;
  const url = `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'width=550,height=420');
}

export function copyToClipboard() {
  const text = document.getElementById('shareTextarea').value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.classList.add('copied');
    btn.innerHTML = '<span class="material-symbols-outlined">check</span> Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<span class="material-symbols-outlined">content_copy</span> Copy';
    }, 2000);
  });
}

export function initShareListeners() {
  // Close modal on overlay click
  const shareModal = document.getElementById('shareModal');
  if (shareModal) {
    shareModal.addEventListener('click', (e) => {
      if (e.target.id === 'shareModal') {
        closeShareModal();
      }
    });
  }

  // Close event picker when clicking outside
  document.addEventListener('click', (e) => {
    const picker = document.getElementById('shareEventPicker');
    const addBtn = e.target.closest('.share-add-btn');
    if (picker && !addBtn && !e.target.closest('.share-event-picker')) {
      picker.classList.remove('active');
    }
  });
}
