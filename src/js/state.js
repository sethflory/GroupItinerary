// ========================================
// GLOBAL STATE
// ========================================

import { TRIPS } from './config.js';

// Current trip state - persisted in localStorage
export let currentTripId = localStorage.getItem('currentTripId') || 'athens-bangalore-2026';

// Ensure valid trip
if (!TRIPS[currentTripId]) {
  currentTripId = 'athens-bangalore-2026';
}

export function setCurrentTripId(tripId) {
  if (TRIPS[tripId]) {
    currentTripId = tripId;
    localStorage.setItem('currentTripId', tripId);
  }
}

export function getCurrentTrip() {
  return TRIPS[currentTripId];
}

export function getCurrentPhotoPrefix() {
  return getCurrentTrip().photoPrefix || '';
}

export function isTestTrip() {
  return currentTripId === 'test-trip';
}

// Traveler filter state
export let currentTravelerFilter = 'all';

export function setTravelerFilter(filter) {
  currentTravelerFilter = filter;
}

// Current day index
export let currentDayIndex = 0;

export function setCurrentDayIndex(index) {
  currentDayIndex = index;
}

// Current phase
export let currentPhase = null;

export function setCurrentPhase(phase) {
  currentPhase = phase;
}

// Current view
export let currentView = 'journey';

export function setCurrentView(view) {
  currentView = view;
}

// Expanded days in list view
export const expandedDays = new Set([0]);

export function toggleExpandedDay(index) {
  if (expandedDays.has(index)) {
    expandedDays.delete(index);
  } else {
    expandedDays.add(index);
  }
}

// ========================================
// MUTABLE DATA (loaded from API or hardcoded)
// ========================================

// These will be populated by data loading
export let TRAVELERS = [];
export let TRAVELER_ORDER = [];
export let TRAVELER_INITIALS = {};
export let DAYS = [];
export let PRODUCTION_DAYS = [];
export let DESTINATIONS = {};
export let HOTEL = null;
export let PHASES = {};
export let CAROUSELS = {};

// Setters for data
export function setTravelers(travelers) {
  TRAVELERS = travelers;
  TRAVELER_ORDER = travelers.map(t => t.id);
  TRAVELER_INITIALS = Object.fromEntries(travelers.map(t => [t.id, t.initials]));
}

export function setDays(days) {
  DAYS = days;
}

export function setProductionDays(days) {
  PRODUCTION_DAYS = days;
}

export function setDestinations(destinations) {
  DESTINATIONS = destinations;
}

export function setHotel(hotel) {
  HOTEL = hotel;
}

export function setPhases(phases) {
  PHASES = phases;
}

export function setCarousels(carousels) {
  CAROUSELS = carousels;
}

// Chat history for AI
export let chatHistory = [];

export function addToChatHistory(message) {
  chatHistory.push(message);
  // Keep manageable size
  if (chatHistory.length > 20) {
    chatHistory = chatHistory.slice(-20);
  }
}

export function clearChatHistory() {
  chatHistory = [];
}

// Photo cache
export let tripPhotosCache = [];

export function setTripPhotosCache(photos) {
  tripPhotosCache = photos;
}
