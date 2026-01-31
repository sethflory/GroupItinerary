# Feature: Scavenger Hunt

## Overview

Group scavenger hunts that leverage trip context for intelligent, location-aware item generation. Any traveler can create a hunt, but only one active hunt per trip at a time.

---

## Core Rules

1. **Any user can create** - Not restricted to admin/creator
2. **One at a time** - New hunt cannot start until previous ends
3. **Trip-aware AI** - Concierge uses destinations, dates, activities as context
4. **Conversational setup** - Clarifying questions before generating items
5. **Individual competition** - No teams (v1)
6. **Photo optional** - Can claim items without photo proof
7. **Points merge** - Accumulate during hunt, add to scoreboard when hunt ends

---

## User Flow

### Creating a Hunt

```
┌─────────────────────────────────────────────────────────────┐
│  1. USER INITIATES                                          │
│     Menu → "Scavenger Hunt" → "Create New Hunt"             │
│     (disabled if hunt already active)                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. CONCIERGE CONVERSATION                                  │
│                                                             │
│  🔑 "I'd love to help create a scavenger hunt for your     │
│      trip! A few questions first..."                        │
│                                                             │
│  Clarifying questions:                                      │
│  • What's the theme? (food, culture, photo ops, landmarks)  │
│  • How challenging? (easy/medium/hard)                      │
│  • How many items? (5-20)                                   │
│  • Which days/locations? (all, specific phase, today only)  │
│  • Any specific items you want included?                    │
│                                                             │
│  User can answer conversationally or skip to defaults       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. AI GENERATES HUNT                                       │
│                                                             │
│  Based on:                                                  │
│  • Trip destinations (Athens landmarks, Bangalore sites)    │
│  • Scheduled activities (restaurants, tours, hotels)        │
│  • Current trip phase and remaining days                    │
│  • User's theme/difficulty preferences                      │
│                                                             │
│  Output: List of 10-15 items with:                          │
│  • Description ("Find a blue door in Plaka")                │
│  • Points value (based on difficulty)                       │
│  • Optional hint                                            │
│  • Optional location/coordinates (for map display)          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  4. USER REVIEWS & EDITS                                    │
│                                                             │
│  • Preview generated items                                  │
│  • Edit/delete any item                                     │
│  • Add custom items manually                                │
│  • Reorder items                                            │
│  • Set hunt end condition (all found, time limit, manual)   │
│  • Set hunt title/description                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  5. LAUNCH HUNT                                             │
│                                                             │
│  "Start Scavenger Hunt" → Hunt goes live                    │
│  All travelers notified via notification ticker             │
└─────────────────────────────────────────────────────────────┘
```

### Participating in a Hunt

```
┌─────────────────────────────────────────────────────────────┐
│  HUNT VIEW (for participants)                               │
│                                                             │
│  🎯 Athens Photo Safari                                     │
│  Created by Sarah • 12 items • 3 found                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                        │
│                                                             │
│  ☑️ A cat sleeping on ancient ruins (15 pts)      [📷]     │
│     Found by Mike • 2:34 PM                                 │
│                                                             │
│  ☑️ Street art with Greek mythology (10 pts)      [📷]     │
│     Found by Sarah • 11:15 AM                               │
│                                                             │
│  ⬜ A blue door in Plaka (5 pts)                  [Claim]   │
│     💡 Hint: Look near the main square                      │
│                                                             │
│  ⬜ Souvlaki from a street vendor (10 pts)        [Claim]   │
│                                                             │
│  ⬜ Group photo at the Acropolis (20 pts)         [Claim]   │
│                                                             │
│  ... more items ...                                         │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  LEADERBOARD                                                │
│  1. Sarah - 25 pts (2 items)                                │
│  2. Mike - 15 pts (1 item)                                  │
│  3. John - 0 pts                                            │
│                                                             │
│  [End Hunt] (creator only)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Claiming Items

When user taps "Claim" on an item:

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 Claim Item                                              │
│                                                             │
│  "A blue door in Plaka"                                     │
│                                                             │
│  ┌─────────────────────────────────────┐                    │
│  │                                     │                    │
│  │    [Tap to add photo] (optional)    │                    │
│  │                                     │                    │
│  └─────────────────────────────────────┘                    │
│  Add a photo to share with the group                        │
│                                                             │
│  Note (optional)                                            │
│  ┌─────────────────────────────────────┐                    │
│  │ Found it on the corner of...        │                    │
│  └─────────────────────────────────────┘                    │
│                                                             │
│  [Cancel]                       [Claim! +5 pts]             │
└─────────────────────────────────────────────────────────────┘
```

---

## Notification Ticker

**New UI component** - Horizontal ticker/banner for real-time notifications.

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 Mike found "Cat on ruins" (+15 pts) • Sarah started a hunt │
└─────────────────────────────────────────────────────────────┘
```

**Placement**: Below context bar, above activity pills (or integrated with activity pills area)

**Behavior**:
- Auto-scrolls if multiple notifications
- Fades out after ~5 seconds
- Tapping opens relevant modal (hunt, trivia, etc.)
- Shows notifications for:
  - Hunt started
  - Item claimed (by others)
  - Hunt ended
  - Trivia round starting
  - Dinner poll results
  - Other group activities

---

## Archived Hunt View (Map)

When viewing a completed hunt, show an interactive map:

```
┌─────────────────────────────────────────────────────────────┐
│  🏆 Athens Photo Safari - COMPLETED                         │
│  12 items • 8 found • 3 days                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │              [LEAFLET MAP]                          │    │
│  │                                                     │    │
│  │    📍 Cat ruins                                     │    │
│  │         (Mike)           📍 Blue door               │    │
│  │                              (Sarah)                │    │
│  │                                     📍 Acropolis    │    │
│  │        📍 Street art                   (unclaimed)  │    │
│  │            (Sarah)                                  │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Hover/tap marker → photo + claimer + timestamp             │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  FINAL SCORES                                               │
│  🥇 Sarah - 45 pts (4 items)                                │
│  🥈 Mike - 30 pts (2 items)                                 │
│  🥉 John - 15 pts (1 item)                                  │
│     Lisa - 10 pts (1 item)                                  │
│                                                             │
│  Points added to scoreboard ✓                               │
└─────────────────────────────────────────────────────────────┘
```

**Map markers**:
- 🟢 Green = claimed (with photo)
- 🔵 Blue = claimed (no photo)
- ⚪ Gray = unclaimed
- Marker shows item icon or number

**Hover/tap popup**:
```
┌──────────────────────┐
│ [Photo thumbnail]    │
│ "Cat on ruins"       │
│ Found by Mike        │
│ Day 2 • 2:34 PM      │
│ +15 pts              │
└──────────────────────┘
```

---

## Hunt States

| State | Description | UI |
|-------|-------------|-----|
| `none` | No active hunt | "Create Hunt" button enabled |
| `active` | Hunt in progress | Hunt list view, "Create" disabled |
| `completed` | Hunt ended | Archived map view, "Create" enabled |

---

## Scoreboard Integration

When a hunt ends:

1. Calculate final scores per traveler
2. Add points to main scoreboard (same pool as trivia)
3. Show "Points added to scoreboard ✓" confirmation
4. Hunt moves to archived state

---

## Data Model

### ScavengerHunt (Table: `SCAVENGER_HUNTS`)

```
PK: tripId
RK: hunt_{timestamp}_{id}

{
  id: string,
  tripId: string,
  title: string,
  description: string,
  createdBy: travelerId,
  createdAt: timestamp,
  status: 'active' | 'completed',
  endCondition: 'all_found' | 'manual' | 'time_limit',
  endTime?: timestamp,
  completedAt?: timestamp,
  theme?: string,
  difficulty?: 'easy' | 'medium' | 'hard',
  finalScores?: { [travelerId]: number }  // set on completion
}
```

### ScavengerHuntItem (Table: `SCAVENGER_HUNT_ITEMS`)

```
PK: {tripId}_{huntId}
RK: item_{order}_{id}

{
  id: string,
  huntId: string,
  description: string,
  points: number,
  hint?: string,
  lat?: number,       // for map display
  lon?: number,
  locationHint?: string,
  order: number,
  foundBy?: travelerId,
  foundAt?: timestamp,
  photoUrl?: string,
  note?: string
}
```

### Notifications (Table: `NOTIFICATIONS`)

```
PK: tripId
RK: notif_{timestamp}_{id}

{
  id: string,
  tripId: string,
  type: 'hunt_started' | 'hunt_item_claimed' | 'hunt_ended' | 'trivia_starting' | 'poll_result' | ...,
  message: string,
  icon?: string,
  travelerId?: string,  // who triggered
  relatedId?: string,   // huntId, triviaId, etc.
  createdAt: timestamp,
  expiresAt?: timestamp
}
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/trips/{tripId}/hunts` | List all hunts (active + archived) |
| GET | `/api/trips/{tripId}/hunts/active` | Get current active hunt |
| POST | `/api/trips/{tripId}/hunts` | Create new hunt |
| PUT | `/api/trips/{tripId}/hunts/{huntId}` | Update hunt (end it) |
| GET | `/api/trips/{tripId}/hunts/{huntId}/items` | Get hunt items |
| POST | `/api/trips/{tripId}/hunts/{huntId}/items` | Add item |
| PUT | `/api/trips/{tripId}/hunts/{huntId}/items/{itemId}` | Claim / edit |
| DELETE | `/api/trips/{tripId}/hunts/{huntId}/items/{itemId}` | Remove item |
| GET | `/api/trips/{tripId}/notifications` | Get recent notifications |

---

## AI Integration

### Context Provided to Concierge

```javascript
{
  trip: {
    name, dates, currentPhase
  },
  destinations: [
    { code, name, city, country, lat, lon, landmarks, ... }
  ],
  currentLocation: "Athens",
  remainingDays: 5,
  scheduledActivities: [
    { title, type, where, date, lat, lon, ... }
  ],
  travelers: [
    { name, ... }
  ],
  userPreferences: {
    theme: "photo ops",
    difficulty: "medium",
    itemCount: 12,
    scope: "Athens only"
  }
}
```

### Sample AI Prompt

```
You are creating a scavenger hunt for a group trip.

TRIP CONTEXT:
- Currently in Athens, Greece (3 days remaining)
- 6 travelers
- Scheduled: Acropolis tour tomorrow, dinner at Plaka tonight
- Hotel: near Monastiraki Square (37.9762° N, 23.7258° E)

USER REQUEST:
- Theme: Photo opportunities
- Difficulty: Medium
- Items: 12
- Scope: Athens only

Generate 12 scavenger hunt items as JSON array. For each item:
{
  "description": "Clear, specific thing to find/photograph",
  "points": 5|10|15|20,  // based on difficulty
  "hint": "Optional helpful clue",
  "lat": 37.xxxx,  // approximate location if known
  "lon": 23.xxxx
}

Mix difficulties:
- 3-4 easy items (5 pts) - common things
- 5-6 medium items (10 pts) - requires exploration
- 2-3 hard items (15-20 pts) - hidden gems, timing

Make items relevant to Athens landmarks, Greek culture, local food.
Reference their scheduled activities when possible.
Include coordinates when you know specific locations.
```

---

## Menu Integration

**Add to Group Features section** in menu (`index.html`):

```html
<button class="menu-item" onclick="openScavengerHunt()">
  <span class="material-symbols-outlined">search</span>
  <span class="menu-item-label">Scavenger Hunt</span>
  <span class="hunt-status-badge" id="huntStatusBadge"></span>
  <span class="material-symbols-outlined menu-item-arrow">chevron_right</span>
</button>
```

**Activity pill** when hunt is active:

```html
<div class="activity-pill game" onclick="openScavengerHunt()">
  <span>🎯</span>
  <span>Scavenger Hunt</span>
  <span class="pill-count">3/12</span>
</div>
```

---

## Sync Integration

Add to `/sync` response:

```javascript
{
  // ... existing fields ...
  scavengerHunt: {
    id: string,
    status: 'active' | null,
    title: string,
    itemsFound: number,
    itemsTotal: number,
    lastClaimBy: travelerId,
    lastClaimItem: string,
    lastUpdate: timestamp
  },
  notifications: [
    { id, type, message, icon, createdAt }
  ]
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/hunts/index.js` | **CREATE** | Hunt CRUD endpoints |
| `api/hunt-items/index.js` | **CREATE** | Item CRUD + claim |
| `api/notifications/index.js` | **CREATE** | Notification endpoints |
| `api/ai/index.js` | MODIFY | Add hunt generation |
| `api/sync/index.js` | MODIFY | Include hunt + notifications |
| `src/js/ui/scavengerHunt.js` | **CREATE** | Hunt modal/views |
| `src/js/ui/huntSetup.js` | **CREATE** | Conversational setup |
| `src/js/ui/huntMap.js` | **CREATE** | Archived hunt map view |
| `src/js/ui/notifications.js` | **CREATE** | Notification ticker |
| `src/js/api.js` | MODIFY | Add hunt + notification APIs |
| `src/js/ui/activityPills.js` | MODIFY | Show active hunt pill |
| `src/index.html` | MODIFY | Menu item, notification ticker |
| `src/css/styles.css` | MODIFY | Hunt + notification styles |

---

## Implementation Order

1. **Notification system** - Table, API, ticker UI (reusable for all features)
2. **Database** - Hunt tables in Azure Table Storage
3. **API endpoints** - Hunt CRUD + items + claim
4. **AI integration** - Hunt generation with trip context
5. **Hunt setup UI** - Conversational wizard with concierge
6. **Hunt list UI** - Active hunt view with claim functionality
7. **Archived map UI** - Leaflet map with markers + popups
8. **Scoreboard integration** - Points merge on hunt end
9. **Activity pill** - Show active hunt status
10. **Sync integration** - Real-time updates
