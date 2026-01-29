// ========================================
// SESSION MANAGEMENT
// ========================================
// Handles current user/traveler context

import { API_BASE } from './config.js';

// Session storage keys
const SESSION_KEY = 'tripSession';
const USER_KEY = 'currentUser';

// Current session state
let currentSession = null;

// ========================================
// SESSION OPERATIONS
// ========================================

export function getSession() {
  if (currentSession) return currentSession;

  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      currentSession = JSON.parse(stored);
      return currentSession;
    } catch (e) {
      console.error('Failed to parse session:', e);
    }
  }
  return null;
}

export function setSession(session) {
  currentSession = session;
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function clearSession() {
  currentSession = null;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
}

// ========================================
// SESSION PROPERTIES
// ========================================

export function isAuthenticated() {
  const session = getSession();
  return session && session.valid === true;
}

export function getCurrentUserId() {
  return getSession()?.userId || null;
}

export function getCurrentTravelerId() {
  return getSession()?.travelerId || null;
}

export function getCurrentTripId() {
  return getSession()?.tripId || null;
}

export function getDisplayName() {
  return getSession()?.displayName || 'Traveler';
}

export function getUserRole() {
  return getSession()?.role || 'viewer';
}

export function isAdmin() {
  const role = getUserRole();
  return role === 'admin' || role === 'creator';
}

export function needsRegistration() {
  return getSession()?.needsRegistration === true;
}

export function needsOnboarding() {
  const session = getSession();
  return session && !session.onboardingComplete;
}

// ========================================
// AUTHENTICATION API
// ========================================

export async function validateTripCode(tripId, accessCode) {
  try {
    const response = await fetch(`${API_BASE}/auth/trip-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, accessCode })
    });

    const data = await response.json();

    if (response.ok && data.valid) {
      setSession(data);
      return { success: true, ...data };
    }

    return { success: false, error: data.error || 'Invalid code' };
  } catch (error) {
    console.error('Trip code validation error:', error);
    return { success: false, error: error.message };
  }
}

export async function registerUser(userData) {
  const session = getSession();
  if (!session) {
    return { success: false, error: 'No active session' };
  }

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: session.tripId,
        travelerId: session.travelerId,
        accessCode: session.tripCode || localStorage.getItem('lastAccessCode'),
        isLegacy: session.isLegacy,
        ...userData
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Update session with registered user info
      setSession({
        ...session,
        userId: data.userId,
        needsRegistration: false,
        onboardingComplete: false
      });
      return { success: true, ...data };
    }

    return { success: false, error: data.error || 'Registration failed' };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: error.message };
  }
}

export async function checkGoogleAuth() {
  try {
    const response = await fetch(`${API_BASE}/auth/session`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Google auth check error:', error);
    return { authenticated: false };
  }
}

export async function linkGoogleAccount() {
  try {
    const response = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Update session with Google-linked user
      const session = getSession();
      if (session) {
        setSession({
          ...session,
          userId: data.userId,
          googleLinked: true
        });
      }
      return { success: true, ...data };
    }

    return { success: false, error: data.error || 'Google linking failed' };
  } catch (error) {
    console.error('Google link error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// USER PROFILE API
// ========================================

export async function getCurrentUser() {
  const userId = getCurrentUserId();
  if (!userId) return null;

  try {
    const response = await fetch(`${API_BASE}/users/me?userId=${userId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

export async function updateUserProfile(updates) {
  const userId = getCurrentUserId();
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_BASE}/users/me?userId=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, user: data };
    }

    return { success: false, error: data.error };
  } catch (error) {
    console.error('Update profile error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// TRIP MEMBERS API
// ========================================

export async function getTripMembers(tripId) {
  const session = getSession();
  if (!session) return [];

  try {
    const params = new URLSearchParams({
      tripId: tripId || session.tripId,
      accessCode: localStorage.getItem('lastAccessCode') || ''
    });

    const response = await fetch(`${API_BASE}/trips/${tripId || session.tripId}/members?${params}`);
    if (response.ok) {
      const data = await response.json();
      return data.members || [];
    }
    return [];
  } catch (error) {
    console.error('Get members error:', error);
    return [];
  }
}

export async function markOnboardingComplete() {
  const session = getSession();
  if (!session || !session.travelerId) return false;

  try {
    const params = new URLSearchParams({
      tripId: session.tripId,
      accessCode: localStorage.getItem('lastAccessCode') || ''
    });

    const response = await fetch(
      `${API_BASE}/trips/${session.tripId}/members/${session.travelerId}?${params}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingComplete: true })
      }
    );

    if (response.ok) {
      setSession({ ...session, onboardingComplete: true });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Mark onboarding complete error:', error);
    return false;
  }
}

// ========================================
// INITIALIZATION
// ========================================

export function initSession() {
  // Load existing session
  const session = getSession();

  if (session) {
    console.log('[Session] Restored session for', session.displayName);
  }

  return session;
}
