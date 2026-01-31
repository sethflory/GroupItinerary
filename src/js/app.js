// ========================================
// MAIN APPLICATION ENTRY POINT
// ========================================

import { isFeatureEnabled, FEATURE_FLAGS, TRIPS, API_BASE, applyFeatureFlags } from './config.js';
import * as state from './state.js';
import * as auth from './auth.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { PRODUCTION_TRAVELERS, PRODUCTION_HOTEL, DESTINATIONS, CAROUSELS, PRODUCTION_PHASES, PRODUCTION_DAYS, TEST_TRIP_DATA } from './data.js';

// UI Modules
import * as dayView from './ui/dayView.js';
import * as listView from './ui/listView.js';
import * as photos from './ui/photos.js';
import * as events from './ui/events.js';
import * as share from './ui/share.js';
import * as ai from './ui/ai.js';
import * as navigation from './ui/navigation.js';
import * as stats from './ui/stats.js';
import * as countdown from './ui/countdown.js';
import * as modals from './ui/modals.js';
import * as trivia from './ui/trivia.js';
import * as tripSetup from './ui/tripSetup.js';
import * as receiptUpload from './ui/receiptUpload.js';
import * as onboarding from './ui/onboarding.js';
import * as dinnerPoll from './ui/dinnerPoll.js';
import * as sawIt from './ui/sawIt.js';

// ========================================
// GLOBAL STATE
// ========================================

// Active data - swapped based on current trip
let TRAVELERS = state.isTestTrip() ? TEST_TRIP_DATA.travelers : PRODUCTION_TRAVELERS;
let HOTEL = state.isTestTrip() ? TEST_TRIP_DATA.hotel : PRODUCTION_HOTEL;
let DAYS = state.isTestTrip() ? TEST_TRIP_DATA.days : PRODUCTION_DAYS;
let PHASES = PRODUCTION_PHASES;

// Make data globally accessible
window.TRAVELERS = TRAVELERS;
window.HOTEL = HOTEL;
window.DAYS = DAYS;
window.PHASES = PHASES;
window.DESTINATIONS = DESTINATIONS;
window.CAROUSELS = CAROUSELS;

// ========================================
// CONFIG EXPORTS
// ========================================

window.isFeatureEnabled = isFeatureEnabled;
window.FEATURE_FLAGS = FEATURE_FLAGS;
window.TRIPS = TRIPS;
window.API_BASE = API_BASE;
window.applyFeatureFlags = applyFeatureFlags;

// ========================================
// STATE EXPORTS
// ========================================

window.currentTripId = state.currentTripId;
window.getCurrentTrip = state.getCurrentTrip;
window.getCurrentPhotoPrefix = state.getCurrentPhotoPrefix;
window.isTestTrip = state.isTestTrip;
window.setCurrentTripId = state.setCurrentTripId;
window.state = state;

// ========================================
// AUTH EXPORTS
// ========================================

window.isAccessGranted = auth.isAccessGranted;
window.getStoredAccessCode = auth.getStoredAccessCode;
window.grantAccess = auth.grantAccess;
window.revokeAccess = auth.revokeAccess;
window.verifyAccessCode = auth.verifyAccessCode;
window.showLockScreen = auth.showLockScreen;
window.hideLockScreen = auth.hideLockScreen;
window.checkAccessOnLoad = auth.checkAccessOnLoad;

// Registration modal exports
window.showRegistrationModal = auth.showRegistrationModal;
window.hideRegistrationModal = auth.hideRegistrationModal;
window.submitRegistration = auth.submitRegistration;

// Identity exports
window.getCurrentUserId = auth.getCurrentUserId;
window.getCurrentTravelerId = auth.getCurrentTravelerId;
window.getDisplayName = auth.getDisplayName;
window.isAdmin = auth.isAdmin;

// Google auth exports
window.redirectToGoogleLogin = auth.redirectToGoogleLogin;
window.checkGoogleAuthStatus = auth.checkGoogleAuthStatus;
window.linkGoogleAccount = auth.linkGoogleAccount;

// Session module for direct access
window.session = auth.session;

// ========================================
// API EXPORTS
// ========================================

window.loadTripDataFromAPI = api.loadTripDataFromAPI;
window.loadEventsFromAPI = api.loadEventsFromAPI;
window.createEvent = api.createEvent;
window.updateEvent = api.updateEvent;
window.deleteEventAPI = api.deleteEventAPI;
window.loadPhotos = api.loadPhotos;
window.uploadPhoto = api.uploadPhoto;
window.deletePhoto = api.deletePhoto;
window.sendAIMessage = api.sendAIMessage;
window.fetchWeather = api.fetchWeather;

// ========================================
// UTILS EXPORTS
// ========================================

window.isForTraveler = utils.isForTraveler;
window.getGroupBadgeClass = utils.getGroupBadgeClass;
window.getGroupLabel = utils.getGroupLabel;
window.renderTravelerPills = utils.renderTravelerPills;
window.formatTime = utils.formatTime;
window.formatTimeRange = utils.formatTimeRange;
window.calculateTotalMiles = utils.calculateTotalMiles;
window.calculateFlightCount = utils.calculateFlightCount;
window.calculateTotalSteps = utils.calculateTotalSteps;
window.calculateGroundTravelTime = utils.calculateGroundTravelTime;
window.escapeHtml = utils.escapeHtml;
window.formatAiResponse = utils.formatAiResponse;
window.getEventIcon = utils.getEventIcon;
window.getEventTypeLabel = utils.getEventTypeLabel;
window.getWeatherIcon = utils.getWeatherIcon;
window.getWeatherDescription = utils.getWeatherDescription;

// ========================================
// DAY VIEW EXPORTS
// ========================================

window.goToDay = dayView.goToDay;
window.goToToday = dayView.goToToday;
window.renderDayList = dayView.renderDayList;
window.renderDayDetail = dayView.renderDayDetail;
window.renderEventCard = dayView.renderEventCard;
window.renderCarousel = dayView.renderCarousel;
window.moveCarousel = dayView.moveCarousel;
window.goToSlide = dayView.goToSlide;

// ========================================
// LIST VIEW EXPORTS
// ========================================

window.renderListView = listView.renderListView;
window.toggleListDay = listView.toggleListDay;
window.expandAllDays = listView.expandAllDays;
window.collapseAllDays = listView.collapseAllDays;

// ========================================
// PHOTOS EXPORTS
// ========================================

window.loadTripPhotos = photos.loadTripPhotos;
window.renderPhotoRibbon = photos.renderPhotoRibbon;
window.toggleRibbonPause = photos.toggleRibbonPause;
window.openUploadModal = photos.openUploadModal;
window.closeUploadModal = photos.closeUploadModal;
window.handleFileSelect = photos.handleFileSelect;
window.uploadPhotoHandler = photos.uploadPhotoHandler;
window.openLightbox = photos.openLightbox;
window.closeLightbox = photos.closeLightbox;
window.addMomentFromPhoto = photos.addMomentFromPhoto;

// ========================================
// EVENTS EXPORTS
// ========================================

window.openAddEventForm = events.openAddEventForm;
window.openEditEventForm = events.openEditEventForm;
window.closeEventForm = events.closeEventForm;
window.toggleEventTraveler = events.toggleEventTraveler;
window.submitEventForm = events.submitEventForm;
window.deleteEventFromForm = events.deleteEventFromForm;
window.deleteEvent = events.deleteEvent;

// ========================================
// SHARE EXPORTS
// ========================================

window.openShareModal = share.openShareModal;
window.openStatsShareModal = share.openStatsShareModal;
window.openMapShareModal = share.openMapShareModal;
window.closeShareModal = share.closeShareModal;
window.toggleEventPicker = share.toggleEventPicker;
window.addShareEvent = share.addShareEvent;
window.removeShareEvent = share.removeShareEvent;
window.regeneratePost = share.regeneratePost;
window.shareToTwitter = share.shareToTwitter;
window.shareToFacebook = share.shareToFacebook;
window.copyToClipboard = share.copyToClipboard;
window.setShareMapMode = share.setShareMapMode;

// ========================================
// AI EXPORTS
// ========================================

window.toggleAiChat = ai.toggleAiChat;
window.sendAiMessage = ai.sendAiMessage;
window.openAiInsights = ai.openAiInsights;
window.closeAiInsights = ai.closeAiInsights;
window.getInsight = ai.getInsight;

// ========================================
// NAVIGATION EXPORTS
// ========================================

window.setTravelerFilter = navigation.setTravelerFilter;
window.getTravelerFilter = navigation.getTravelerFilter;
window.toggleTravelerDropdown = navigation.toggleTravelerDropdown;
window.setPhase = navigation.setPhase;
window.getPhase = navigation.getPhase;
window.setView = navigation.setView;
window.getView = navigation.getView;
window.renderTravelerToggle = navigation.renderTravelerToggle;
window.renderPhaseTabs = navigation.renderPhaseTabs;
window.renderTripSelector = navigation.renderTripSelector;
window.toggleTripSelector = navigation.toggleTripSelector;
window.switchTrip = navigation.switchTrip;
window.lockTrip = navigation.lockTrip;

// ========================================
// STATS EXPORTS
// ========================================

window.toggleStats = stats.toggleStats;
window.renderStats = stats.renderStats;

// ========================================
// COUNTDOWN EXPORTS
// ========================================

window.updateCountdown = countdown.updateCountdown;
window.updateTimezone = countdown.updateTimezone;
window.updateTodayButton = countdown.updateTodayButton;
window.startTimers = countdown.startTimers;
window.stopTimers = countdown.stopTimers;

// ========================================
// MODALS EXPORTS
// ========================================

window.openHowItWorks = modals.openHowItWorks;
window.closeHiwModal = modals.closeHiwModal;
window.copyHiwPrompt = modals.copyHiwPrompt;

// ========================================
// TRIVIA EXPORTS
// ========================================

window.openTriviaModal = trivia.openTriviaModal;
window.closeTriviaModal = trivia.closeTriviaModal;
window.startTriviaRound = trivia.startTriviaRound;
window.selectTriviaAnswer = trivia.selectTriviaAnswer;
window.submitTriviaAnswer = trivia.submitTriviaAnswer;
window.addManualScore = trivia.addManualScore;
window.finishScoring = trivia.finishScoring;

// ========================================
// TRIP SETUP EXPORTS
// ========================================

window.openTripSetupModal = tripSetup.openTripSetupModal;
window.closeTripSetupModal = tripSetup.closeTripSetupModal;
window.switchTripSetupTab = tripSetup.switchTripSetupTab;
window.showAddTravelerForm = tripSetup.showAddTravelerForm;
window.hideAddTravelerForm = tripSetup.hideAddTravelerForm;
window.submitAddTraveler = tripSetup.submitAddTraveler;
window.editTraveler = tripSetup.editTraveler;
window.submitEditTraveler = tripSetup.submitEditTraveler;
window.confirmDeleteTraveler = tripSetup.confirmDeleteTraveler;
window.toggleCodeVisibility = tripSetup.toggleCodeVisibility;
window.copyAccessCode = tripSetup.copyAccessCode;
window.regenerateCode = tripSetup.regenerateCode;

// ========================================
// RECEIPT UPLOAD EXPORTS
// ========================================

window.openReceiptUploadModal = receiptUpload.openReceiptUploadModal;
window.closeReceiptUploadModal = receiptUpload.closeReceiptUploadModal;

// ========================================
// ONBOARDING EXPORTS
// ========================================

window.openOnboardingModal = onboarding.openOnboardingModal;
window.closeOnboardingModal = onboarding.closeOnboardingModal;

// ========================================
// DINNER POLL EXPORTS
// ========================================

window.openDinnerPollModal = dinnerPoll.openDinnerPollModal;
window.closeDinnerPollModal = dinnerPoll.closeDinnerPollModal;
window.getActivePollForDate = dinnerPoll.getActivePollForDate;
window.getActivePolls = dinnerPoll.getActivePolls;
window.refreshActivePolls = dinnerPoll.refreshActivePolls;

// ========================================
// SAW IT EXPORTS
// ========================================

window.openWhatsYouWillSee = sawIt.openWhatsYouWillSee;
window.closeSawItModal = sawIt.closeSawItModal;

// ========================================
// DEPENDENCY INJECTION
// ========================================

function injectDependencies() {
  const deps = {
    DAYS,
    TRAVELERS,
    DESTINATIONS,
    CAROUSELS,
    HOTEL,
    PHASES
  };

  // Inject into all UI modules
  dayView.setDayViewDeps(deps);
  listView.setListViewDeps(deps);
  events.setEventsDeps(deps);
  share.setShareDeps(deps);
  ai.setAiDeps(deps);
  navigation.setNavigationDeps(deps);
  stats.setStatsDeps(deps);
  countdown.setCountdownDeps(deps);
  dinnerPoll.setDinnerPollDeps(deps);
  sawIt.setSawItDeps(deps);
}

// ========================================
// WIRE UP NAVIGATION CALLBACKS
// ========================================

function wireNavigationCallbacks() {
  navigation.setNavigationCallbacks({
    onFilterChange: (filter) => {
      dayView.setTravelerFilter(filter);
      listView.setListViewTravelerFilter(filter);
      stats.setStatsFilter(filter);
      renderAll();
    },
    onPhaseChange: (phase) => {
      dayView.setPhase(phase);
      renderAll();
    },
    onViewChange: (view) => {
      if (view === 'list') {
        listView.renderListView();
      }
    }
  });
}

// ========================================
// RENDER ALL
// ========================================

function renderAll() {
  navigation.renderTravelerToggle();
  navigation.renderPhaseTabs();
  navigation.renderTripSelector();
  stats.renderStats();
  dayView.renderDayList();
  dayView.renderDayDetail();
  listView.renderListView();
  countdown.updateTodayButton();
  applyFeatureFlags();
}

// ========================================
// REFRESH TRIP DATA FROM API
// ========================================

async function refreshTripData() {
  if (!isFeatureEnabled('USE_TABLE_STORAGE')) return;

  try {
    console.log('[App] Loading trip data from API...');
    const apiData = await api.loadTripDataFromAPI(state.currentTripId);

    if (apiData && apiData.days && apiData.days.length > 0) {
      DAYS = apiData.days;
      window.DAYS = DAYS;

      if (apiData.travelers) {
        TRAVELERS = apiData.travelers;
        window.TRAVELERS = TRAVELERS;
      }

      // Re-inject dependencies with new data
      injectDependencies();
      renderAll();

      console.log('[App] Trip data loaded from API');
    }
  } catch (error) {
    console.log('[App] API not available, using hardcoded data:', error.message);
  }
}

window.refreshTripData = refreshTripData;

// ========================================
// REGISTRATION COMPLETE CALLBACK
// ========================================

function onRegistrationComplete(result) {
  console.log('[App] Registration complete:', result);

  // Refresh trip data with new user context
  refreshTripData();

  // Load photos
  photos.loadTripPhotos();

  // Re-render UI
  renderAll();

  // Show onboarding modal for new travelers who haven't completed it
  if (!result.onboardingComplete) {
    const trip = state.getCurrentTrip();
    onboarding.openOnboardingModal(result, {
      trip,
      travelers: TRAVELERS,
      days: DAYS
    });
  }
}

// Expose to window for auth module
window.onRegistrationComplete = onRegistrationComplete;

// ========================================
// INITIALIZATION
// ========================================

function init() {
  console.log('[App] Initializing...');

  // Inject dependencies
  injectDependencies();

  // Wire up callbacks
  wireNavigationCallbacks();

  // Initialize listeners
  share.initShareListeners();
  modals.initModalListeners();

  // Check access (will show lock screen or registration modal if needed)
  auth.checkAccessOnLoad(async (session) => {
    // Callback when access is granted
    console.log('[App] Access granted, session:', session);

    // Re-apply feature flags now that we know the user's role
    applyFeatureFlags();

    // Load trip data from API if enabled
    if (isFeatureEnabled('USE_TABLE_STORAGE')) {
      refreshTripData();

      // Load active dinner polls for button indicators
      try {
        await dinnerPoll.refreshActivePolls();
        renderAll(); // Re-render to show poll indicators
      } catch (e) {
        console.log('[App] Could not load dinner polls:', e.message);
      }
    }

    // Load photos
    photos.loadTripPhotos();
  });

  // Initial render
  renderAll();

  // Start timers
  countdown.startTimers();

  console.log('[App] Initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ========================================
// VIEW TOGGLE HANDLER
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  const viewToggle = document.getElementById('viewToggle');
  if (viewToggle) {
    viewToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-btn');
      if (!btn) return;

      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      navigation.setView(view);
    });
  }

  // Access code enter key
  const accessInput = document.getElementById('accessCodeInput');
  if (accessInput) {
    accessInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        auth.verifyAccessCode();
      }
    });
  }

  // Event form modal close on overlay click
  const eventFormModal = document.getElementById('eventFormModal');
  if (eventFormModal) {
    eventFormModal.addEventListener('click', (e) => {
      if (e.target.id === 'eventFormModal') {
        events.closeEventForm();
      }
    });
  }

  // Upload modal close on overlay click
  const uploadModal = document.getElementById('uploadModal');
  if (uploadModal) {
    uploadModal.addEventListener('click', (e) => {
      if (e.target.id === 'uploadModal') {
        photos.closeUploadModal();
      }
    });
  }

  // AI insights modal close on overlay click
  const aiInsightsModal = document.getElementById('aiInsightsModal');
  if (aiInsightsModal) {
    aiInsightsModal.addEventListener('click', (e) => {
      if (e.target.id === 'aiInsightsModal') {
        ai.closeAiInsights();
      }
    });
  }

  // Photo lightbox close on overlay click
  const lightbox = document.getElementById('photoLightbox');
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target.id === 'photoLightbox' || e.target.classList.contains('lightbox-close')) {
        photos.closeLightbox();
      }
    });
  }
});

console.log('[App] Modules loaded');
