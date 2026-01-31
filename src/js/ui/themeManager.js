// ========================================
// THEME MANAGER
// Handles theme application with magic fade transitions
// ========================================

// ========================================
// STATE
// ========================================

let currentTheme = null;
let previewTheme_ = null;
let isTransitioning = false;

// Default theme (fallback)
const DEFAULT_THEME = {
  id: 'default',
  name: 'Default',
  palette: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#f5af19',
    background: '#f8f6f3',
    surface: '#ffffff',
    text: '#2c3e50',
    textMuted: '#6b7280'
  },
  headerGradient: ['#667eea', '#764ba2']
};

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
 * Initialize theme from stored personalization
 */
export function initTheme() {
  // Check if there's a stored personalization
  const personalization = window.tripPersonalization;

  if (personalization?.theme) {
    // Apply saved theme without animation (instant on load)
    applyTheme(personalization.theme, { animate: false });
  } else {
    // Apply default theme
    applyTheme(DEFAULT_THEME, { animate: false });
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

// ========================================
// EXPORTS
// ========================================

export {
  DEFAULT_THEME,
  currentTheme
};
