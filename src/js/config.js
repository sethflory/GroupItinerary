// ========================================
// FEATURE FLAGS & CONFIGURATION
// ========================================

export const FEATURE_FLAGS = {
  // Core features
  PHOTO_SHARING: true,
  AI_CHAT: true,
  AI_INSIGHTS: true,
  SHARE_TRIP_STATUS: true,
  WEATHER_WIDGET: true,
  COUNTDOWN_TIMER: true,
  TIMEZONE_DISPLAY: true,
  LIST_VIEW: true,

  // In development
  USER_PROFILES: false,
  GPS_PHOTO_OPS: false,

  // Database migration
  USE_TABLE_STORAGE: true,
};

export function isFeatureEnabled(featureName) {
  return FEATURE_FLAGS[featureName] === true;
}

// Apply feature visibility on load
export function applyFeatureFlags() {
  // Photo sharing
  const photosSection = document.getElementById('tripPhotosSection');
  if (photosSection) {
    photosSection.style.display = isFeatureEnabled('PHOTO_SHARING') ? 'block' : 'none';
  }

  // User profiles
  const profilesSection = document.getElementById('userProfilesSection');
  if (profilesSection) {
    profilesSection.style.display = isFeatureEnabled('USER_PROFILES') ? 'block' : 'none';
  }

  // GPS Photo Ops
  const gpsSection = document.getElementById('gpsPhotoOpsSection');
  if (gpsSection) {
    gpsSection.style.display = isFeatureEnabled('GPS_PHOTO_OPS') ? 'block' : 'none';
  }

  // AI Event Insights buttons
  document.querySelectorAll('.ai-insights-btn').forEach(btn => {
    btn.style.display = isFeatureEnabled('AI_INSIGHTS') ? 'inline-flex' : 'none';
  });

  // AI Chat
  const chatSection = document.getElementById('aiChatSection');
  if (chatSection) {
    chatSection.style.display = isFeatureEnabled('AI_CHAT') ? 'block' : 'none';
  }

  // Trip Settings button (admin only)
  const settingsBtn = document.getElementById('tripSettingsBtn');
  if (settingsBtn) {
    // Show for admin users only
    const isAdminUser = window.isAdmin && window.isAdmin();
    console.log('[Config] isAdmin check:', isAdminUser, 'session:', window.session?.getSession());
    // For now, show to all authenticated users - will add admin restriction later
    settingsBtn.style.display = 'flex';
  }
}

// Trip registry
export const TRIPS = {
  'athens-bangalore-2026': {
    id: 'athens-bangalore-2026',
    name: 'Athens & Bangalore 2026',
    subtitle: 'Our Journey',
    dates: 'February 1 - 12, 2026',
    description: 'Athens together, then S&P continue to India',
    icon: '🇬🇷',
    badge: 'production',
    photoPrefix: '',
    startDate: '2026-02-01T16:27:00-05:00',
    endDate: '2026-02-12T23:59:00-05:00',
    accessCode: 'athens2026'
  },
  'test-trip': {
    id: 'test-trip',
    name: 'Test Trip',
    subtitle: 'Development Testing',
    dates: 'Jan 1 - 3, 2025',
    description: 'For testing features without affecting real trip',
    icon: '🧪',
    badge: 'test',
    photoPrefix: 'test-',
    startDate: '2025-01-01T09:00:00-05:00',
    endDate: '2025-01-03T23:59:00-05:00',
    accessCode: 'test123'
  }
};

// API base URL
export const API_BASE = '/api';

// Photo settings
export const MAX_RIBBON_PHOTOS = 12;
export const PLACEHOLDER_COUNT = 6;

// Map settings (Mapbox Static Images API)
// Token should be a public token with URL restrictions configured in Mapbox dashboard
export const MAPBOX_TOKEN = 'pk.eyJ1IjoiZ3JvdXBpdGluZXJhcnkiLCJhIjoiY200ZXhhbXBsZSJ9.example';
export const MAP_STYLE = 'mapbox/streets-v12';
export const MAP_MARKER_COLOR = 'ff7e5f'; // Sunrise orange
