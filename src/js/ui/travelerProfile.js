// ========================================
// TRAVELER PROFILE MODAL
// ========================================

import { getLocationSharingEnabled, setLocationSharingEnabled } from '../state.js';
import { getCurrentTravelerId, getDisplayName } from '../auth.js';
import { enableLocationSharing, disableLocationSharing } from './location.js';

// Get TRAVELERS from window (set by app.js after data loads)
function getTravelers() {
  return window.TRAVELERS || [];
}

// ========================================
// MODAL MANAGEMENT
// ========================================

export function openProfileModal() {
  let modal = document.getElementById('profileModal');
  if (!modal) {
    createProfileModal();
    modal = document.getElementById('profileModal');
  }

  populateProfileModal();
  modal.classList.add('active');
}

export function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createProfileModal() {
  const modal = document.createElement('div');
  modal.id = 'profileModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal profile-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">person</span> My Profile</h3>
        <button class="modal-close" onclick="closeProfileModal()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body" id="profileModalBody">
        <!-- Content rendered dynamically -->
      </div>
    </div>
  `;

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeProfileModal();
    }
  });

  document.body.appendChild(modal);
}

function populateProfileModal() {
  const body = document.getElementById('profileModalBody');
  if (!body) return;

  const travelers = getTravelers();
  const travelerId = getCurrentTravelerId();
  const traveler = travelers.find(t => t.id === travelerId);
  const displayName = getDisplayName();
  const locationEnabled = getLocationSharingEnabled();

  body.innerHTML = `
    <div class="profile-section">
      <div class="profile-avatar" style="background: ${traveler?.color || '#667085'}">
        <span class="profile-initials">${traveler?.initials || displayName?.charAt(0) || '?'}</span>
      </div>
      <div class="profile-info">
        <div class="profile-name">${escapeHtml(traveler?.name || displayName || 'Traveler')}</div>
        <div class="profile-role">${travelerId ? 'Traveler' : 'Guest'}</div>
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Settings</div>

      <div class="profile-setting">
        <div class="profile-setting-info">
          <span class="material-symbols-outlined">location_on</span>
          <div class="profile-setting-text">
            <div class="profile-setting-label">Share My Location</div>
            <div class="profile-setting-desc">Let others see where you are on the map</div>
          </div>
        </div>
        <div class="toggle-switch ${locationEnabled ? 'active' : ''}"
             id="profileLocationToggle"
             onclick="toggleProfileLocationSharing()">
        </div>
      </div>

      <div class="profile-location-status" id="profileLocationStatus">
        ${locationEnabled ?
          '<span class="status-enabled"><span class="material-symbols-outlined">check_circle</span> Location sharing is on</span>' :
          '<span class="status-disabled"><span class="material-symbols-outlined">location_off</span> Location sharing is off</span>'
        }
      </div>
    </div>

    <div class="profile-section">
      <div class="profile-section-title">Trip Info</div>
      <div class="profile-stat">
        <span class="material-symbols-outlined">group</span>
        <span>Traveling with ${travelers.length} ${travelers.length === 1 ? 'person' : 'people'}</span>
      </div>
    </div>

    <div class="profile-actions">
      <button class="btn secondary" onclick="closeProfileModal()">Close</button>
    </div>
  `;
}

// ========================================
// LOCATION TOGGLE
// ========================================

window.toggleProfileLocationSharing = async function() {
  const toggle = document.getElementById('profileLocationToggle');
  const status = document.getElementById('profileLocationStatus');
  const currentlyEnabled = getLocationSharingEnabled();

  if (currentlyEnabled) {
    // Disable sharing
    setLocationSharingEnabled(false);
    disableLocationSharing();
    toggle.classList.remove('active');
    status.innerHTML = '<span class="status-disabled"><span class="material-symbols-outlined">location_off</span> Location sharing is off</span>';
  } else {
    // Enable sharing - need to request permission
    try {
      toggle.classList.add('loading');
      status.innerHTML = '<span class="status-pending"><span class="material-symbols-outlined">hourglass_empty</span> Requesting permission...</span>';

      await enableLocationSharing();
      setLocationSharingEnabled(true);
      toggle.classList.add('active');
      toggle.classList.remove('loading');
      status.innerHTML = '<span class="status-enabled"><span class="material-symbols-outlined">check_circle</span> Location sharing is on</span>';
    } catch (error) {
      toggle.classList.remove('loading');
      status.innerHTML = `<span class="status-error"><span class="material-symbols-outlined">error</span> ${escapeHtml(error.message)}</span>`;
    }
  }
};

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

// Expose to window for onclick handlers
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
