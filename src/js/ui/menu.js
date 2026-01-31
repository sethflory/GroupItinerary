// ========================================
// SLIDE-OUT MENU
// ========================================

let TRAVELERS = [];
let currentTraveler = null;

export function setMenuDeps(deps) {
  TRAVELERS = deps.TRAVELERS || [];
  currentTraveler = deps.currentTraveler;
}

// ========================================
// MENU TOGGLE
// ========================================

export function openMenu() {
  document.getElementById('menuOverlay')?.classList.add('visible');
  document.getElementById('menuDrawer')?.classList.add('visible');
  document.body.style.overflow = 'hidden';
  updateMenuState();
}

export function closeMenu() {
  document.getElementById('menuOverlay')?.classList.remove('visible');
  document.getElementById('menuDrawer')?.classList.remove('visible');
  document.body.style.overflow = '';
}

export function toggleMenu() {
  const drawer = document.getElementById('menuDrawer');
  if (drawer?.classList.contains('visible')) {
    closeMenu();
  } else {
    openMenu();
  }
}

// ========================================
// MENU STATE
// ========================================

function updateMenuState() {
  // Update toggle states from localStorage
  const showEveryone = localStorage.getItem('showEveryone') !== 'false';
  const listView = localStorage.getItem('viewMode') === 'list';

  const everyoneToggle = document.getElementById('menuToggleEveryone');
  const listToggle = document.getElementById('menuToggleList');

  if (everyoneToggle) {
    everyoneToggle.classList.toggle('active', showEveryone);
  }
  if (listToggle) {
    listToggle.classList.toggle('active', listView);
  }

  // Update user info if available
  updateUserInfo();
}

function updateUserInfo() {
  const userInitial = document.getElementById('menuUserInitial');
  const userName = document.getElementById('menuUserName');

  if (currentTraveler && userInitial && userName) {
    userInitial.textContent = currentTraveler.name?.charAt(0) || '?';
    userName.textContent = currentTraveler.name || 'Traveler';
  }
}

// ========================================
// TOGGLE HANDLERS
// ========================================

export function toggleShowEveryone() {
  const toggle = document.getElementById('menuToggleEveryone');
  const isActive = toggle?.classList.contains('active');
  const newValue = !isActive;

  toggle?.classList.toggle('active', newValue);
  localStorage.setItem('showEveryone', newValue.toString());

  // Dispatch event for other components to react
  window.dispatchEvent(new CustomEvent('filterChanged', {
    detail: { showEveryone: newValue }
  }));

  // Refresh the view
  if (typeof window.refreshCurrentView === 'function') {
    window.refreshCurrentView();
  }
}

export function toggleListView() {
  const toggle = document.getElementById('menuToggleList');
  const isActive = toggle?.classList.contains('active');
  const newValue = !isActive;

  toggle?.classList.toggle('active', newValue);
  localStorage.setItem('viewMode', newValue ? 'list' : 'journey');

  // Switch view
  if (typeof window.switchView === 'function') {
    window.switchView(newValue ? 'list' : 'journey');
  }
}

// ========================================
// MENU ACTIONS
// ========================================

export function openProfile() {
  closeMenu();
  if (typeof window.openProfileModal === 'function') {
    window.openProfileModal();
  }
}

export function logout() {
  closeMenu();
  if (typeof window.revokeAccess === 'function' && typeof window.currentTripId !== 'undefined') {
    window.revokeAccess(window.currentTripId);
  }
  if (typeof window.showLockScreen === 'function') {
    window.showLockScreen();
  }
  // Reload to clear all state
  window.location.reload();
}

export function openTripStats() {
  closeMenu();
  if (typeof window.openStatsShareModal === 'function') {
    window.openStatsShareModal();
  }
}

export function openShareMap() {
  closeMenu();
  if (typeof window.openMapShareModal === 'function') {
    window.openMapShareModal();
  }
}

export function openTrivia() {
  closeMenu();
  if (typeof window.openTriviaModal === 'function') {
    window.openTriviaModal();
  }
}

export function openHowItWorks() {
  closeMenu();
  if (typeof window.openHowItWorks === 'function') {
    window.openHowItWorks();
  }
}

export function openSwitchTrip() {
  closeMenu();
  if (typeof window.toggleTripSelector === 'function') {
    window.toggleTripSelector();
  }
}

export function openTripSettings() {
  closeMenu();
  if (typeof window.openTripSetupModal === 'function') {
    window.openTripSetupModal();
  }
}

// ========================================
// INITIALIZATION
// ========================================

export function initMenu() {
  // Close menu when clicking overlay
  document.getElementById('menuOverlay')?.addEventListener('click', closeMenu);

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  });

  // Listen for game enable/disable changes
  window.addEventListener('gamesChanged', (e) => {
    updateGameMenuItems(e.detail.enabledGames);
  });

  // Initialize toggle states
  updateMenuState();

  // Initialize game menu visibility
  initGameMenuItems();
}

// ========================================
// GAME MENU MANAGEMENT
// ========================================

function initGameMenuItems() {
  // Get enabled games from tripSetup
  if (typeof window.getEnabledGames === 'function') {
    const enabledGames = window.getEnabledGames();
    updateGameMenuItems(enabledGames);
  } else {
    // Fallback: check localStorage directly
    const tripId = window.currentTripId;
    if (tripId) {
      try {
        const stored = localStorage.getItem(`tripGames_${tripId}`);
        const enabledGames = stored ? JSON.parse(stored) : ['trivia', 'scavenger'];
        updateGameMenuItems(enabledGames);
      } catch (e) {
        // Default games
        updateGameMenuItems(['trivia', 'scavenger']);
      }
    }
  }
}

function updateGameMenuItems(enabledGames) {
  const gameItems = document.querySelectorAll('.game-menu-item');
  let visibleCount = 0;

  gameItems.forEach(item => {
    const gameId = item.dataset.game;
    const isEnabled = enabledGames.includes(gameId);
    item.style.display = isEnabled ? '' : 'none';
    if (isEnabled) visibleCount++;
  });

  // Hide entire games section if no games enabled
  const gamesSection = document.getElementById('menuGamesSection');
  if (gamesSection) {
    // Always show section since Scoreboard is always visible
    gamesSection.style.display = '';
  }
}

// Re-export for external access
export { updateGameMenuItems, initGameMenuItems };
