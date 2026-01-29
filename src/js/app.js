// ========================================
// MAIN APPLICATION ENTRY POINT
// ========================================

import { isFeatureEnabled, FEATURE_FLAGS } from './config.js';
import * as state from './state.js';
import * as auth from './auth.js';
import * as api from './api.js';
import * as utils from './utils.js';

// Re-export for global access during migration
window.isFeatureEnabled = isFeatureEnabled;
window.FEATURE_FLAGS = FEATURE_FLAGS;

// State exports
window.currentTripId = state.currentTripId;
window.getCurrentTrip = state.getCurrentTrip;
window.getCurrentPhotoPrefix = state.getCurrentPhotoPrefix;
window.isTestTrip = state.isTestTrip;
window.setCurrentTripId = state.setCurrentTripId;
window.setTravelerFilter = state.setTravelerFilter;
window.setCurrentDayIndex = state.setCurrentDayIndex;
window.setCurrentPhase = state.setCurrentPhase;
window.setCurrentView = state.setCurrentView;
window.toggleExpandedDay = state.toggleExpandedDay;
window.expandedDays = state.expandedDays;

// Auth exports
window.isAccessGranted = auth.isAccessGranted;
window.getStoredAccessCode = auth.getStoredAccessCode;
window.grantAccess = auth.grantAccess;
window.verifyAccessCode = auth.verifyAccessCode;
window.showLockScreen = auth.showLockScreen;
window.hideLockScreen = auth.hideLockScreen;
window.checkAccessOnLoad = auth.checkAccessOnLoad;

// API exports
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

// Utils exports
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

// Make state accessible for mutation during migration
window.state = state;

console.log('[App] Modules loaded');
