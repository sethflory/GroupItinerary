// ========================================
// API CALLS
// ========================================

import { API_BASE, isFeatureEnabled } from './config.js';
import { currentTripId, getCurrentPhotoPrefix } from './state.js';
import { getStoredAccessCode } from './auth.js';

// ========================================
// TRIP DATA API
// ========================================

export async function loadTripDataFromAPI(tripId) {
  if (!isFeatureEnabled('USE_TABLE_STORAGE')) {
    console.log('[API] Table Storage disabled, using hardcoded data');
    return null;
  }

  const accessCode = getStoredAccessCode(tripId);
  if (!accessCode) {
    console.log('[API] No access code stored, cannot load from API');
    return null;
  }

  try {
    console.log('[API] Loading trip data from Table Storage...');
    const url = `${API_BASE}/trips/${tripId}/full?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn('[API] Failed to load trip data:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[API] Loaded trip data:', {
      trip: data.trip?.name,
      travelers: data.travelers?.length,
      days: data.days?.length,
      destinations: Object.keys(data.destinations || {}).length
    });

    return data;

  } catch (err) {
    console.error('[API] Error loading trip data:', err);
    return null;
  }
}

export async function loadEventsFromAPI(tripId, date) {
  if (!isFeatureEnabled('USE_TABLE_STORAGE')) {
    return null;
  }

  const accessCode = getStoredAccessCode(tripId);
  if (!accessCode) return null;

  try {
    const url = `${API_BASE}/trips/${tripId}/events?date=${date}&tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    return data.events;

  } catch (err) {
    console.error('[API] Error loading events:', err);
    return null;
  }
}

// ========================================
// EVENTS API
// ========================================

export async function createEvent(tripId, eventData) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/trips/${tripId}/events?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create event');
  }

  return await response.json();
}

export async function updateEvent(tripId, eventId, eventData) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/trips/${tripId}/events/${eventId}?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update event');
  }

  return await response.json();
}

export async function deleteEventAPI(tripId, eventId) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/trips/${tripId}/events/${eventId}?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to delete event');
  }

  return true;
}

// ========================================
// PHOTOS API
// ========================================

export async function loadPhotos(tripId) {
  const prefix = getCurrentPhotoPrefix();
  const accessCode = getStoredAccessCode(tripId);

  const response = await fetch(
    `${API_BASE}/photos?tripId=${tripId}&prefix=${encodeURIComponent(prefix)}&accessCode=${encodeURIComponent(accessCode)}`
  );

  if (!response.ok) {
    throw new Error('Failed to load photos');
  }

  const data = await response.json();
  return data.photos || [];
}

export async function uploadPhoto(tripId, { fileName, fileData, caption, uploadedBy }) {
  const prefix = getCurrentPhotoPrefix();
  const accessCode = getStoredAccessCode(tripId);

  const response = await fetch(`${API_BASE}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripId,
      accessCode,
      prefix,
      fileName,
      fileData,
      caption,
      uploadedBy
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Upload failed');
  }

  return await response.json();
}

export async function deletePhoto(tripId, blobName) {
  const accessCode = getStoredAccessCode(tripId);

  const response = await fetch(
    `${API_BASE}/photos?tripId=${tripId}&name=${encodeURIComponent(blobName)}&accessCode=${encodeURIComponent(accessCode)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Delete failed');
  }

  return true;
}

export async function deleteAllPhotos(tripId) {
  const accessCode = getStoredAccessCode(tripId);

  const response = await fetch(
    `${API_BASE}/photos?tripId=${tripId}&deleteAll=true&accessCode=${encodeURIComponent(accessCode)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Delete all photos failed');
  }

  return await response.json();
}

// ========================================
// AI API
// ========================================

export async function sendAIMessage(tripId, { system, messages, maxTokens = 1024 }) {
  const accessCode = getStoredAccessCode(tripId);

  const response = await fetch(`${API_BASE}/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripId,
      accessCode,
      system,
      messages,
      max_tokens: maxTokens
    })
  });

  const text = await response.text();
  if (!text) {
    throw new Error(`Empty response from server (status ${response.status}). AI function may not be deployed.`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid response: ${text.substring(0, 100)}`);
  }

  if (!response.ok) {
    throw new Error(data.error || `API request failed (${response.status})`);
  }

  return data.content?.[0]?.text || '';
}

// ========================================
// NOTIFICATIONS API
// ========================================

export async function fetchNotifications(tripId, options = {}) {
  const accessCode = getStoredAccessCode(tripId);
  const { limit = 20, since } = options;

  let url = `${API_BASE}/notifications/recent?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}&limit=${limit}`;
  if (since) {
    url += `&since=${encodeURIComponent(since)}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }

  const data = await response.json();
  return data.notifications || [];
}

// ========================================
// SCAVENGER HUNT API
// ========================================

export async function fetchActiveHunt(tripId) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/hunts/active?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch active hunt');
  }

  return await response.json();
}

export async function fetchHunts(tripId, status = null) {
  const accessCode = getStoredAccessCode(tripId);
  let url = `${API_BASE}/hunts/list?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;
  if (status) {
    url += `&status=${encodeURIComponent(status)}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch hunts');
  }

  const data = await response.json();
  return data.hunts || [];
}

export async function fetchHunt(tripId, huntId) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/hunts/${huntId}?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch hunt');
  }

  return await response.json();
}

export async function createHunt(tripId, huntData) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/hunts?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(huntData)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to create hunt');
  }

  return await response.json();
}

export async function endHunt(tripId, huntId) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/hunts/${huntId}?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'end' })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to end hunt');
  }

  return await response.json();
}

export async function claimHuntItem(tripId, huntId, itemId, claimData = {}) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/hunts/${huntId}/claim/${itemId}?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(claimData)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to claim item');
  }

  return await response.json();
}

export async function addHuntItem(tripId, huntId, itemData) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/hunts/${huntId}/items?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to add item');
  }

  return await response.json();
}

export async function deleteHunt(tripId, huntId) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/hunts/${huntId}?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to delete hunt');
  }

  return await response.json();
}

// ========================================
// LOCATION SHARING API
// ========================================

export async function updateMyLocation(tripId, travelerId, lat, lon, accuracy, displayName) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/trips/${tripId}/locations/${travelerId}?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, accuracy, displayName })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update location');
  }

  return await response.json();
}

export async function fetchLocations(tripId) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/trips/${tripId}/locations?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch locations');
  }

  const data = await response.json();
  return data.locations || [];
}

// ========================================
// IMAGE SEARCH API
// ========================================

export async function searchImages(tripId, query, options = {}) {
  const accessCode = getStoredAccessCode(tripId);
  const { count = 8, orientation = 'landscape' } = options;

  const params = new URLSearchParams({
    tripId,
    accessCode,
    q: query,
    count: count.toString(),
    orientation
  });

  const url = `${API_BASE}/images/search?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Image search failed');
  }

  const data = await response.json();
  return data.images || [];
}

// ========================================
// GOOGLE PLACES API
// ========================================

export async function searchPlacePhotos(tripId, query, options = {}) {
  const accessCode = getStoredAccessCode(tripId);
  const { count = 6, location = null } = options;

  const params = new URLSearchParams({
    tripId,
    accessCode,
    q: query,
    count: count.toString()
  });

  if (location) {
    params.append('location', location);
  }

  const url = `${API_BASE}/places/photos?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Place search failed');
  }

  const data = await response.json();
  return {
    place: data.place,
    photos: data.photos || []
  };
}

// ========================================
// WEATHER API
// ========================================

const weatherCache = {};
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function fetchWeather(locationCode, destinations) {
  const now = Date.now();
  const cached = weatherCache[locationCode];

  if (cached && (now - cached.timestamp) < WEATHER_CACHE_TTL) {
    return cached.data;
  }

  const dest = destinations[locationCode];
  if (!dest || !dest.lat || !dest.lon) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${dest.lat}&longitude=${dest.lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
    );

    if (!response.ok) return null;

    const data = await response.json();

    weatherCache[locationCode] = {
      timestamp: now,
      data: data.current
    };

    return data.current;
  } catch (err) {
    console.warn('Weather fetch failed:', err);
    return null;
  }
}
