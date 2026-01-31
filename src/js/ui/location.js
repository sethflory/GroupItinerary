// ========================================
// LOCATION SERVICE
// ========================================

import { currentTripId, getLocationSharingEnabled } from '../state.js';
import { getCurrentTravelerId } from '../auth.js';
import { updateMyLocation as updateLocationAPI } from '../api.js';

// Constants
const UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Module state
let updateIntervalId = null;
let isInitialized = false;

// ========================================
// CORE FUNCTIONS
// ========================================

export function initLocationService() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('[Location] Initializing location service');

  // Update on visibility change (tab becomes visible)
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initial update if sharing is enabled
  if (getLocationSharingEnabled()) {
    startLocationUpdates();
  }
}

export function startLocationUpdates() {
  console.log('[Location] Starting location updates');

  // Clear any existing interval
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
  }

  // Do an immediate update
  updateMyLocation();

  // Set up interval for periodic updates
  updateIntervalId = setInterval(updateMyLocation, UPDATE_INTERVAL);
}

export function stopLocationUpdates() {
  console.log('[Location] Stopping location updates');

  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
}

export async function updateMyLocation() {
  // Check if sharing is enabled
  if (!getLocationSharingEnabled()) {
    console.log('[Location] Sharing disabled, skipping update');
    return;
  }

  const travelerId = getCurrentTravelerId();
  if (!travelerId) {
    console.log('[Location] No traveler ID, skipping update');
    return;
  }

  // Get current position
  if (!navigator.geolocation) {
    console.warn('[Location] Geolocation not supported');
    return;
  }

  try {
    const position = await getCurrentPosition();
    const { latitude, longitude, accuracy } = position.coords;

    console.log('[Location] Got position:', { latitude, longitude, accuracy });

    // Send to API
    await updateLocationAPI(
      currentTripId,
      travelerId,
      latitude,
      longitude,
      accuracy
    );

    console.log('[Location] Location updated successfully');
  } catch (error) {
    console.warn('[Location] Failed to update location:', error.message);
  }
}

// ========================================
// HELPERS
// ========================================

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    // First try high accuracy with longer timeout
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        // If high accuracy fails, try low accuracy as fallback
        if (error.code === error.TIMEOUT) {
          console.log('[Location] High accuracy timed out, trying low accuracy');
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 300000 // Accept cached position up to 5 minutes old
            }
          );
        } else {
          reject(error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000 // Accept cached position up to 1 minute old
      }
    );
  });
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && getLocationSharingEnabled()) {
    console.log('[Location] Tab became visible, updating location');
    updateMyLocation();
  }
}

// ========================================
// PUBLIC API FOR TOGGLING
// ========================================

export async function enableLocationSharing() {
  // Request permission first
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });

    if (permission.state === 'denied') {
      throw new Error('Location permission denied. Please enable it in browser settings.');
    }

    // Try to get a position to trigger the permission prompt if needed
    await getCurrentPosition();

    // Start updates
    startLocationUpdates();
    return true;
  } catch (error) {
    console.error('[Location] Failed to enable sharing:', error);
    throw error;
  }
}

export function disableLocationSharing() {
  stopLocationUpdates();
}
