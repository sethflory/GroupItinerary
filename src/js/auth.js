// ========================================
// ACCESS CODE & AUTHENTICATION
// ========================================

import { currentTripId, getCurrentTrip } from './state.js';
import { isFeatureEnabled } from './config.js';

function getAccessKey(tripId) {
  return `trip_access_${tripId}`;
}

function getAccessCodeKey(tripId) {
  return `trip_code_${tripId}`;
}

export function isAccessGranted(tripId) {
  const trip = getCurrentTrip();
  if (!trip || !trip.accessCode) return true;
  return localStorage.getItem(getAccessKey(tripId)) === 'granted';
}

export function getStoredAccessCode(tripId) {
  return localStorage.getItem(getAccessCodeKey(tripId)) || '';
}

export function grantAccess(tripId, accessCode) {
  localStorage.setItem(getAccessKey(tripId), 'granted');
  localStorage.setItem(getAccessCodeKey(tripId), accessCode);
}

export function revokeAccess(tripId) {
  localStorage.removeItem(getAccessKey(tripId));
  localStorage.removeItem(getAccessCodeKey(tripId));
}

export function verifyAccessCode(onSuccess) {
  const input = document.getElementById('accessCodeInput');
  const errorEl = document.getElementById('lockError');
  const enteredCode = input.value.trim().toLowerCase();
  const trip = getCurrentTrip();

  if (enteredCode === trip.accessCode.toLowerCase()) {
    grantAccess(currentTripId, enteredCode);
    hideLockScreen();
    errorEl.textContent = '';
    if (onSuccess) onSuccess();
  } else {
    input.classList.add('error');
    errorEl.textContent = 'Incorrect code. Please try again.';
    setTimeout(() => input.classList.remove('error'), 500);
  }
}

export function showLockScreen() {
  const lockScreen = document.getElementById('lockScreen');
  if (lockScreen) {
    lockScreen.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.getElementById('accessCodeInput')?.focus();
    }, 100);
  }
}

export function hideLockScreen() {
  const lockScreen = document.getElementById('lockScreen');
  if (lockScreen) {
    lockScreen.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

export function checkAccessOnLoad(onAccessGranted) {
  if (!isAccessGranted(currentTripId)) {
    showLockScreen();
  } else {
    hideLockScreen();
    if (onAccessGranted) onAccessGranted();
  }
}

// Setup enter key handler
export function setupAccessCodeInput() {
  const input = document.getElementById('accessCodeInput');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        verifyAccessCode();
      }
    });
  }
}
