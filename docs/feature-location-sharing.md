# Feature: Location Sharing

## Overview

Allow travelers to share their location with group members via a new "Map" view. Location updates every 10 minutes when the app is active, plus on app start and visibility changes.

**Privacy**: All-or-nothing toggle (share with everyone or no one)

---

## Backend Status

**Already complete** - API and database ready:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trips/{tripId}/locations` | GET | Fetch all traveler locations |
| `/api/trips/{tripId}/locations/{travelerId}` | GET | Fetch single location |
| `/api/trips/{tripId}/locations/{travelerId}` | PUT | Update own location |

**Database**: `TRAVELER_LOCATIONS` table with `lat`, `lon`, `accuracy`, `isSharing`, `updatedAt`

**Sync**: Location data already included in `/sync` polling response

---

## Frontend Implementation

### 1. Traveler Profile Modal (NEW)

**File**: `src/js/ui/travelerProfile.js`

**Hook**: `window.openProfileModal()` called from `menu.js:openProfile()`

```
┌─────────────────────────────────────────┐
│  👤 My Profile                     [X]  │
├─────────────────────────────────────────┤
│                                         │
│  [SC]  ← avatar with traveler color     │
│                                         │
│  Display Name     Initials    Color     │
│  ┌───────────┐   ┌────┐     ┌────┐     │
│  │ Sarah     │   │ SC │     │ ██ │     │
│  └───────────┘   └────┘     └────┘     │
│                                         │
│  ─────────────────────────────────────  │
│  📍 Location Sharing                    │
│  ┌─────────────────────────────────┐    │
│  │ [Toggle]  Share with group      │    │
│  └─────────────────────────────────┘    │
│  Updates every 10 min while app open    │
│                                         │
│              [Save Changes]             │
└─────────────────────────────────────────┘
```

**Functionality**:
- Edit display name, initials, color
- Toggle location sharing on/off
- Request geolocation permission when enabling
- Save to API + localStorage

---

### 2. Map View (NEW)

**File**: `src/js/ui/mapView.js`

**Technology**: Leaflet + OpenStreetMap (no API key required)

**Add to view toggle** in action bar (`index.html` lines 101-108):

```html
<div class="view-toggle-mini" id="viewToggleMini">
  <button class="view-btn-mini active" data-view="journey">
    <span class="material-symbols-outlined">timeline</span>
  </button>
  <button class="view-btn-mini" data-view="list">
    <span class="material-symbols-outlined">list</span>
  </button>
  <button class="view-btn-mini" data-view="map">
    <span class="material-symbols-outlined">location_on</span>
  </button>
</div>
```

**Add map container** in main content:

```html
<div class="map-view" id="mapView">
  <!-- Leaflet map rendered here -->
</div>
```

**Features**:
- Show all travelers who are sharing (markers with initials/colors)
- "Last seen X min ago" tooltips on markers
- Center on group centroid or current user
- Tap marker to see traveler name + timestamp

---

### 3. Location Service (NEW)

**File**: `src/js/ui/location.js`

**Update triggers**:
1. App initialization (after auth, if sharing enabled)
2. `document.visibilitychange` → visible (tab focus)
3. `setInterval(600000)` - every 10 minutes while visible

**Flow**:
```javascript
if (locationSharingEnabled && document.visibilityState === 'visible') {
  navigator.geolocation.getCurrentPosition(
    (pos) => updateMyLocation(pos.coords),
    (err) => handleLocationError(err),
    { enableHighAccuracy: false, timeout: 10000 }
  );
}
```

**State** (localStorage):
- `locationSharingEnabled`: boolean

---

### 4. Onboarding Update

**File**: `src/js/ui/onboarding.js`

**Insert step** after welcome, before add events:

```
Welcome → Location Sharing (NEW) → Add Events → Completion
```

**Location step UI**:
```
┌─────────────────────────────────────────┐
│                  📍                     │
│                                         │
│       Share Your Location?              │
│                                         │
│  Let your travel group see where you    │
│  are during the trip.                   │
│                                         │
│  • Updates every 10 minutes             │
│  • Only while the app is open           │
│  • You can change this anytime          │
│                                         │
│  [Enable Sharing]    [Not Now]          │
└─────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `src/js/ui/travelerProfile.js` | **CREATE** | Profile modal with location toggle |
| `src/js/ui/mapView.js` | **CREATE** | Leaflet map, traveler markers |
| `src/js/ui/location.js` | **CREATE** | Geolocation service, 10-min interval |
| `src/js/ui/onboarding.js` | MODIFY | Add location sharing step |
| `src/js/ui/navigation.js` | MODIFY | Handle `map` view mode |
| `src/js/api.js` | MODIFY | Add `updateMyLocation()`, `fetchLocations()` |
| `src/js/state.js` | MODIFY | Add `locationSharingEnabled` |
| `src/js/app.js` | MODIFY | Wire `openProfileModal`, init location service |
| `src/index.html` | MODIFY | Add Leaflet CDN, map container, map view button |
| `src/css/styles.css` | MODIFY | Profile modal styles, map view styles |

---

## Dependencies

**Add to `index.html` head**:

```html
<!-- Leaflet CSS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin="" />

<!-- Leaflet JS (before app.js) -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossorigin=""></script>
```

---

## API Client Functions (to add to api.js)

```javascript
export async function updateMyLocation(tripId, travelerId, lat, lon, accuracy) {
  const accessCode = getStoredAccessCode(tripId);
  const url = `${API_BASE}/trips/${tripId}/locations/${travelerId}?tripId=${encodeURIComponent(tripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, accuracy, isSharing: true })
  });

  if (!response.ok) {
    throw new Error('Failed to update location');
  }

  return response.json();
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
```

---

## Implementation Order

1. **API functions** - Add to `api.js`
2. **Location service** - Create `location.js` with geolocation + interval logic
3. **State** - Add `locationSharingEnabled` to `state.js`
4. **Profile modal** - Create `travelerProfile.js` with location toggle
5. **Onboarding step** - Modify `onboarding.js`
6. **Map view** - Create `mapView.js` with Leaflet integration
7. **Navigation** - Update `navigation.js` for map view mode
8. **Wiring** - Update `app.js` and `index.html`
9. **Styles** - Add CSS for new components
