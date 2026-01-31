// ========================================
// TRAVELER ONBOARDING FLOW
// ========================================

import * as session from '../session.js';

// Module state
let currentStep = 'welcome';
let sessionData = null;
let tripInfo = null;

// ========================================
// MODAL MANAGEMENT
// ========================================

export function openOnboardingModal(sessionResult, tripData) {
  sessionData = sessionResult;
  tripInfo = tripData;
  currentStep = 'welcome';

  let modal = document.getElementById('onboardingModal');
  if (!modal) {
    createOnboardingModal();
    modal = document.getElementById('onboardingModal');
  }

  modal.classList.add('active');
  showWelcomeStep();
}

export function closeOnboardingModal() {
  const modal = document.getElementById('onboardingModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createOnboardingModal() {
  const modal = document.createElement('div');
  modal.id = 'onboardingModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal onboarding-modal">
      <div class="modal-body" id="onboardingBody">
        <!-- Content rendered dynamically -->
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // No overlay click to close - user must complete onboarding
}

// ========================================
// STEP 1: WELCOME
// ========================================

function showWelcomeStep() {
  currentStep = 'welcome';
  const body = document.getElementById('onboardingBody');

  const trip = tripInfo?.trip || {};
  const travelers = tripInfo?.travelers || [];
  const days = tripInfo?.days || [];

  // Calculate stats
  const travelerCount = travelers.length;
  const eventCount = days.reduce((sum, day) => sum + (day.events?.length || 0), 0);

  // Format date range
  const dateRange = formatDateRange(days);

  body.innerHTML = `
    <div class="onboarding-welcome">
      <div class="onboarding-icon">
        ${trip.icon || '✈️'}
      </div>
      <h2>Welcome to ${escapeHtml(trip.name || 'the trip')}!</h2>
      <p class="onboarding-subtitle">You're all set to start planning.</p>

      <div class="onboarding-stats">
        <div class="onboarding-stat">
          <div class="value">${travelerCount}</div>
          <div class="label">Traveler${travelerCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="onboarding-stat">
          <div class="value">${eventCount}</div>
          <div class="label">Event${eventCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="onboarding-stat">
          <div class="value">${days.length}</div>
          <div class="label">Day${days.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      ${dateRange ? `<p class="onboarding-dates">${dateRange}</p>` : ''}

      <div class="onboarding-actions">
        <button class="btn primary" onclick="onboardingAddEvents()">
          <span class="material-symbols-outlined">add_circle</span>
          Add My Events
        </button>
        <button class="btn secondary" onclick="onboardingSkip()">
          Just Browse
        </button>
      </div>
    </div>
  `;

  // Expose functions for onclick handlers
  window.onboardingAddEvents = showAddEventsStep;
  window.onboardingSkip = skipOnboarding;
}

// ========================================
// STEP 2: ADD EVENTS
// ========================================

function showAddEventsStep() {
  currentStep = 'addEvents';
  const body = document.getElementById('onboardingBody');

  body.innerHTML = `
    <div class="onboarding-add-events">
      <button class="onboarding-back-btn" onclick="onboardingBack()">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>

      <h2>Add Your Events</h2>
      <p class="onboarding-subtitle">How would you like to add your travel plans?</p>

      <div class="onboarding-options">
        <button class="onboarding-option" onclick="onboardingUploadReceipt()">
          <span class="material-symbols-outlined option-icon">receipt_long</span>
          <div class="option-content">
            <div class="option-title">Upload Receipt</div>
            <div class="option-desc">Scan a booking confirmation or email</div>
          </div>
          <span class="material-symbols-outlined option-arrow">chevron_right</span>
        </button>

        <button class="onboarding-option" onclick="onboardingAddFlight()">
          <span class="material-symbols-outlined option-icon">flight</span>
          <div class="option-content">
            <div class="option-title">Add Flight</div>
            <div class="option-desc">Enter your flight details manually</div>
          </div>
          <span class="material-symbols-outlined option-arrow">chevron_right</span>
        </button>

        <button class="onboarding-option" onclick="onboardingAddHotel()">
          <span class="material-symbols-outlined option-icon">hotel</span>
          <div class="option-content">
            <div class="option-title">Add Hotel</div>
            <div class="option-desc">Enter your accommodation details</div>
          </div>
          <span class="material-symbols-outlined option-arrow">chevron_right</span>
        </button>
      </div>

      <button class="btn text skip-link" onclick="onboardingShowCompletion()">
        Skip for now
      </button>
    </div>
  `;

  // Expose functions for onclick handlers
  window.onboardingBack = showWelcomeStep;
  window.onboardingUploadReceipt = handleUploadReceipt;
  window.onboardingAddFlight = handleAddFlight;
  window.onboardingAddHotel = handleAddHotel;
  window.onboardingShowCompletion = showCompletionStep;
}

// ========================================
// STEP 3: COMPLETION
// ========================================

function showCompletionStep() {
  currentStep = 'completion';
  const body = document.getElementById('onboardingBody');

  body.innerHTML = `
    <div class="onboarding-completion">
      <div class="completion-icon">
        <span class="material-symbols-outlined">check_circle</span>
      </div>
      <h2>You're all set!</h2>
      <p class="onboarding-subtitle">Here are some tips to get started:</p>

      <div class="onboarding-tips">
        <div class="tip">
          <span class="material-symbols-outlined">swipe</span>
          <span>Swipe through days to explore the itinerary</span>
        </div>
        <div class="tip">
          <span class="material-symbols-outlined">touch_app</span>
          <span>Tap events to see more details</span>
        </div>
        <div class="tip">
          <span class="material-symbols-outlined">add_photo_alternate</span>
          <span>Add photos to capture memories</span>
        </div>
      </div>

      <div class="onboarding-actions">
        <button class="btn primary" onclick="onboardingComplete()">
          <span class="material-symbols-outlined">explore</span>
          View Itinerary
        </button>
      </div>
    </div>
  `;

  // Expose function for onclick handler
  window.onboardingComplete = completeOnboarding;
}

// ========================================
// ACTIONS
// ========================================

function handleUploadReceipt() {
  markOnboardingCompleteAndClose();
  // Open receipt upload modal
  if (window.openReceiptUploadModal) {
    window.openReceiptUploadModal();
  }
}

function handleAddFlight() {
  markOnboardingCompleteAndClose();
  openEventFormWithType('flight');
}

function handleAddHotel() {
  markOnboardingCompleteAndClose();
  openEventFormWithType('hotel');
}

function openEventFormWithType(eventType) {
  // Get today's date or first trip day
  const days = tripInfo?.days || [];
  const date = days.length > 0 ? days[0].date : new Date().toISOString().split('T')[0];

  if (window.openAddEventForm) {
    window.openAddEventForm(date);

    // Set the event type after the form opens
    setTimeout(() => {
      const typeSelect = document.getElementById('eventFormType');
      if (typeSelect) {
        typeSelect.value = eventType;
      }
    }, 50);
  }
}

function skipOnboarding() {
  markOnboardingCompleteAndClose();
}

function completeOnboarding() {
  markOnboardingCompleteAndClose();
}

async function markOnboardingCompleteAndClose() {
  // Mark onboarding as complete in the backend
  await session.markOnboardingComplete();

  // Close the modal
  closeOnboardingModal();
}

// ========================================
// HELPERS
// ========================================

function formatDateRange(days) {
  if (!days || days.length === 0) return '';

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  if (!firstDay.date || !lastDay.date) return '';

  try {
    const start = new Date(firstDay.date + 'T00:00:00');
    const end = new Date(lastDay.date + 'T00:00:00');

    const options = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });

    return `${startStr} - ${endStr}`;
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
