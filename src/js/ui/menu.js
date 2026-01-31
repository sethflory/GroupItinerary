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
  // TODO: Implement profile modal
  if (typeof window.openProfileModal === 'function') {
    window.openProfileModal();
  } else {
    console.log('Profile modal not yet implemented');
  }
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

export function openAiAssist() {
  closeMenu();
  if (typeof window.openAiAssistModal === 'function') {
    window.openAiAssistModal();
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

  // Initialize toggle states
  updateMenuState();
}
