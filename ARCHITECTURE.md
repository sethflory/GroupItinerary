# Group Itinerary - Architecture Redesign

## Overview

A collaborative trip planning app where trip creators invite travelers, travelers add their itineraries via conversational AI, and trips can be shared publicly for viral growth.

---

## User Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         THREE USER TYPES                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TRIP CREATOR                                                        │
│  • Authenticates via Google OAuth                                    │
│  • Creates trips, adds travelers, assigns trip codes                 │
│  • Full admin access to trip configuration                           │
│  • Is also a traveler on their own trips                            │
│                                                                      │
│  TRAVELER                                                            │
│  • Joins via trip code (assigned by creator)                        │
│  • Lightweight registration on first access                          │
│  • Progressive profile (basic → full)                               │
│  • Can upload itinerary, add events, upload photos                  │
│  • Same person can be traveler on multiple trips                    │
│                                                                      │
│  VIEWER                                                              │
│  • Accesses via share link (no registration)                        │
│  • Read-only, limited view of trip                                  │
│  • CTA to "join" or "create your own trip"                          │
│  • Viral growth loop                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flows

```
1. TRIP CREATOR (Google OAuth)
   └─▶ Google Sign-In
       └─▶ Create/Get User record
           └─▶ Can create trips, becomes traveler+admin on created trips

2. TRAVELER (Trip Code)
   └─▶ Enter trip code
       └─▶ Validate code → Get tripId + travelerId
           └─▶ User exists?
               ├─▶ Yes: Log in, enter trip
               └─▶ No: Lightweight registration
                   └─▶ Create User → Link to TripMember → Enter trip
                       └─▶ Claude onboarding: "Add your itinerary"

3. VIEWER (Share Link)
   └─▶ /trip/{tripId}/share/{shareCode}
       └─▶ Validate share code
           └─▶ Render read-only view (no auth required)
               └─▶ CTAs: "Join this trip" | "Create your own"
```

---

## Data Model

### Core Entities

```
┌─────────────────────────────────────────────────────────────────────┐
│ Users                                                                │
├─────────────────────────────────────────────────────────────────────┤
│ PK: "users"                                                          │
│ RK: {userId}                                                         │
│                                                                      │
│ googleId?: string           # If authenticated via Google            │
│ email?: string              # Optional, enables notifications        │
│ displayName: string         # Required (lightweight reg)             │
│ avatarUrl?: string          # Profile photo                          │
│ profileLevel: 'basic'|'partial'|'full'                              │
│ createdAt: timestamp                                                 │
│ lastActiveAt: timestamp                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Trips                                                                │
├─────────────────────────────────────────────────────────────────────┤
│ PK: "trips"                                                          │
│ RK: {tripId}                                                         │
│                                                                      │
│ creatorUserId: string       # Who created this trip                  │
│ name: string                                                         │
│ subtitle?: string                                                    │
│ startDate: string                                                    │
│ endDate: string                                                      │
│ icon: string                # Emoji                                  │
│ status: 'planning'|'active'|'completed'                             │
│ shareSettings: {                                                     │
│   allowPublicView: boolean                                           │
│   publicViewLevel: 'highlights'|'itinerary'|'full'                  │
│ }                                                                    │
│ createdAt: timestamp                                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ TripMembers (Junction: Users ↔ Trips)                               │
├─────────────────────────────────────────────────────────────────────┤
│ PK: {tripId}                                                         │
│ RK: member_{userId}                                                  │
│                                                                      │
│ role: 'creator'|'admin'|'traveler'                                  │
│ tripCode: string            # Unique code for this user+trip         │
│ displayName?: string        # Override for this trip                 │
│ color: string               # UI color for this traveler             │
│ initials: string            # Badge initials                         │
│ joinedAt: timestamp                                                  │
│ onboardingComplete: boolean                                          │
│ lastViewedAt: timestamp                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ShareLinks                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ PK: {tripId}                                                         │
│ RK: share_{code}                                                     │
│                                                                      │
│ createdBy: userId                                                    │
│ viewLevel: 'highlights'|'itinerary'|'full'                          │
│ expiresAt?: timestamp                                                │
│ isActive: boolean                                                    │
│ accessCount: number         # Analytics                              │
│ createdAt: timestamp                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Trip Content Entities

```
┌─────────────────────────────────────────────────────────────────────┐
│ Days                                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ PK: {tripId}                                                         │
│ RK: day_{date}                                                       │
│                                                                      │
│ date: string                # YYYY-MM-DD                             │
│ dayNum: number                                                       │
│ label: string               # "Sun, Feb 1"                           │
│ location: string            # Airport code                           │
│ theme: string               # "Departure Day"                        │
│ destination: string                                                  │
│ destinationInfo?: string                                             │
│ estimatedSteps?: number                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Events                                                               │
├─────────────────────────────────────────────────────────────────────┤
│ PK: {tripId}_{date}                                                  │
│ RK: evt_{timestamp}_{id}                                             │
│                                                                      │
│ id: string                                                           │
│ type: 'flight'|'hotel'|'activity'|'meal'|'transport'                │
│ title: string                                                        │
│ subtitle?: string                                                    │
│ time?: string                                                        │
│ endTime?: string                                                     │
│ travelers: string[]         # ['all'] or [userId, userId]           │
│ status: 'confirmed'|'pending'                                        │
│ where?: string                                                       │
│ details?: string                                                     │
│ location?: {                                                         │
│   name: string                                                       │
│   lat: number                                                        │
│   lon: number                                                        │
│   markerId?: string         # Link to pre-configured marker          │
│ }                                                                    │
│ photoIds?: string[]         # Blob names for event carousel          │
│ addedBy?: userId                                                     │
│ source?: 'manual'|'onboarding'|'import'                             │
│ # Type-specific fields (flights, hotels, etc.)                       │
│ flightCode?: string                                                  │
│ airline?: string                                                     │
│ from?: string                                                        │
│ to?: string                                                          │
│ miles?: number                                                       │
│ confirmationCode?: string                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Destinations                                                         │
├─────────────────────────────────────────────────────────────────────┤
│ PK: {tripId}                                                         │
│ RK: dest_{code}                                                      │
│                                                                      │
│ code: string                # "ATH"                                  │
│ name: string                # "Athens International"                 │
│ city: string                                                         │
│ country: string                                                      │
│ timezone: string                                                     │
│ utcOffset: number                                                    │
│ lat: number                                                          │
│ lon: number                                                          │
│ info?: string                                                        │
│ localTip?: string                                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ LocationMarkers (Pre-configured POIs per destination)                │
├─────────────────────────────────────────────────────────────────────┤
│ PK: {tripId}_{destinationCode}                                       │
│ RK: marker_{id}                                                      │
│                                                                      │
│ name: string                                                         │
│ category: 'restaurant'|'attraction'|'hotel'|'transport'|'custom'    │
│ lat: number                                                          │
│ lon: number                                                          │
│ address?: string                                                     │
│ icon?: string                                                        │
│ addedBy?: userId                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Photos (Blob metadata in Table Storage)                              │
├─────────────────────────────────────────────────────────────────────┤
│ PK: {tripId}                                                         │
│ RK: photo_{timestamp}_{id}                                           │
│                                                                      │
│ blobName: string            # Reference to blob storage              │
│ uploadedBy: userId                                                   │
│ caption?: string                                                     │
│ eventId?: string            # Link to event (for event carousels)   │
│ dayDate?: string            # Which day this photo is for            │
│ uploadedAt: timestamp                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Module Structure (Current)
```
src/js/
├── app.js              # Entry point, dependency injection
├── config.js           # Feature flags, constants
├── state.js            # Global state
├── auth.js             # Authentication
├── api.js              # API calls
├── utils.js            # Helpers
├── data.js             # Fallback data
└── ui/
    ├── dayView.js      # Day rendering
    ├── listView.js     # List view
    ├── photos.js       # Photo ribbon
    ├── events.js       # Event CRUD
    ├── share.js        # Share modal
    ├── ai.js           # AI chat/insights
    ├── navigation.js   # Nav components
    ├── stats.js        # Stats banner
    ├── countdown.js    # Timer
    └── modals.js       # How It Works
```

### New Modules Needed
```
src/js/
├── eventBus.js         # Pub/sub for module communication
├── session.js          # Current user/traveler context
├── sync.js             # Polling infrastructure
└── ui/
    ├── onboarding.js   # Claude onboarding flow
    ├── tripSetup.js    # Trip configuration
    ├── profile.js      # User profile
    ├── locationPicker.js # Map-based location selection
    └── viewer.js       # Read-only share view
```

### Session Context
```javascript
// session.js - Always available after auth
{
  userId: string,
  tripId: string,
  travelerId: string,      // Same as userId for this trip
  role: 'creator' | 'admin' | 'traveler' | 'viewer',
  displayName: string,
  color: string,
  isAuthenticated: boolean,
  isGoogleLinked: boolean
}
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/google           # Google OAuth callback
POST   /api/auth/trip-code        # Validate trip code, return session
POST   /api/auth/register         # Lightweight registration
GET    /api/auth/session          # Get current session
POST   /api/auth/logout           # Clear session
```

### Users
```
GET    /api/users/me              # Current user profile
PUT    /api/users/me              # Update profile
POST   /api/users/me/link-google  # Link Google account
```

### Trips
```
POST   /api/trips                 # Create trip (requires Google auth)
GET    /api/trips/{tripId}        # Get trip details
PUT    /api/trips/{tripId}        # Update trip
GET    /api/trips/{tripId}/members # List travelers
POST   /api/trips/{tripId}/members # Add traveler (generates code)
DELETE /api/trips/{tripId}/members/{userId}
```

### Trip Content
```
GET    /api/trips/{tripId}/days
GET    /api/trips/{tripId}/events?date={date}
POST   /api/trips/{tripId}/events
PUT    /api/trips/{tripId}/events/{eventId}
DELETE /api/trips/{tripId}/events/{eventId}

GET    /api/trips/{tripId}/destinations
PUT    /api/trips/{tripId}/destinations/{code}

GET    /api/trips/{tripId}/markers?destination={code}
POST   /api/trips/{tripId}/markers
DELETE /api/trips/{tripId}/markers/{id}
```

### Photos
```
GET    /api/trips/{tripId}/photos
POST   /api/trips/{tripId}/photos
DELETE /api/trips/{tripId}/photos/{id}
PUT    /api/trips/{tripId}/photos/{id}/link  # Link to event
```

### Sharing
```
POST   /api/trips/{tripId}/share           # Create share link
GET    /api/trips/{tripId}/share           # List share links
DELETE /api/trips/{tripId}/share/{code}    # Revoke
GET    /api/share/{code}                   # Public: get shared view
```

### AI
```
POST   /api/ai/chat               # General chat
POST   /api/ai/onboarding         # Itinerary parsing with actions
POST   /api/ai/insights           # Event insights
POST   /api/ai/trivia             # Generate trivia question
```

---

## Implementation Phases

### Phase 1: Identity Foundation
- [ ] Users table + API
- [ ] TripMembers table + API
- [ ] Google OAuth integration (Azure Easy Auth)
- [ ] Trip code validation → session
- [ ] Lightweight registration modal
- [ ] Session context in frontend

### Phase 2: Trip Setup
- [ ] Trip creation flow (for Google-authed users)
- [ ] Add travelers UI (generates codes)
- [ ] Destinations management
- [ ] Location markers (POIs) per destination

### Phase 3: Lightweight Traveler Onboarding
- [ ] Trip code entry → registration flow
- [ ] Basic profile capture (name, optional email)
- [ ] Welcome screen with trip overview
- [ ] Manual "Add my flights/hotels" form
- [ ] Mark traveler on existing events
- [ ] Onboarding completion tracking

### Phase 4: Photo-Event Integration
- [ ] Link photos to events
- [ ] Event carousels from linked photos
- [ ] Create event from photo
- [ ] Photo attribution (uploadedBy)

### Phase 5: Sharing & Viral Loop
- [ ] Share link generation
- [ ] Read-only viewer component
- [ ] Share analytics
- [ ] "Join trip" / "Create trip" CTAs

### Phase 6: Real-time Features
- [ ] Event bus implementation
- [ ] Sync/polling infrastructure
- [ ] Trivia system
- [ ] Location sharing

### Phase 7: AI-Powered Onboarding
- [ ] Claude conversational onboarding
- [ ] Paste/upload itinerary → AI parsing
- [ ] Action parsing from AI responses
- [ ] Auto-match to existing events
- [ ] Smart conflict resolution
- [ ] "Add for everyone" vs "Add just for me"

---

## UI Polish Backlog
- [ ] Move event count to day header row, shorter header
- [ ] Photo ribbon: always show "add" slot, rename button to "Hide Photos"
- [ ] Fix photo count off-by-one
- [ ] Photo hover expand for portrait images
- [ ] Carousel toggle: Photos / News / Both

---

## Design Decisions

1. **Trip codes are per-user-per-trip** - Same user can have different codes for different trips
2. **Google auth only for creators** - Travelers use lightweight registration
3. **Claude handles itinerary parsing** - Conversational, not form-based
4. **Photos and Events are linked** - Many-to-many via photoIds[] and eventId
5. **Location markers are trip-scoped** - Pre-configured per destination during setup
6. **Share links are configurable** - Creator controls what viewers see
7. **Progressive profiles** - Start basic, prompt for more over time
