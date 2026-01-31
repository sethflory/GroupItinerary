// ========================================
// AI ASSIST - Trip Personalization
// ========================================

import { currentTripId } from '../state.js';
import { API_BASE } from '../config.js';
import { getStoredAccessCode } from '../auth.js';
import { applyTheme, previewTheme, revertThemePreview } from './themeManager.js';

// ========================================
// STATE
// ========================================

let isPersonalizing = false;
let currentPersonalization = null;
let loaderMessages = [
  "Reading your itinerary...",
  "Crafting your journey's narrative...",
  "Finding the perfect images...",
  "Analyzing colors...",
  "Choosing your theme...",
  "Adding finishing touches..."
];
let currentMessageIndex = 0;
let messageInterval = null;

// ========================================
// API
// ========================================

async function callPersonalizeApi(mode = 'auto') {
  const accessCode = getStoredAccessCode(currentTripId);
  const url = `${API_BASE}/personalize?tripId=${encodeURIComponent(currentTripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripId: currentTripId,
      accessCode,
      mode
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[AI Assist] API error response:', response.status, text.slice(0, 500));
    let error;
    try {
      error = JSON.parse(text);
    } catch (e) {
      throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
    }
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Call a specific personalization endpoint
 */
async function callPersonalizeEndpoint(endpoint) {
  const accessCode = getStoredAccessCode(currentTripId);
  const url = `${API_BASE}/personalize/${endpoint}?tripId=${encodeURIComponent(currentTripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId: currentTripId, accessCode })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[AI Assist] ${endpoint} error:`, response.status, text.slice(0, 500));
    let error;
    try {
      error = JSON.parse(text);
    } catch (e) {
      throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
    }
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// ========================================
// MODULAR PERSONALIZATION
// ========================================

/**
 * Generate just day nicknames
 */
export async function generateNicknames() {
  if (isPersonalizing) return;

  isPersonalizing = true;
  showSimpleLoader('Naming your days...');

  try {
    const result = await callPersonalizeEndpoint('nicknames');

    hidePersonalizationLoader();

    if (result.nicknames) {
      // Update global personalization
      if (!window.tripPersonalization) {
        window.tripPersonalization = {};
      }
      window.tripPersonalization.dayNicknames = result.nicknames;

      // Refresh the view
      if (window.renderDayDetail) {
        window.renderDayDetail();
      }

      showSuccessToast(`Named ${Object.keys(result.nicknames).length} days!`);
    }

    return result;

  } catch (err) {
    console.error('[AI Assist] Nicknames error:', err);
    hidePersonalizationLoader();
    showErrorToast(err.message || 'Failed to generate nicknames');
    throw err;
  } finally {
    isPersonalizing = false;
  }
}

// ========================================
// MAIN FLOW
// ========================================

/**
 * Run AI Assist personalization
 * @param {string} mode - 'auto' (I trust you, go) or 'review' (let me review)
 */
export async function runAiAssist(mode = 'auto') {
  if (isPersonalizing) return;

  isPersonalizing = true;
  showPersonalizationLoader();

  try {
    // Call the personalization API
    const result = await callPersonalizeApi(mode);

    if (!result.personalization) {
      throw new Error('No personalization returned');
    }

    currentPersonalization = result.personalization;

    // Hide loader
    hidePersonalizationLoader();

    if (mode === 'auto') {
      // "I Trust You, Go" - apply theme immediately with magic fade
      await applyRecommendedTheme(currentPersonalization);

      // Show success toast
      showThemeToast(currentPersonalization.theme);

      // Close the AI Assist modal if open
      closeAiAssistModal();

      // Refresh the day view to show new nicknames
      if (window.renderDayDetail) {
        window.renderDayDetail();
      }
    } else {
      // "Let Me Review" - show review UI
      showReviewModal(currentPersonalization);
    }

  } catch (err) {
    console.error('[AI Assist] Error:', err);
    hidePersonalizationLoader();
    showErrorToast(err.message || 'Personalization failed. Please try again.');
  } finally {
    isPersonalizing = false;
  }
}

/**
 * Apply the recommended theme with a magic fade
 */
async function applyRecommendedTheme(personalization) {
  const theme = personalization.theme;
  if (!theme) return;

  // Store personalization globally for day view to use
  window.tripPersonalization = personalization;

  // Apply theme with fade animation
  await applyTheme(theme, { animate: true, duration: 1200 });
}

// ========================================
// LOADER UI
// ========================================

function showPersonalizationLoader() {
  // Remove existing loader if any
  hidePersonalizationLoader();

  const loader = document.createElement('div');
  loader.id = 'aiAssistLoader';
  loader.className = 'ai-assist-loader';
  loader.innerHTML = `
    <div class="ai-assist-loader-content">
      <div class="ai-assist-loader-spinner">
        <span class="material-symbols-outlined spinning">auto_awesome</span>
      </div>
      <div class="ai-assist-loader-title">✨ Personalizing Your Trip</div>
      <div class="ai-assist-loader-message" id="aiAssistLoaderMessage">
        ${loaderMessages[0]}
      </div>
      <div class="ai-assist-loader-progress">
        <div class="ai-assist-loader-progress-bar" id="aiAssistProgressBar"></div>
      </div>
    </div>
  `;

  document.body.appendChild(loader);

  // Animate in
  requestAnimationFrame(() => {
    loader.classList.add('visible');
  });

  // Cycle through messages
  currentMessageIndex = 0;
  updateLoaderProgress();

  messageInterval = setInterval(() => {
    currentMessageIndex++;
    if (currentMessageIndex < loaderMessages.length) {
      updateLoaderMessage(loaderMessages[currentMessageIndex]);
      updateLoaderProgress();
    }
  }, 2500);
}

function updateLoaderMessage(message) {
  const el = document.getElementById('aiAssistLoaderMessage');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = message;
      el.style.opacity = '1';
    }, 200);
  }
}

function updateLoaderProgress() {
  const bar = document.getElementById('aiAssistProgressBar');
  if (bar) {
    const progress = ((currentMessageIndex + 1) / loaderMessages.length) * 100;
    bar.style.width = `${progress}%`;
  }
}

function hidePersonalizationLoader() {
  if (messageInterval) {
    clearInterval(messageInterval);
    messageInterval = null;
  }

  const loader = document.getElementById('aiAssistLoader');
  if (loader) {
    loader.classList.remove('visible');
    setTimeout(() => loader.remove(), 300);
  }
}

/**
 * Show a simple loader with custom message
 */
function showSimpleLoader(message) {
  hidePersonalizationLoader();

  const loader = document.createElement('div');
  loader.id = 'aiAssistLoader';
  loader.className = 'ai-assist-loader';
  loader.innerHTML = `
    <div class="ai-assist-loader-content">
      <div class="ai-assist-loader-spinner">
        <span class="material-symbols-outlined spinning">auto_awesome</span>
      </div>
      <div class="ai-assist-loader-message">${message}</div>
    </div>
  `;

  document.body.appendChild(loader);
  requestAnimationFrame(() => loader.classList.add('visible'));
}

/**
 * Show a success toast
 */
function showSuccessToast(message) {
  const toast = document.createElement('div');
  toast.className = 'ai-toast ai-toast-success';
  toast.innerHTML = `
    <span class="material-symbols-outlined">check_circle</span>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================================
// AI ASSIST MODAL
// ========================================

export function openAiAssistModal() {
  let modal = document.getElementById('aiAssistModal');
  if (!modal) {
    createAiAssistModal();
    modal = document.getElementById('aiAssistModal');
  }

  // Check if already personalized
  const hasPersonalization = window.tripPersonalization?.theme;

  renderAiAssistContent(hasPersonalization);
  modal.classList.add('active');
}

export function closeAiAssistModal() {
  const modal = document.getElementById('aiAssistModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createAiAssistModal() {
  const modal = document.createElement('div');
  modal.id = 'aiAssistModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal ai-assist-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">auto_awesome</span> AI Assist</h3>
        <button class="modal-close" onclick="closeAiAssistModal()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body" id="aiAssistBody">
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAiAssistModal();
  });
}

function renderAiAssistContent(hasPersonalization) {
  const body = document.getElementById('aiAssistBody');
  if (!body) return;

  if (hasPersonalization) {
    // Already personalized - show current theme with option to change
    const theme = window.tripPersonalization.theme;
    body.innerHTML = `
      <div class="ai-assist-current">
        <div class="ai-assist-current-theme">
          <span class="theme-emoji">${theme.emoji || '✨'}</span>
          <div class="theme-info">
            <div class="theme-name">${theme.name}</div>
            <div class="theme-description">${theme.description}</div>
          </div>
        </div>
        <div class="theme-palette-preview">
          ${Object.values(theme.palette).slice(0, 6).map(color =>
            `<span class="theme-swatch" style="background: ${color}"></span>`
          ).join('')}
        </div>
      </div>

      <div class="ai-assist-actions">
        <button class="btn secondary" onclick="openThemeSelector()">
          <span class="material-symbols-outlined">palette</span>
          Change Theme
        </button>
        <button class="btn secondary" onclick="runAiAssist('auto')">
          <span class="material-symbols-outlined">refresh</span>
          Regenerate
        </button>
      </div>
    `;
  } else {
    // Not yet personalized - show modular options
    body.innerHTML = `
      <div class="ai-assist-intro">
        <p class="ai-intro-text">Choose what to personalize:</p>
      </div>

      <div class="ai-assist-options">
        <button class="ai-option-btn" onclick="generateNicknames()">
          <span class="material-symbols-outlined">auto_stories</span>
          <div class="ai-option-info">
            <span class="ai-option-title">Day Nicknames</span>
            <span class="ai-option-desc">Creative chapter titles for each day</span>
          </div>
          <span class="material-symbols-outlined ai-option-arrow">chevron_right</span>
        </button>

        <button class="ai-option-btn" onclick="generateBackgrounds()" disabled>
          <span class="material-symbols-outlined">image</span>
          <div class="ai-option-info">
            <span class="ai-option-title">Day Backgrounds</span>
            <span class="ai-option-desc">Beautiful images for each day</span>
          </div>
          <span class="ai-option-badge">Coming Soon</span>
        </button>

        <button class="ai-option-btn" onclick="generateEventCards()" disabled>
          <span class="material-symbols-outlined">view_carousel</span>
          <div class="ai-option-info">
            <span class="ai-option-title">Event Cards</span>
            <span class="ai-option-desc">Hero images, carousels & more</span>
          </div>
          <span class="ai-option-badge">Coming Soon</span>
        </button>

        <button class="ai-option-btn" onclick="generateTheme()" disabled>
          <span class="material-symbols-outlined">palette</span>
          <div class="ai-option-info">
            <span class="ai-option-title">Color Theme</span>
            <span class="ai-option-desc">Colors that match your trip</span>
          </div>
          <span class="ai-option-badge">Coming Soon</span>
        </button>
      </div>

      <div class="ai-assist-divider">
        <span>or do it all at once</span>
      </div>

      <div class="ai-assist-buttons">
        <button class="btn secondary" onclick="runAiAssist('auto')" disabled title="Fix in progress">
          <span class="material-symbols-outlined">bolt</span>
          Full Personalization
        </button>
        <p class="btn-subtitle">Preview and adjust before applying</p>
      </div>

      <button class="btn text" onclick="closeAiAssistModal()">
        Skip for now
      </button>
    `;
  }
}

// ========================================
// REVIEW MODAL (for "Let Me Review" flow)
// ========================================

function showReviewModal(personalization) {
  const modal = document.getElementById('aiAssistModal');
  const body = document.getElementById('aiAssistBody');
  if (!body) return;

  const dayNicknames = personalization.dayNicknames || {};
  const themeOptions = personalization.themeOptions || [];
  const selectedThemeId = personalization.selectedTheme;

  body.innerHTML = `
    <div class="ai-assist-review">
      <h4>Day Nicknames</h4>
      <div class="day-nicknames-list">
        ${Object.entries(dayNicknames).map(([dayNum, nickname]) => `
          <div class="day-nickname-item">
            <span class="day-num">Day ${dayNum}</span>
            <input type="text" class="nickname-input" data-day="${dayNum}" value="${escapeHtml(nickname)}" maxlength="50">
          </div>
        `).join('')}
      </div>

      <h4>Choose Theme</h4>
      <div class="theme-options-grid">
        ${themeOptions.map(theme => `
          <button class="theme-option ${theme.id === selectedThemeId ? 'selected' : ''}"
                  data-theme-id="${theme.id}"
                  onmouseenter="previewThemeById('${theme.id}')"
                  onmouseleave="revertThemePreview()"
                  onclick="selectReviewTheme('${theme.id}')">
            <div class="theme-option-header">
              <span class="theme-emoji">${theme.emoji}</span>
              <span class="theme-name">${theme.name}</span>
              ${theme.recommended ? '<span class="theme-badge">Recommended</span>' : ''}
            </div>
            <div class="theme-palette">
              ${Object.values(theme.palette).slice(0, 5).map(color =>
                `<span class="theme-swatch" style="background: ${color}"></span>`
              ).join('')}
            </div>
            <p class="theme-description">${theme.description}</p>
          </button>
        `).join('')}
      </div>

      <div class="review-actions">
        <button class="btn secondary" onclick="closeAiAssistModal()">Cancel</button>
        <button class="btn primary" onclick="applyReviewedPersonalization()">
          <span class="material-symbols-outlined">check</span>
          Apply
        </button>
      </div>
    </div>
  `;

  // Store theme options for preview
  window._tempThemeOptions = themeOptions;
}

export function selectReviewTheme(themeId) {
  // Update UI
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.themeId === themeId);
  });

  // Update selection
  if (currentPersonalization) {
    currentPersonalization.selectedTheme = themeId;
    const theme = currentPersonalization.themeOptions.find(t => t.id === themeId);
    if (theme) {
      currentPersonalization.theme = theme;
    }
  }
}

export function previewThemeById(themeId) {
  const theme = window._tempThemeOptions?.find(t => t.id === themeId);
  if (theme) {
    previewTheme(theme);
  }
}

export async function applyReviewedPersonalization() {
  if (!currentPersonalization) return;

  // Gather edited nicknames
  const nicknameInputs = document.querySelectorAll('.nickname-input');
  nicknameInputs.forEach(input => {
    const dayNum = input.dataset.day;
    currentPersonalization.dayNicknames[dayNum] = input.value.trim();
  });

  // Store globally
  window.tripPersonalization = currentPersonalization;

  // Close modal
  closeAiAssistModal();

  // Apply theme with fade
  await applyTheme(currentPersonalization.theme, { animate: true, duration: 1200 });

  // Show toast
  showThemeToast(currentPersonalization.theme);

  // Refresh day view
  if (window.renderDayDetail) {
    window.renderDayDetail();
  }
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================

function showThemeToast(theme) {
  // Remove existing toast
  const existing = document.querySelector('.theme-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'theme-toast';
  toast.innerHTML = `
    <div class="theme-toast-content">
      <span class="theme-toast-icon">✨</span>
      <span class="theme-toast-text">
        <strong>${theme.name}</strong> applied
      </span>
      <button class="theme-toast-change" onclick="showPersonalizationSummary()">
        See Details
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 8000);
}

/**
 * Show a summary of what AI Assist generated
 */
export function showPersonalizationSummary() {
  const personalization = window.tripPersonalization;
  if (!personalization) {
    alert('No personalization data found');
    return;
  }

  const nicknames = personalization.dayNicknames || {};
  const theme = personalization.theme || {};
  const backgrounds = personalization.dayBackgrounds || {};
  const imagesCount = Object.values(backgrounds).filter(bg => bg?.url).length;

  let modal = document.getElementById('personalizationSummaryModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'personalizationSummaryModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePersonalizationSummary();
    });
  }

  modal.innerHTML = `
    <div class="modal personalization-summary-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">auto_awesome</span> AI Assist Summary</h3>
        <button class="modal-close" onclick="closePersonalizationSummary()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="summary-section">
          <h4>Theme Applied</h4>
          <div class="summary-theme">
            <span class="theme-emoji">${theme.emoji || '🎨'}</span>
            <div class="theme-details">
              <strong>${theme.name || 'Unknown'}</strong>
              <p>${theme.description || ''}</p>
            </div>
          </div>
          <div class="theme-palette-preview">
            ${theme.palette ? Object.entries(theme.palette).map(([name, color]) =>
              `<div class="palette-item">
                <span class="theme-swatch" style="background: ${color}"></span>
                <span class="palette-name">${name}</span>
              </div>`
            ).join('') : ''}
          </div>
        </div>

        <div class="summary-section">
          <h4>Day Nicknames (${Object.keys(nicknames).length} days)</h4>
          <div class="nicknames-list">
            ${Object.entries(nicknames).map(([dayNum, nickname]) =>
              `<div class="nickname-item">
                <span class="day-badge">Day ${dayNum}</span>
                <span class="nickname-text">${escapeHtml(nickname)}</span>
              </div>`
            ).join('')}
          </div>
        </div>

        <div class="summary-section">
          <h4>Background Images</h4>
          <p>${imagesCount > 0 ? `${imagesCount} custom images loaded` : 'No images loaded (Unsplash not configured)'}</p>
          ${imagesCount === 0 ? '<p class="hint">Add UNSPLASH_ACCESS_KEY to enable background images</p>' : ''}
        </div>

        <div class="summary-section">
          <h4>Narrative Arc</h4>
          <p>${personalization.narrativeArc?.theme || 'Not available'}</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn secondary" onclick="openThemeSelector()">Change Theme</button>
        <button class="btn primary" onclick="closePersonalizationSummary()">Done</button>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

export function closePersonalizationSummary() {
  const modal = document.getElementById('personalizationSummaryModal');
  if (modal) modal.classList.remove('active');
}

window.showPersonalizationSummary = showPersonalizationSummary;
window.closePersonalizationSummary = closePersonalizationSummary;
window.generateNicknames = generateNicknames;

function showErrorToast(message) {
  const existing = document.querySelector('.error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.innerHTML = `
    <div class="error-toast-content">
      <span class="material-symbols-outlined">error</span>
      <span>${escapeHtml(message)}</span>
      <button onclick="this.parentElement.parentElement.remove()">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ========================================
// THEME SELECTOR (standalone)
// ========================================

export function openThemeSelector() {
  const personalization = window.tripPersonalization;
  if (!personalization?.themeOptions) {
    alert('No themes available. Run AI Assist first.');
    return;
  }

  closeAiAssistModal();

  let modal = document.getElementById('themeSelectorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'themeSelectorModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeThemeSelector();
    });
  }

  const themeOptions = personalization.themeOptions;
  const selectedThemeId = personalization.selectedTheme;

  modal.innerHTML = `
    <div class="modal theme-selector-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">palette</span> Choose Theme</h3>
        <button class="modal-close" onclick="closeThemeSelector()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="theme-options-grid">
          ${themeOptions.map(theme => `
            <button class="theme-option ${theme.id === selectedThemeId ? 'selected' : ''}"
                    data-theme-id="${theme.id}"
                    onmouseenter="previewThemeFromSelector('${theme.id}')"
                    onmouseleave="revertThemePreview()"
                    onclick="selectThemeFromSelector('${theme.id}')">
              <div class="theme-option-header">
                <span class="theme-emoji">${theme.emoji}</span>
                <span class="theme-name">${theme.name}</span>
                ${theme.recommended ? '<span class="theme-badge">Recommended</span>' : ''}
              </div>
              <div class="theme-palette">
                ${Object.values(theme.palette).slice(0, 5).map(color =>
                  `<span class="theme-swatch" style="background: ${color}"></span>`
                ).join('')}
              </div>
              <p class="theme-description">${theme.description}</p>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

export function closeThemeSelector() {
  const modal = document.getElementById('themeSelectorModal');
  if (modal) {
    modal.classList.remove('active');
  }
  revertThemePreview();
}

export function previewThemeFromSelector(themeId) {
  const theme = window.tripPersonalization?.themeOptions?.find(t => t.id === themeId);
  if (theme) {
    previewTheme(theme);
  }
}

export async function selectThemeFromSelector(themeId) {
  const personalization = window.tripPersonalization;
  if (!personalization) return;

  const theme = personalization.themeOptions.find(t => t.id === themeId);
  if (!theme) return;

  // Update selection
  personalization.selectedTheme = themeId;
  personalization.theme = theme;

  // Close modal
  closeThemeSelector();

  // Apply with fade
  await applyTheme(theme, { animate: true, duration: 1200 });

  // Show toast
  showThemeToast(theme);
}

// ========================================
// HELPERS
// ========================================

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// ========================================
// WINDOW EXPORTS
// ========================================

window.runAiAssist = runAiAssist;
window.openAiAssistModal = openAiAssistModal;
window.closeAiAssistModal = closeAiAssistModal;
window.openThemeSelector = openThemeSelector;
window.closeThemeSelector = closeThemeSelector;
window.previewThemeById = previewThemeById;
window.previewThemeFromSelector = previewThemeFromSelector;
window.selectReviewTheme = selectReviewTheme;
window.selectThemeFromSelector = selectThemeFromSelector;
window.applyReviewedPersonalization = applyReviewedPersonalization;
window.revertThemePreview = revertThemePreview;
