// ========================================
// TIMEZONE CLOCKS WIDGET
// ========================================

import { getCurrentTrip } from '../state.js';

let clockInterval = null;
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

// ========================================
// CLOCK UPDATES
// ========================================

function getTimeInTimezone(timezone) {
  try {
    const now = new Date();
    const options = { timeZone: timezone, hour: 'numeric', minute: 'numeric', hour12: false };
    const timeStr = now.toLocaleTimeString('en-US', options);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours: hours % 12, minutes };
  } catch (e) {
    return { hours: 0, minutes: 0 };
  }
}

function updateClockHands(clockId, timezone) {
  const { hours, minutes } = getTimeInTimezone(timezone);

  const hourHand = document.getElementById(`tzHour${clockId}`);
  const minuteHand = document.getElementById(`tzMinute${clockId}`);

  if (hourHand) {
    const hourDeg = (hours * 30) + (minutes * 0.5); // 30 degrees per hour + minute offset
    hourHand.style.transform = `rotate(${hourDeg}deg)`;
  }

  if (minuteHand) {
    const minuteDeg = minutes * 6; // 6 degrees per minute
    minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
  }
}

function updateAllClocks() {
  // Clock 1 - Home timezone
  const clock1 = document.getElementById('tzClock1');
  if (clock1) {
    const tz1 = clock1.dataset.timezone || 'America/Chicago';
    updateClockHands('1', tz1);
  }

  // Clock 2 - Destination timezone
  const clock2 = document.getElementById('tzClock2');
  if (clock2) {
    const tz2 = clock2.dataset.timezone || 'Europe/Athens';
    updateClockHands('2', tz2);
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
// TIMEZONE CONFIGURATION
// ========================================

export function setDestinationTimezone(timezone, city) {
  const clock2 = document.getElementById('tzClock2');
  const cityLabel = document.getElementById('tzCity2');

  if (clock2) {
    clock2.dataset.timezone = timezone;
    clock2.dataset.city = city;
  }
  if (cityLabel) {
    cityLabel.textContent = city;
  }

  updateAllClocks();
}

export function setHomeTimezone(timezone, city) {
  const clock1 = document.getElementById('tzClock1');
  const cityLabel = document.getElementById('tzCity1');

  if (clock1) {
    clock1.dataset.timezone = timezone;
    clock1.dataset.city = city;
  }
  if (cityLabel) {
    cityLabel.textContent = city;
  }

  updateAllClocks();
}

// ========================================
// ADD CUSTOM TIMEZONE
// ========================================

export function addTimezone() {
  // Create a simple timezone picker modal
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
        <h4>Add Timezone</h4>
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
      ${customTimezone ? `
        <div class="tz-picker-footer">
          <button class="tz-picker-remove" onclick="removeCustomTimezone()">
            <span class="material-symbols-outlined">delete</span>
            Remove custom timezone
          </button>
        </div>
      ` : ''}
    </div>
  `;

  document.body.appendChild(modal);

  // Close on backdrop click
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
}

export function selectTimezone(timezone, city) {
  customTimezone = timezone;
  customCity = city;
  localStorage.setItem('customTimezone', timezone);
  localStorage.setItem('customCity', city);

  // Transform the add button into a real clock
  const clock3 = document.getElementById('tzClock3');
  if (clock3) {
    clock3.classList.remove('tz-clock-add');
    clock3.classList.add('tz-clock-custom');
    clock3.onclick = addTimezone; // Click to change
    clock3.title = 'Change timezone';
    clock3.innerHTML = `
      <div class="clock-face">
        <div class="clock-hand hour" id="tzHour3"></div>
        <div class="clock-hand minute" id="tzMinute3"></div>
      </div>
      <span class="clock-city" id="tzCity3">${city}</span>
    `;
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
  // Set destination timezone based on current trip
  const trip = getCurrentTrip();
  if (trip) {
    // Map trip destinations to timezones
    const destTimezones = {
      'athens': { tz: 'Europe/Athens', city: 'Athens' },
      'greece': { tz: 'Europe/Athens', city: 'Athens' },
      'bangalore': { tz: 'Asia/Kolkata', city: 'India' },
      'india': { tz: 'Asia/Kolkata', city: 'India' }
    };

    const tripName = trip.name?.toLowerCase() || '';
    for (const [key, value] of Object.entries(destTimezones)) {
      if (tripName.includes(key)) {
        setDestinationTimezone(value.tz, value.city);
        break;
      }
    }
  }

  // Restore custom timezone if saved
  if (customTimezone && customCity) {
    selectTimezone(customTimezone, customCity);
  }

  // Initial update
  updateAllClocks();

  // Update every minute
  if (clockInterval) {
    clearInterval(clockInterval);
  }
  clockInterval = setInterval(updateAllClocks, 60000);
}

// ========================================
// WINDOW EXPORTS
// ========================================

window.addTimezone = addTimezone;
window.closeTimezonePicker = closeTimezonePicker;
window.selectTimezone = selectTimezone;
window.removeCustomTimezone = removeCustomTimezone;
