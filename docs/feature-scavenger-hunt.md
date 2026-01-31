# Feature: Scavenger Hunt

## Overview

Group scavenger hunts that leverage trip context for intelligent, location-aware item generation. Any traveler can create a hunt, but only one active hunt per trip at a time.

---

## Core Rules

1. **Any user can create** - Not restricted to admin/creator
2. **One at a time** - New hunt cannot start until previous ends
3. **Trip-aware AI** - Concierge uses destinations, dates, activities as context
4. **Conversational setup** - Clarifying questions before generating items

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
│  • Team or individual? (everyone competes, or teams)        │
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
│  • Optional location hint (general area)                    │
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
│  All travelers notified via activity pill                   │
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
│  ⬜ A blue door in Plaka (5 pts)                  [Mark]    │
│     💡 Hint: Look near the main square                      │
│                                                             │
│  ⬜ Souvlaki from a street vendor (10 pts)        [Mark]    │
│                                                             │
│  ⬜ Group photo at the Acropolis (20 pts)         [Mark]    │
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

### Marking Items Found

When user taps "Mark" on an item:

```
┌─────────────────────────────────────────────────────────────┐
│  📷 Mark as Found                                           │
│                                                             │
│  "A blue door in Plaka"                                     │
│                                                             │
│  ┌─────────────────────────────────────┐                    │
│  │                                     │                    │
│  │    [Tap to add photo]               │                    │
│  │                                     │                    │
│  └─────────────────────────────────────┘                    │
│  Photo proof (optional but encouraged)                      │
│                                                             │
│  Note (optional)                                            │
│  ┌─────────────────────────────────────┐                    │
│  │ Found it on the corner of...        │                    │
│  └─────────────────────────────────────┘                    │
│                                                             │
│  [Cancel]                    [Mark Found! +5 pts]           │
└─────────────────────────────────────────────────────────────┘
```

---

## Hunt States

| State | Description | UI |
|-------|-------------|-----|
| `none` | No active hunt | "Create Hunt" button enabled |
| `active` | Hunt in progress | Hunt view, "Create" disabled |
| `completed` | Hunt ended | Results view, "Create" enabled |

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
  endTime?: timestamp,  // if time_limit
  completedAt?: timestamp,
  theme?: string,
  difficulty?: 'easy' | 'medium' | 'hard'
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
  locationHint?: string,
  order: number,
  foundBy?: travelerId,
  foundAt?: timestamp,
  photoUrl?: string,
  note?: string
}
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/trips/{tripId}/hunts` | List all hunts (active + recent) |
| GET | `/api/trips/{tripId}/hunts/active` | Get current active hunt |
| POST | `/api/trips/{tripId}/hunts` | Create new hunt |
| PUT | `/api/trips/{tripId}/hunts/{huntId}` | Update hunt (end it) |
| GET | `/api/trips/{tripId}/hunts/{huntId}/items` | Get hunt items |
| POST | `/api/trips/{tripId}/hunts/{huntId}/items` | Add item |
| PUT | `/api/trips/{tripId}/hunts/{huntId}/items/{itemId}` | Mark found / edit |
| DELETE | `/api/trips/{tripId}/hunts/{huntId}/items/{itemId}` | Remove item |

---

## AI Integration

### Context Provided to Concierge

```javascript
{
  trip: {
    name, dates, currentPhase
  },
  destinations: [
    { code, name, city, country, landmarks, ... }
  ],
  currentLocation: "Athens",
  remainingDays: 5,
  scheduledActivities: [
    { title, type, where, date, ... }
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
- Hotel: near Monastiraki Square

USER REQUEST:
- Theme: Photo opportunities
- Difficulty: Medium
- Items: 12
- Scope: Athens only

Generate 12 scavenger hunt items. For each item provide:
1. description: Clear, specific thing to find/photograph
2. points: 5 (easy), 10 (medium), 15 (hard), 20 (challenging)
3. hint: Optional helpful clue
4. locationHint: General area (optional)

Mix difficulties. Include:
- 3-4 easy items (common things)
- 5-6 medium items (requires some exploration)
- 2-3 hard items (hidden gems, specific timing)

Make items relevant to Athens landmarks, Greek culture, local food,
street scenes. Reference their actual scheduled activities when possible.
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
<div class="activity-pill game">
  <span>🎯</span>
  <span>Scavenger Hunt</span>
  <span class="pill-count">3/12</span>
</div>
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/hunts/index.js` | **CREATE** | Hunt CRUD endpoints |
| `api/hunt-items/index.js` | **CREATE** | Item CRUD + mark found |
| `api/ai/index.js` | MODIFY | Add hunt generation endpoint |
| `src/js/ui/scavengerHunt.js` | **CREATE** | Hunt modal/view |
| `src/js/ui/huntSetup.js` | **CREATE** | Conversational setup wizard |
| `src/js/api.js` | MODIFY | Add hunt API functions |
| `src/js/ui/activityPills.js` | MODIFY | Show active hunt pill |
| `src/index.html` | MODIFY | Add menu item |
| `src/css/styles.css` | MODIFY | Hunt UI styles |

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
    lastUpdate: timestamp
  }
}
```

---

## Open Questions

1. **Photo verification** - Should photos be required, optional, or AI-verified?
2. **Team mode** - Support teams, or individual competition only (v1)?
3. **Rewards** - Points only, or integrate with scoreboard/trivia points?
4. **History** - Show past hunts, or just current/most recent?
5. **Notifications** - Notify when someone finds an item?

---

## Implementation Order

1. **Database** - Create tables in Azure Table Storage
2. **API endpoints** - Hunt CRUD + items
3. **AI integration** - Hunt generation with trip context
4. **Hunt setup UI** - Conversational wizard with concierge
5. **Hunt view UI** - Item list, marking, leaderboard
6. **Activity pill** - Show active hunt status
7. **Sync integration** - Real-time updates
8. **Menu integration** - Add entry point
