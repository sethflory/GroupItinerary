// ========================================
// ACCESS CODE & AUTHENTICATION
// ========================================

import { currentTripId, getCurrentTrip, setCurrentTripId } from './state.js';
import { isFeatureEnabled, GOOGLE_CLIENT_ID } from './config.js';
import * as session from './session.js';

// Store callback for use after lock screen verification
let pendingAccessCallback = null;

// Legacy storage keys (for backward compatibility)
function getAccessKey(tripId) {
  return `trip_access_${tripId}`;
}

function getAccessCodeKey(tripId) {
  return `trip_code_${tripId}`;
}

// ========================================
// ACCESS CHECK
// ========================================

export function isAccessGranted(tripId) {
  // Check if trip requires access code
  const trip = getCurrentTrip();
  if (!trip || !trip.accessCode) return true;

  // Check new session system - require valid session
  const sess = session.getSession();
  if (sess && sess.valid && sess.tripId === tripId) {
    // Also verify we have a stored access code for API calls
    const storedCode = localStorage.getItem(getAccessCodeKey(tripId));
    if (storedCode) {
      return true;
    }
  }

  // No valid session - require re-authentication
  return false;
}

export function getStoredAccessCode(tripId) {
  // Try trip-specific code first (most reliable)
  const tripCode = localStorage.getItem(getAccessCodeKey(tripId));
  if (tripCode) {
    return tripCode;
  }

  // Fall back to lastAccessCode if session matches
  const sess = session.getSession();
  if (sess && sess.tripId === tripId) {
    return localStorage.getItem('lastAccessCode') || '';
  }

  // Last resort - return lastAccessCode even if session doesn't match
  // (handles edge cases where session state is stale)
  return localStorage.getItem('lastAccessCode') || '';
}

// ========================================
// GRANT/REVOKE ACCESS
// ========================================

export function grantAccess(tripId, accessCode) {
  localStorage.setItem(getAccessKey(tripId), 'granted');
  localStorage.setItem(getAccessCodeKey(tripId), accessCode);
  localStorage.setItem('lastAccessCode', accessCode);
}

export function revokeAccess(tripId) {
  localStorage.removeItem(getAccessKey(tripId));
  localStorage.removeItem(getAccessCodeKey(tripId));
  session.clearSession();
}

// ========================================
// VERIFY ACCESS CODE (New API-based flow)
// ========================================

export async function verifyAccessCode(onSuccess) {
  // Use stored callback if none provided (e.g., from lock screen button)
  const callback = onSuccess || pendingAccessCallback;

  const input = document.getElementById('accessCodeInput');
  const errorEl = document.getElementById('lockError');
  const submitBtn = document.querySelector('.lock-submit');
  const enteredCode = input.value.trim();

  if (!enteredCode) {
    errorEl.textContent = 'Please enter an access code.';
    return;
  }

  // Show loading state
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span> Checking...';
  }
  errorEl.textContent = '';

  try {
    // Try new API-based validation
    if (isFeatureEnabled('USE_TABLE_STORAGE')) {
      const result = await session.validateTripCode(currentTripId, enteredCode);

      if (result.success) {
        // Store code for API calls
        localStorage.setItem('lastAccessCode', enteredCode);
        grantAccess(currentTripId, enteredCode);

        // Check if user needs registration
        if (result.needsRegistration) {
          hideLockScreen();
          showRegistrationModal(result);
        } else {
          hideLockScreen();
          errorEl.textContent = '';
          pendingAccessCallback = null; // Clear stored callback
          if (callback) callback(result);
        }
        return;
      } else {
        throw new Error(result.error || 'Invalid access code');
      }
    }

    // Fall back to legacy local validation
    const trip = getCurrentTrip();
    if (enteredCode.toLowerCase() === trip.accessCode.toLowerCase()) {
      grantAccess(currentTripId, enteredCode);
      hideLockScreen();
      errorEl.textContent = '';
      pendingAccessCallback = null; // Clear stored callback
      if (callback) callback();
    } else {
      throw new Error('Invalid access code');
    }

  } catch (error) {
    input.classList.add('error');
    errorEl.textContent = error.message || 'Incorrect code. Please try again.';
    setTimeout(() => input.classList.remove('error'), 500);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Enter Trip';
    }
  }
}

// ========================================
// LOCK SCREEN
// ========================================

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

// ========================================
// REGISTRATION MODAL
// ========================================

export function showRegistrationModal(sessionData) {
  const modal = document.getElementById('registrationModal');
  if (!modal) {
    // Create modal if it doesn't exist
    createRegistrationModal();
  }

  // Store session data for registration
  window._pendingRegistration = sessionData;

  // Pre-fill name if available
  const nameInput = document.getElementById('regDisplayName');
  if (nameInput && sessionData.displayName) {
    nameInput.value = sessionData.displayName;
  }

  // Show welcome message
  const welcomeEl = document.getElementById('regWelcomeMessage');
  if (welcomeEl && sessionData.trip) {
    welcomeEl.textContent = `Welcome to ${sessionData.trip.name}!`;
  }

  document.getElementById('registrationModal')?.classList.add('active');
  document.getElementById('regDisplayName')?.focus();
}

export function hideRegistrationModal() {
  document.getElementById('registrationModal')?.classList.remove('active');
  window._pendingRegistration = null;
}

export async function submitRegistration() {
  const nameInput = document.getElementById('regDisplayName');
  const emailInput = document.getElementById('regEmail');
  const errorEl = document.getElementById('regError');
  const submitBtn = document.getElementById('regSubmitBtn');

  const displayName = nameInput?.value.trim();
  const email = emailInput?.value.trim();

  if (!displayName || displayName.length < 1) {
    errorEl.textContent = 'Please enter your name.';
    return;
  }

  // Show loading
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span> Creating...';
  }
  errorEl.textContent = '';

  try {
    const result = await session.registerUser({ displayName, email });

    if (result.success) {
      hideRegistrationModal();

      // Trigger app refresh/initialization
      if (window.onRegistrationComplete) {
        window.onRegistrationComplete(result);
      } else {
        window.location.reload();
      }
    } else {
      throw new Error(result.error || 'Registration failed');
    }

  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Join Trip';
    }
  }
}

function createRegistrationModal() {
  const modal = document.createElement('div');
  modal.id = 'registrationModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal registration-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">person_add</span> Quick Registration</h3>
      </div>
      <div class="modal-body">
        <p id="regWelcomeMessage" class="reg-welcome">Welcome!</p>
        <p class="reg-subtitle">Just need a few details to get you started.</p>

        <!-- Google Sign-In Button -->
        <div class="google-signin-wrapper">
          <div id="googleSignInButton"></div>
          <div class="reg-divider">
            <span>or register manually</span>
          </div>
        </div>

        <div class="form-group">
          <label for="regDisplayName">Your Name *</label>
          <input type="text" id="regDisplayName" placeholder="How should we call you?" maxlength="50">
        </div>

        <div class="form-group">
          <label for="regEmail">Email (optional)</label>
          <input type="email" id="regEmail" placeholder="For trip notifications">
          <span class="form-hint">We'll only use this for trip updates</span>
        </div>

        <div id="regError" class="form-error"></div>
      </div>
      <div class="modal-footer">
        <button id="regSubmitBtn" class="btn-primary" onclick="submitRegistration()">
          Join Trip
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Initialize Google Sign-In button
  initGoogleSignIn();

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      // Don't allow closing without registration
    }
  });

  // Enter key submits
  modal.querySelector('#regDisplayName')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitRegistration();
  });
  modal.querySelector('#regEmail')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitRegistration();
  });
}

// ========================================
// GOOGLE SIGN-IN
// ========================================

function initGoogleSignIn() {
  // Wait for Google Identity Services to load
  if (typeof google === 'undefined' || !google.accounts) {
    console.log('[Auth] Waiting for Google Identity Services...');
    setTimeout(initGoogleSignIn, 100);
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true
  });

  const buttonContainer = document.getElementById('googleSignInButton');
  if (buttonContainer) {
    google.accounts.id.renderButton(buttonContainer, {
      theme: 'outline',
      size: 'large',
      width: '100%',
      text: 'continue_with',
      shape: 'rectangular'
    });
  }
}

async function handleGoogleCredentialResponse(response) {
  console.log('[Auth] Google credential received');
  const errorEl = document.getElementById('regError');

  try {
    // Send the credential to our backend
    const result = await session.registerWithGoogle(response.credential);

    if (result.success) {
      hideRegistrationModal();

      // Trigger app refresh/initialization
      if (window.onRegistrationComplete) {
        window.onRegistrationComplete(result);
      } else {
        window.location.reload();
      }
    } else {
      throw new Error(result.error || 'Google sign-in failed');
    }
  } catch (error) {
    console.error('[Auth] Google sign-in error:', error);
    if (errorEl) {
      errorEl.textContent = error.message;
    }
  }
}

// Expose for global access
window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;

// ========================================
// CHECK ACCESS ON LOAD
// ========================================

export function checkAccessOnLoad(onAccessGranted) {
  // Check for ?reset parameter to clear auth (useful for beta launch/testing)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('reset')) {
    console.log('[Auth] Reset parameter detected - clearing all auth data');
    // Clear all auth-related localStorage
    localStorage.removeItem(getAccessKey(currentTripId));
    localStorage.removeItem(getAccessCodeKey(currentTripId));
    localStorage.removeItem('lastAccessCode');
    localStorage.removeItem('tripSession');
    localStorage.removeItem('currentUser');
    session.clearSession();
    // Remove the ?reset from URL without reload
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Initialize session
  session.initSession();

  // Store callback for later use (after lock screen verification)
  pendingAccessCallback = onAccessGranted;

  if (!isAccessGranted(currentTripId)) {
    showLockScreen();
  } else {
    hideLockScreen();
    pendingAccessCallback = null; // Clear since we're calling it now

    // Check if onboarding is needed
    const sess = session.getSession();
    if (sess && sess.needsRegistration) {
      showRegistrationModal(sess);
    } else if (onAccessGranted) {
      onAccessGranted(sess);
    }
  }
}

// ========================================
// GOOGLE AUTH HELPERS
// ========================================

export function redirectToGoogleLogin() {
  window.location.href = '/login';
}

export async function checkGoogleAuthStatus() {
  return await session.checkGoogleAuth();
}

export async function linkGoogleAccount() {
  return await session.linkGoogleAccount();
}

// ========================================
// CURRENT USER HELPERS
// ========================================

export function getCurrentUserId() {
  return session.getCurrentUserId();
}

export function getCurrentTravelerId() {
  return session.getCurrentTravelerId();
}

export function getDisplayName() {
  return session.getDisplayName();
}

export function isAdmin() {
  return session.isAdmin();
}

// ========================================
// SETUP
// ========================================

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

// Export session module for direct access
export { session };
