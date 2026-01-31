// ========================================
// THEME MANAGER
// Handles theme application with magic fade transitions
// ========================================

// ========================================
// CONSTANTS
// ========================================

const STORAGE_KEY = 'groupitinerary_theme';

// Valid font styles
const FONT_STYLES = ['modern', 'classic', 'playful', 'elegant', 'adventure'];

// ========================================
// THEME REGISTRY
// ========================================

const THEMES = {
  emerald: {
    id: 'emerald',
    name: 'Emerald & Gold',
    fontStyle: 'modern',
    palette: {
      primary: '#134e5e',
      secondary: '#71b280',
      accent: '#f0b429',
      background: '#f8faf9',
      surface: '#ffffff',
      text: '#1a2420',
      textMuted: '#6b7f75'
    },
    headerGradient: ['#134e5e', '#71b280']
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    fontStyle: 'modern',
    palette: {
      primary: '#1e3a5f',
      secondary: '#3a7bd5',
      accent: '#00b4d8',
      background: '#f5f9fc',
      surface: '#ffffff',
      text: '#1a2a3a',
      textMuted: '#5a7089'
    },
    headerGradient: ['#1e3a5f', '#3a7bd5']
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Coral',
    fontStyle: 'modern',
    palette: {
      primary: '#e85d4c',
      secondary: '#ff8a5b',
      accent: '#feca57',
      background: '#fef9f6',
      surface: '#ffffff',
      text: '#2d2424',
      textMuted: '#7a6565'
    },
    headerGradient: ['#e85d4c', '#ff8a5b']
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    fontStyle: 'elegant',
    palette: {
      primary: '#1a1a2e',
      secondary: '#4a4a6a',
      accent: '#e94560',
      background: '#16162a',
      surface: '#1f1f3a',
      text: '#eaeaef',
      textMuted: '#9a9ab0'
    },
    headerGradient: ['#1a1a2e', '#4a4a6a']
  }
};

// Default theme - Emerald & Gold (matches CSS variables)
const DEFAULT_THEME = THEMES.emerald;

// ========================================
// STATE
// ========================================

let currentTheme = null;
let previewTheme_ = null;
let isTransitioning = false;

// ========================================
// THEME APPLICATION
// ========================================

/**
 * Apply a theme to the app
 * @param {Object} theme - Theme object with palette
 * @param {Object} options - { animate: boolean, duration: number }
 */
export async function applyTheme(theme, options = {}) {
  const { animate = true, duration = 1200 } = options;

  if (!theme || !theme.palette) {
    console.warn('[ThemeManager] Invalid theme, using default');
    theme = DEFAULT_THEME;
  }

  if (animate && !isTransitioning) {
    isTransitioning = true;

    // Add transitioning class for smooth color changes
    document.body.classList.add('theme-transitioning');

    // Set transition duration
    document.documentElement.style.setProperty('--theme-transition-duration', `${duration}ms`);
  }

  // Apply CSS custom properties
  const root = document.documentElement;
  const palette = theme.palette;

  root.style.setProperty('--color-primary', palette.primary);
  root.style.setProperty('--color-secondary', palette.secondary);
  root.style.setProperty('--color-accent', palette.accent);
  root.style.setProperty('--color-background', palette.background);
  root.style.setProperty('--color-surface', palette.surface);
  root.style.setProperty('--color-text', palette.text);
  root.style.setProperty('--color-text-muted', palette.textMuted);

  // Apply gradient
  if (theme.headerGradient && theme.headerGradient.length >= 2) {
    root.style.setProperty('--header-gradient-start', theme.headerGradient[0]);
    root.style.setProperty('--header-gradient-end', theme.headerGradient[1]);
  }

  // Apply font style
  applyFontStyle(theme.fontStyle || 'modern');

  // Store current theme
  currentTheme = theme;

  if (animate) {
    // Wait for transition to complete
    await sleep(duration);

    // Remove transitioning class
    document.body.classList.remove('theme-transitioning');
    isTransitioning = false;
  }

  return theme;
}

/**
 * Preview a theme (quick fade, doesn't commit)
 */
export function previewTheme(theme) {
  if (!theme || !theme.palette) return;

  // Store the original theme for reverting
  if (!previewTheme_) {
    previewTheme_ = currentTheme;
  }

  // Apply with quick fade
  applyTheme(theme, { animate: true, duration: 400 });
}

/**
 * Revert from preview to the committed theme
 */
export function revertThemePreview() {
  if (previewTheme_) {
    applyTheme(previewTheme_, { animate: true, duration: 400 });
    previewTheme_ = null;
  }
}

/**
 * Get the current active theme
 */
export function getCurrentTheme() {
  return currentTheme || DEFAULT_THEME;
}

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize theme on app load
 * Priority: 1) Trip personalization, 2) localStorage, 3) Default
 */
export function initTheme() {
  // Check if there's a stored personalization from trip
  const personalization = window.tripPersonalization;

  if (personalization?.theme) {
    // Apply trip-specific theme without animation (instant on load)
    applyTheme(personalization.theme, { animate: false });
  } else {
    // Check localStorage for saved theme preference
    const savedThemeId = getSavedThemeId();
    const theme = savedThemeId ? getThemeById(savedThemeId) : DEFAULT_THEME;
    applyTheme(theme, { animate: false });
  }
}

/**
 * Load personalization from trip data
 */
export function loadPersonalizationFromTrip(trip) {
  if (!trip) return;

  // Check for personalization in trip data
  let personalization = trip.personalization;

  if (typeof personalization === 'string') {
    try {
      personalization = JSON.parse(personalization);
    } catch (e) {
      console.warn('[ThemeManager] Failed to parse personalization');
      return;
    }
  }

  if (personalization) {
    window.tripPersonalization = personalization;

    if (personalization.theme) {
      applyTheme(personalization.theme, { animate: false });
    }
  }
}

// ========================================
// HELPERS
// ========================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Apply a font style to the document body
 * @param {string} fontStyle - One of: modern, classic, playful, elegant, adventure
 */
function applyFontStyle(fontStyle) {
  // Remove all existing font style classes
  FONT_STYLES.forEach(style => {
    document.body.classList.remove(`font-style-${style}`);
  });

  // Apply the new font style if valid
  if (fontStyle && FONT_STYLES.includes(fontStyle)) {
    document.body.classList.add(`font-style-${fontStyle}`);
  } else {
    // Default to modern
    document.body.classList.add('font-style-modern');
  }
}

// ========================================
// PERSISTENCE
// ========================================

/**
 * Save theme preference to localStorage
 * @param {string} themeId - Theme ID to save
 */
function saveThemePreference(themeId) {
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch (e) {
    console.warn('[ThemeManager] Failed to save theme preference:', e);
  }
}

/**
 * Get saved theme ID from localStorage
 * @returns {string|null} Theme ID or null if not set
 */
export function getSavedThemeId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Set and apply a theme by ID, saving preference to localStorage
 * @param {string} themeId - Theme ID from THEMES registry
 * @param {Object} options - { animate: boolean, duration: number }
 */
export async function setTheme(themeId, options = {}) {
  const theme = getThemeById(themeId);
  if (!theme) {
    console.warn(`[ThemeManager] Unknown theme: ${themeId}`);
    return;
  }

  saveThemePreference(themeId);
  return applyTheme(theme, options);
}

// ========================================
// THEME REGISTRY ACCESS
// ========================================

/**
 * Get a theme by ID
 * @param {string} themeId - Theme ID
 * @returns {Object|null} Theme object or null if not found
 */
export function getThemeById(themeId) {
  return THEMES[themeId] || null;
}

/**
 * Get all available themes
 * @returns {Object} THEMES registry object
 */
export function getAllThemes() {
  return { ...THEMES };
}

/**
 * Get theme IDs as array
 * @returns {string[]} Array of theme IDs
 */
export function getThemeIds() {
  return Object.keys(THEMES);
}

// ========================================
// EXPORTS
// ========================================

export {
  DEFAULT_THEME,
  THEMES,
  currentTheme
};
