// ========================================
// TRIP SETTINGS MODAL (formerly Trip Setup)
// Supports both wizard mode (new trips) and tabbed mode (maintenance)
// ========================================

import { currentTripId } from '../state.js';
import { API_BASE } from '../config.js';
import { getStoredAccessCode, isAdmin } from '../auth.js';
import { renderPersonalizeContent, hasPersonalization } from './aiAssist.js';
import { getCurrentTheme } from './themeManager.js';

// ========================================
// STATE
// ========================================

let activeTab = 'personalize';
let travelers = [];
let groups = []; // Custom groups
let isLoading = false;
let wizardMode = false;
let wizardStep = 1; // 1: Welcome, 2: Travelers, 3: Personalize

// Default groups that always exist
const DEFAULT_GROUPS = [
  { id: 'everyone', name: 'Everyone', color: '#6b7280', icon: 'group' }
];

// Available always-on games and features (only include implemented ones)
const AVAILABLE_GAMES = [
  {
    id: 'trivia',
    name: 'Trip Trivia',
    description: 'Test your travel knowledge with fun trivia questions about your destination',
    icon: 'quiz',
    color: '#8b5cf6'
  },
  {
    id: 'scavenger',
    name: 'Scavenger Hunt',
    description: 'Find and photograph items around your destination to earn points',
    icon: 'search',
    color: '#f59e0b'
  }
];

let enabledGames = [];

// ========================================
// API HELPERS
// ========================================

async function fetchTripSetup(endpoint, method = 'GET', body = null) {
  const accessCode = getStoredAccessCode(currentTripId);
  const url = `${API_BASE}/trips/${currentTripId}/${endpoint}?tripId=${encodeURIComponent(currentTripId)}&accessCode=${encodeURIComponent(accessCode)}`;

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };

  if (body) {
    options.body = JSON.stringify({ ...body, tripId: currentTripId, accessCode });
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    console.error(`Trip Setup API error (${response.status}):`, text);
    try {
      return JSON.parse(text);
    } catch {
      return { error: `API error: ${response.status}` };
    }
  }

  return response.json();
}

// ========================================
// WIZARD MODE DETECTION
// ========================================

function shouldShowWizard() {
  // Show wizard if: no personalization AND only 1 traveler AND not completed before
  const setupComplete = localStorage.getItem(`tripSetupComplete_${currentTripId}`);
  if (setupComplete === 'true') return false;

  const hasPersonalized = hasPersonalization();
  const hasFewTravelers = travelers.length <= 1;

  return !hasPersonalized && hasFewTravelers;
}

function markSetupComplete() {
  localStorage.setItem(`tripSetupComplete_${currentTripId}`, 'true');
  wizardMode = false;
  wizardStep = 1;
}

// ========================================
// MODAL MANAGEMENT
// ========================================

export function openTripSetupModal(forceTab = null) {
  let modal = document.getElementById('tripSettingsModal');
  if (!modal) {
    createTripSettingsModal();
    modal = document.getElementById('tripSettingsModal');
  }

  // Load travelers first to determine mode
  loadTravelers().then(() => {
    // Determine if we should show wizard or tabs
    wizardMode = shouldShowWizard();

    if (forceTab) {
      wizardMode = false;
      activeTab = forceTab;
    }

    renderModalContent();
  });

  modal.classList.add('active');
}

export function closeTripSetupModal() {
  const modal = document.getElementById('tripSettingsModal');
  if (modal) {
    modal.classList.remove('active');
  }
  // Reset state
  wizardStep = 1;
}

// Alias for backward compatibility
export const openTripSettingsModal = openTripSetupModal;
export const closeTripSettingsModal = closeTripSetupModal;

function createTripSettingsModal() {
  const modal = document.createElement('div');
  modal.id = 'tripSettingsModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal trip-setup-modal trip-settings-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">settings</span> Trip Settings</h3>
        <button class="modal-close" onclick="closeTripSetupModal()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div id="tripSettingsContent">
        <div class="loading-spinner"><span class="material-symbols-outlined spinning">progress_activity</span> Loading...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeTripSetupModal();
  });
}

function renderModalContent() {
  const contentEl = document.getElementById('tripSettingsContent');
  if (!contentEl) return;

  if (wizardMode) {
    renderWizardContent(contentEl);
  } else {
    renderTabbedContent(contentEl);
  }
}

// ========================================
// WIZARD MODE RENDERING
// ========================================

function renderWizardContent(container) {
  const trip = window.getCurrentTrip?.() || { name: 'Your Trip', emoji: '✈️' };

  container.innerHTML = `
    <div class="wizard-progress">
      <div class="wizard-step ${wizardStep >= 1 ? 'active' : ''} ${wizardStep > 1 ? 'completed' : ''}">
        <span class="step-number">1</span>
        <span class="step-label">Welcome</span>
      </div>
      <div class="wizard-step-line ${wizardStep > 1 ? 'completed' : ''}"></div>
      <div class="wizard-step ${wizardStep >= 2 ? 'active' : ''} ${wizardStep > 2 ? 'completed' : ''}">
        <span class="step-number">2</span>
        <span class="step-label">Travelers</span>
      </div>
      <div class="wizard-step-line ${wizardStep > 2 ? 'completed' : ''}"></div>
      <div class="wizard-step ${wizardStep >= 3 ? 'active' : ''}">
        <span class="step-number">3</span>
        <span class="step-label">Personalize</span>
      </div>
    </div>
    <div class="wizard-body" id="wizardBody">
      <!-- Step content rendered here -->
    </div>
  `;

  const wizardBody = document.getElementById('wizardBody');
  renderWizardStep(wizardBody);
}

function renderWizardStep(container) {
  if (wizardStep === 1) {
    renderWelcomeStep(container);
  } else if (wizardStep === 2) {
    renderTravelersStep(container);
  } else if (wizardStep === 3) {
    renderPersonalizeStep(container);
  }
}

function renderWelcomeStep(container) {
  const trip = window.getCurrentTrip?.() || { name: 'Your Trip', emoji: '✈️' };

  container.innerHTML = `
    <div class="wizard-welcome">
      <div class="wizard-welcome-icon">${trip.emoji || '✈️'}</div>
      <h2>${trip.name || 'Your Trip'}</h2>
      <p class="wizard-welcome-text">Let's set up your trip to make it perfect for everyone!</p>
      <div class="wizard-welcome-features">
        <div class="welcome-feature">
          <span class="material-symbols-outlined">group</span>
          <span>Add your fellow travelers</span>
        </div>
        <div class="welcome-feature">
          <img src="images/keys.png" alt="AI" class="ai-key-icon small">
          <span>Personalize with AI magic</span>
        </div>
        <div class="welcome-feature">
          <span class="material-symbols-outlined">palette</span>
          <span>Get a custom theme</span>
        </div>
      </div>
      <button class="btn primary wizard-btn" onclick="wizardNext()">
        Get Started
        <span class="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  `;
}

function renderTravelersStep(container) {
  const allGroups = getAllGroups();

  container.innerHTML = `
    <div class="wizard-travelers">
      <h3>Who's traveling?</h3>
      <p class="wizard-subtitle">Add everyone in your group so they can access the itinerary.</p>

      <div class="travelers-list wizard-travelers-list">
        ${travelers.length > 0 ? travelers.map(t => {
          const travelerGroups = t.groups || [];
          const groupBadges = travelerGroups.length > 0
            ? travelerGroups.map(gId => {
                const g = allGroups.find(grp => grp.id === gId);
                return g ? `<span class="traveler-group-badge" style="background: ${g.color}">${escapeHtml(g.name)}</span>` : '';
              }).join('')
            : '';

          return `
            <div class="traveler-item" data-id="${t.id}">
              <div class="traveler-avatar" style="background: ${t.color}">${t.initials}</div>
              <div class="traveler-info">
                <span class="traveler-name">${escapeHtml(t.name)}</span>
                ${groupBadges ? `<div class="traveler-groups">${groupBadges}</div>` : ''}
              </div>
              <div class="traveler-actions">
                <button class="icon-btn" onclick="editTraveler('${t.id}')" title="Edit">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                ${travelers.length > 1 ? `
                  <button class="icon-btn danger" onclick="confirmDeleteTraveler('${t.id}', '${escapeHtml(t.name)}')" title="Delete">
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('') : '<p class="no-data">No travelers yet</p>'}
      </div>

      <div class="add-traveler-section">
        <button class="add-btn" onclick="showAddTravelerForm()">
          <span class="material-symbols-outlined">person_add</span>
          Add Traveler
        </button>
      </div>
      <div id="travelerFormContainer"></div>

      <div class="wizard-nav">
        <button class="btn secondary" onclick="wizardBack()">
          <span class="material-symbols-outlined">arrow_back</span>
          Back
        </button>
        <button class="btn primary" onclick="wizardNext()">
          Continue
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  `;
}

function renderPersonalizeStep(container) {
  container.innerHTML = `
    <div class="wizard-personalize">
      <h3>Make it yours</h3>
      <p class="wizard-subtitle">Let AI personalize your itinerary with creative touches.</p>

      <div class="wizard-personalize-content" id="wizardPersonalizeContent">
        <!-- Personalize content rendered here -->
      </div>

      <div class="wizard-nav">
        <button class="btn secondary" onclick="wizardBack()">
          <span class="material-symbols-outlined">arrow_back</span>
          Back
        </button>
        <button class="btn text" onclick="wizardSkip()">
          Skip for now
        </button>
        <button class="btn primary" onclick="wizardFinish()">
          Done
          <span class="material-symbols-outlined">check</span>
        </button>
      </div>
    </div>
  `;

  // Render the personalize content
  const personalizeContent = document.getElementById('wizardPersonalizeContent');
  renderPersonalizeContent(personalizeContent);
}

export function wizardNext() {
  if (wizardStep < 3) {
    wizardStep++;
    renderModalContent();
  }
}

export function wizardBack() {
  if (wizardStep > 1) {
    wizardStep--;
    renderModalContent();
  }
}

export function wizardSkip() {
  wizardFinish();
}

export function wizardFinish() {
  markSetupComplete();

  // Show success toast
  showSuccessToast('Trip setup complete!');

  // Close modal
  closeTripSetupModal();
}

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
// TABBED MODE RENDERING
// ========================================

function renderTabbedContent(container) {
  container.innerHTML = `
    <div class="modal-tabs">
      <button class="tab ${activeTab === 'personalize' ? 'active' : ''}" data-tab="personalize" onclick="switchTripSetupTab('personalize')">
        <img src="images/keys.png" alt="AI" class="ai-key-icon tab-icon">
        Personalize
      </button>
      <button class="tab ${activeTab === 'travelers' ? 'active' : ''}" data-tab="travelers" onclick="switchTripSetupTab('travelers')">
        <span class="material-symbols-outlined">person</span>
        Travelers
      </button>
      <button class="tab ${activeTab === 'groups' ? 'active' : ''}" data-tab="groups" onclick="switchTripSetupTab('groups')">
        <span class="material-symbols-outlined">groups</span>
        Groups
      </button>
      <button class="tab ${activeTab === 'games' ? 'active' : ''}" data-tab="games" onclick="switchTripSetupTab('games')">
        <span class="material-symbols-outlined">sports_esports</span>
        Games
      </button>
      <button class="tab ${activeTab === 'codes' ? 'active' : ''}" data-tab="codes" onclick="switchTripSetupTab('codes')">
        <span class="material-symbols-outlined">key</span>
        Access
      </button>
      <button class="tab ${activeTab === 'import' ? 'active' : ''}" data-tab="import" onclick="switchTripSetupTab('import')">
        <span class="material-symbols-outlined">upload</span>
        Import
      </button>
    </div>
    <div class="modal-body" id="tripSetupBody">
      ${isLoading ? '<div class="loading-spinner"><span class="material-symbols-outlined spinning">progress_activity</span> Loading...</div>' : ''}
    </div>
  `;

  if (!isLoading) {
    renderTabContent();
  }
}

// ========================================
// TAB SWITCHING
// ========================================

export function switchTripSetupTab(tab) {
  activeTab = tab;

  // Update tab buttons
  document.querySelectorAll('.trip-settings-modal .tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Re-render content
  renderTabContent();
}

// ========================================
// DATA LOADING
// ========================================

async function loadTravelers() {
  isLoading = true;

  try {
    const result = await fetchTripSetup('travelers');
    if (result.travelers) {
      travelers = result.travelers;
    }
  } catch (err) {
    console.error('Load travelers error:', err);
  }

  isLoading = false;
  return travelers;
}

// ========================================
// RENDERING
// ========================================

function renderTabContent() {
  const body = document.getElementById('tripSetupBody');
  if (!body) return;

  if (isLoading) {
    body.innerHTML = `<div class="loading-spinner"><span class="material-symbols-outlined spinning">progress_activity</span> Loading...</div>`;
    return;
  }

  if (activeTab === 'personalize') {
    renderPersonalizeTab(body);
  } else if (activeTab === 'travelers') {
    renderTravelersTab(body);
  } else if (activeTab === 'groups') {
    renderGroupsTab(body);
  } else if (activeTab === 'games') {
    renderGamesTab(body);
  } else if (activeTab === 'codes') {
    renderCodesTab(body);
  } else if (activeTab === 'import') {
    renderImportTab(body);
  }
}

function renderPersonalizeTab(container) {
  container.innerHTML = `<div class="personalize-tab-content" id="personalizeTabContent"></div>`;
  const content = document.getElementById('personalizeTabContent');
  renderPersonalizeContent(content);
}

function renderTravelersTab(container) {
  const allGroups = getAllGroups();

  container.innerHTML = `
    <div class="travelers-list">
      ${travelers.length > 0 ? travelers.map(t => {
        const travelerGroups = t.groups || [];
        const groupBadges = travelerGroups.length > 0
          ? travelerGroups.map(gId => {
              const g = allGroups.find(grp => grp.id === gId);
              return g ? `<span class="traveler-group-badge" style="background: ${g.color}">${escapeHtml(g.name)}</span>` : '';
            }).join('')
          : `<span class="traveler-group-badge muted">No groups</span>`;

        return `
          <div class="traveler-item" data-id="${t.id}">
            <div class="traveler-avatar" style="background: ${t.color}">${t.initials}</div>
            <div class="traveler-info">
              <span class="traveler-name">${escapeHtml(t.name)}</span>
              <div class="traveler-groups">${groupBadges}</div>
            </div>
            <div class="traveler-actions">
              <button class="icon-btn" onclick="editTraveler('${t.id}')" title="Edit">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button class="icon-btn danger" onclick="confirmDeleteTraveler('${t.id}', '${escapeHtml(t.name)}')" title="Delete">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        `;
      }).join('') : '<p class="no-data">No travelers yet</p>'}
    </div>
    <div class="add-traveler-section">
      <button class="add-btn" onclick="showAddTravelerForm()">
        <span class="material-symbols-outlined">person_add</span>
        Add Traveler
      </button>
    </div>
    <div id="travelerFormContainer"></div>
  `;
}

function renderCodesTab(container) {
  container.innerHTML = `
    <div class="codes-list">
      ${travelers.length > 0 ? travelers.map(t => `
        <div class="code-item" data-id="${t.id}">
          <div class="code-traveler">
            <div class="traveler-avatar small" style="background: ${t.color}">${t.initials}</div>
            <span class="traveler-name">${escapeHtml(t.name)}</span>
          </div>
          <div class="code-value">
            <code id="code-${t.id}" class="access-code masked" onclick="toggleCodeVisibility('${t.id}')">${maskCode(t.accessCode)}</code>
            <input type="hidden" id="code-raw-${t.id}" value="${t.accessCode || ''}">
          </div>
          <div class="code-actions">
            <button class="icon-btn" onclick="copyAccessCode(event, '${t.id}')" title="Copy">
              <span class="material-symbols-outlined">content_copy</span>
            </button>
            <button class="icon-btn" onclick="regenerateCode(event, '${t.id}')" title="Regenerate">
              <span class="material-symbols-outlined">refresh</span>
            </button>
          </div>
        </div>
      `).join('') : '<p class="no-data">No travelers yet</p>'}
    </div>
    <p class="codes-help">
      <span class="material-symbols-outlined">info</span>
      Click a code to reveal it. Each traveler uses their personal code to access the trip.
    </p>
  `;
}

function renderImportTab(container) {
  container.innerHTML = `
    <div class="import-section">
      <div class="import-card" onclick="openReceiptUploadModal(); closeTripSetupModal();">
        <div class="import-icon">
          <span class="material-symbols-outlined">receipt_long</span>
        </div>
        <div class="import-info">
          <h4>Import from Receipt</h4>
          <p>Upload a flight confirmation, hotel booking, or restaurant reservation. AI will extract the details automatically.</p>
        </div>
        <span class="material-symbols-outlined import-arrow">chevron_right</span>
      </div>

      <div class="import-card disabled">
        <div class="import-icon">
          <span class="material-symbols-outlined">mail</span>
        </div>
        <div class="import-info">
          <h4>Import from Email</h4>
          <p>Forward confirmation emails to import travel details. Coming soon!</p>
        </div>
        <span class="badge coming-soon">Soon</span>
      </div>

      <div class="import-card disabled">
        <div class="import-icon">
          <span class="material-symbols-outlined">calendar_month</span>
        </div>
        <div class="import-info">
          <h4>Import from Calendar</h4>
          <p>Sync events from Google Calendar or Outlook. Coming soon!</p>
        </div>
        <span class="badge coming-soon">Soon</span>
      </div>
    </div>

    <div class="import-help">
      <span class="material-symbols-outlined">lightbulb</span>
      <p>Tip: For best results, upload clear images of booking confirmations. Screenshots work great!</p>
    </div>
  `;
}

// ========================================
// GROUPS TAB
// ========================================

function renderGroupsTab(container) {
  // Load groups from localStorage or use defaults
  loadGroups();

  const allGroups = [...DEFAULT_GROUPS, ...groups];

  container.innerHTML = `
    <div class="groups-section">
      <p class="groups-intro">Create groups to organize travelers. Travelers can belong to multiple groups.</p>

      <div class="groups-list">
        ${allGroups.map(g => `
          <div class="group-item ${g.id === 'everyone' ? 'default-group' : ''}" data-id="${g.id}">
            <div class="group-info">
              <span class="group-icon" style="background: ${g.color}">
                <span class="material-symbols-outlined">${g.icon || 'group'}</span>
              </span>
              <span class="group-name">${escapeHtml(g.name)}</span>
              <span class="group-count">${getGroupMemberCount(g.id)} travelers</span>
            </div>
            ${g.id !== 'everyone' ? `
              <div class="group-actions">
                <button class="icon-btn" onclick="editGroup('${g.id}')" title="Edit">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="icon-btn danger" onclick="confirmDeleteGroup('${g.id}', '${escapeHtml(g.name)}')" title="Delete">
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            ` : '<span class="default-badge">Default</span>'}
          </div>
        `).join('')}
      </div>

      <div class="add-group-section">
        <button class="add-btn" onclick="showAddGroupForm()">
          <span class="material-symbols-outlined">add_circle</span>
          Add Group
        </button>
      </div>
      <div id="groupFormContainer"></div>
    </div>

    <div class="groups-help">
      <span class="material-symbols-outlined">info</span>
      <p>Groups help filter the itinerary. "Everyone" includes all travelers and cannot be deleted.</p>
    </div>
  `;
}

function loadGroups() {
  const stored = localStorage.getItem(`tripGroups_${currentTripId}`);
  if (stored) {
    try {
      groups = JSON.parse(stored);
    } catch (e) {
      groups = [];
    }
  }
}

function saveGroups() {
  localStorage.setItem(`tripGroups_${currentTripId}`, JSON.stringify(groups));
}

function getGroupMemberCount(groupId) {
  if (groupId === 'everyone') {
    return travelers.length;
  }
  return travelers.filter(t => (t.groups || []).includes(groupId)).length;
}

export function showAddGroupForm() {
  const container = document.getElementById('groupFormContainer');
  container.innerHTML = `
    <div class="group-form">
      <h4>Add Group</h4>
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="newGroupName" placeholder="e.g., Family, Couples, Kids" maxlength="30">
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="newGroupColor" value="${getRandomGroupColor()}">
      </div>
      <div class="form-group">
        <label>Icon</label>
        <div class="icon-picker" id="groupIconPicker">
          ${renderIconPicker('group')}
        </div>
      </div>
      <div class="form-actions">
        <button class="btn secondary" onclick="hideGroupForm()">Cancel</button>
        <button class="btn primary" onclick="submitAddGroup()">Add</button>
      </div>
    </div>
  `;
  document.getElementById('newGroupName').focus();
}

export function hideGroupForm() {
  const container = document.getElementById('groupFormContainer');
  if (container) container.innerHTML = '';
}

function renderIconPicker(selectedIcon = 'group') {
  const icons = ['group', 'family_restroom', 'favorite', 'child_care', 'elderly', 'sports_esports', 'restaurant', 'flight', 'beach_access', 'hiking'];
  return icons.map(icon => `
    <button type="button" class="icon-option ${icon === selectedIcon ? 'selected' : ''}"
            onclick="selectGroupIcon('${icon}')" data-icon="${icon}">
      <span class="material-symbols-outlined">${icon}</span>
    </button>
  `).join('');
}

export function selectGroupIcon(icon) {
  document.querySelectorAll('.icon-option').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.icon === icon);
  });
}

function getSelectedIcon() {
  const selected = document.querySelector('.icon-option.selected');
  return selected ? selected.dataset.icon : 'group';
}

export function submitAddGroup() {
  const name = document.getElementById('newGroupName').value.trim();
  const color = document.getElementById('newGroupColor').value;
  const icon = getSelectedIcon();

  if (!name) {
    alert('Please enter a group name');
    return;
  }

  // Check for duplicate names
  const allGroups = [...DEFAULT_GROUPS, ...groups];
  if (allGroups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
    alert('A group with this name already exists');
    return;
  }

  const newGroup = {
    id: `group_${Date.now()}`,
    name,
    color,
    icon
  };

  groups.push(newGroup);
  saveGroups();
  hideGroupForm();
  renderTabContent();
}

export function editGroup(id) {
  const group = groups.find(g => g.id === id);
  if (!group) return;

  const container = document.getElementById('groupFormContainer');
  container.innerHTML = `
    <div class="group-form">
      <h4>Edit Group</h4>
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="editGroupName" value="${escapeHtml(group.name)}" maxlength="30">
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="editGroupColor" value="${group.color}">
      </div>
      <div class="form-group">
        <label>Icon</label>
        <div class="icon-picker" id="groupIconPicker">
          ${renderIconPicker(group.icon)}
        </div>
      </div>
      <div class="form-actions">
        <button class="btn secondary" onclick="hideGroupForm()">Cancel</button>
        <button class="btn primary" onclick="submitEditGroup('${id}')">Save</button>
      </div>
    </div>
  `;
}

export function submitEditGroup(id) {
  const name = document.getElementById('editGroupName').value.trim();
  const color = document.getElementById('editGroupColor').value;
  const icon = getSelectedIcon();

  if (!name) {
    alert('Please enter a group name');
    return;
  }

  const idx = groups.findIndex(g => g.id === id);
  if (idx >= 0) {
    groups[idx] = { ...groups[idx], name, color, icon };
    saveGroups();
    hideGroupForm();
    renderTabContent();
  }
}

export function confirmDeleteGroup(id, name) {
  if (confirm(`Delete the "${name}" group? Travelers in this group will be unassigned from it.`)) {
    deleteGroup(id);
  }
}

function deleteGroup(id) {
  groups = groups.filter(g => g.id !== id);
  saveGroups();

  // Remove this group from all travelers
  travelers.forEach(t => {
    if (t.groups) {
      t.groups = t.groups.filter(gId => gId !== id);
    }
  });

  renderTabContent();
}

function getRandomGroupColor() {
  const colors = ['#134e5e', '#71b280', '#f0b429', '#3182ce', '#805ad5', '#dd6b20', '#e53e3e', '#38a169', '#2c7a7b'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Get all available groups for traveler assignment
function getAllGroups() {
  loadGroups();
  return [...DEFAULT_GROUPS, ...groups];
}

// ========================================
// GAMES TAB
// ========================================

function renderGamesTab(container) {
  loadEnabledGames();

  container.innerHTML = `
    <div class="games-section">
      <p class="games-intro">Enable games for your trip. Enabled games appear in the menu for all travelers.</p>

      <div class="games-list">
        ${AVAILABLE_GAMES.map(game => {
          const isEnabled = enabledGames.includes(game.id);
          return `
            <div class="game-item ${isEnabled ? 'enabled' : ''}" data-game-id="${game.id}">
              <div class="game-toggle">
                <button class="toggle-btn ${isEnabled ? 'active' : ''}" onclick="toggleGame('${game.id}')">
                  <span class="toggle-track"></span>
                  <span class="toggle-thumb"></span>
                </button>
              </div>
              <div class="game-icon" style="background: ${game.color}">
                <span class="material-symbols-outlined">${game.icon}</span>
              </div>
              <div class="game-info">
                <span class="game-name">${game.name}</span>
                <span class="game-description">${game.description}</span>
              </div>
              ${isEnabled ? `
                <button class="game-settings-btn" onclick="openGameSettings('${game.id}')" title="Settings">
                  <span class="material-symbols-outlined">settings</span>
                </button>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <div class="games-help">
        <span class="material-symbols-outlined">info</span>
        <p>Enabled games will appear in the trip menu. Game progress is tracked on the Scoreboard.</p>
      </div>
    </div>
  `;
}

function loadEnabledGames() {
  const stored = localStorage.getItem(`tripGames_${currentTripId}`);
  if (stored) {
    try {
      enabledGames = JSON.parse(stored);
    } catch (e) {
      enabledGames = [];
    }
  } else {
    // Default: enable trivia and scavenger hunt
    enabledGames = ['trivia', 'scavenger'];
    saveEnabledGames();
  }
}

function saveEnabledGames() {
  localStorage.setItem(`tripGames_${currentTripId}`, JSON.stringify(enabledGames));
  // Dispatch event so menu can update
  window.dispatchEvent(new CustomEvent('gamesChanged', { detail: { enabledGames } }));
}

export function toggleGame(gameId) {
  loadEnabledGames();

  if (enabledGames.includes(gameId)) {
    enabledGames = enabledGames.filter(id => id !== gameId);
  } else {
    enabledGames.push(gameId);
  }

  saveEnabledGames();
  renderTabContent();
}

export function openGameSettings(gameId) {
  const game = AVAILABLE_GAMES.find(g => g.id === gameId);
  if (!game) return;

  // For now, show a simple settings dialog
  // This can be expanded with game-specific settings
  const container = document.getElementById('tripSetupBody');
  const existingSettings = container.querySelector('.game-settings-panel');
  if (existingSettings) {
    existingSettings.remove();
  }

  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'game-settings-panel';
  settingsPanel.innerHTML = `
    <div class="settings-panel-header">
      <div class="settings-panel-title">
        <span class="material-symbols-outlined" style="color: ${game.color}">${game.icon}</span>
        ${game.name} Settings
      </div>
      <button class="settings-panel-close" onclick="closeGameSettings()">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="settings-panel-body">
      ${getGameSettingsContent(gameId)}
    </div>
  `;

  container.appendChild(settingsPanel);
}

export function closeGameSettings() {
  const panel = document.querySelector('.game-settings-panel');
  if (panel) {
    panel.remove();
  }
}

function getGameSettingsContent(gameId) {
  // Game-specific settings
  switch (gameId) {
    case 'trivia':
      return `
        <div class="setting-group">
          <label>Default Category</label>
          <select id="triviaDefaultCategory" onchange="saveGameSetting('trivia', 'defaultCategory', this.value)">
            <option value="general">General</option>
            <option value="funny">Funny</option>
            <option value="historical">Historical</option>
            <option value="food">Food & Cuisine</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <div class="setting-group">
          <label>Points per Correct Answer</label>
          <input type="number" id="triviaPoints" value="10" min="1" max="100"
                 onchange="saveGameSetting('trivia', 'pointsPerAnswer', this.value)">
        </div>
      `;

    case 'scavenger':
      return `
        <div class="setting-group">
          <label>Points per Item Found</label>
          <input type="number" id="scavengerPoints" value="10" min="1" max="100"
                 onchange="saveGameSetting('scavenger', 'pointsPerItem', this.value)">
        </div>
        <div class="setting-group">
          <label>Bonus for First Finder</label>
          <input type="number" id="scavengerBonus" value="5" min="0" max="50"
                 onchange="saveGameSetting('scavenger', 'firstFinderBonus', this.value)">
        </div>
      `;

    case 'bingo':
      return `
        <div class="setting-group">
          <label>Card Size</label>
          <select id="bingoCardSize" onchange="saveGameSetting('bingo', 'cardSize', this.value)">
            <option value="3x3">3x3 (9 squares)</option>
            <option value="4x4">4x4 (16 squares)</option>
            <option value="5x5" selected>5x5 (25 squares)</option>
          </select>
        </div>
        <p class="setting-note">Bingo cards will be generated based on your trip itinerary.</p>
      `;

    case 'predictions':
      return `
        <div class="setting-group">
          <label>Points for Correct Prediction</label>
          <input type="number" id="predictionPoints" value="25" min="1" max="100"
                 onchange="saveGameSetting('predictions', 'pointsPerPrediction', this.value)">
        </div>
        <p class="setting-note">Travelers can make predictions about what will happen during the trip.</p>
      `;

    case 'challenges':
      return `
        <div class="setting-group">
          <label>Challenges per Day</label>
          <select id="challengesPerDay" onchange="saveGameSetting('challenges', 'perDay', this.value)">
            <option value="1">1 challenge</option>
            <option value="2">2 challenges</option>
            <option value="3" selected>3 challenges</option>
          </select>
        </div>
        <p class="setting-note">Challenges are generated automatically each day based on your itinerary.</p>
      `;

    default:
      return '<p>No settings available for this game.</p>';
  }
}

export function saveGameSetting(gameId, setting, value) {
  const settingsKey = `tripGameSettings_${currentTripId}_${gameId}`;
  let settings = {};

  try {
    settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
  } catch (e) {
    settings = {};
  }

  settings[setting] = value;
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

// Export for menu integration
export function getEnabledGames() {
  loadEnabledGames();
  return enabledGames;
}

export function isGameEnabled(gameId) {
  loadEnabledGames();
  return enabledGames.includes(gameId);
}

// ========================================
// TRAVELER CRUD
// ========================================

export function showAddTravelerForm() {
  const container = document.getElementById('travelerFormContainer');
  const allGroups = getAllGroups();

  container.innerHTML = `
    <div class="traveler-form">
      <h4>Add Traveler</h4>
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="newTravelerName" placeholder="Enter name" maxlength="50">
      </div>
      <div class="form-group">
        <label>Groups</label>
        <div class="group-checkboxes" id="newTravelerGroups">
          ${allGroups.filter(g => g.id !== 'everyone').map(g => `
            <label class="group-checkbox">
              <input type="checkbox" value="${g.id}" data-group-name="${escapeHtml(g.name)}">
              <span class="group-chip" style="--group-color: ${g.color}">
                <span class="material-symbols-outlined">${g.icon || 'group'}</span>
                ${escapeHtml(g.name)}
              </span>
            </label>
          `).join('') || '<span class="no-groups">No custom groups yet. Add groups in the Groups tab.</span>'}
        </div>
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="newTravelerColor" value="${getRandomColor()}">
      </div>
      <div class="form-actions">
        <button class="btn secondary" onclick="hideAddTravelerForm()">Cancel</button>
        <button class="btn primary" onclick="submitAddTraveler(event)">Add</button>
      </div>
    </div>
  `;

  document.getElementById('newTravelerName').focus();
}

export function hideAddTravelerForm() {
  const container = document.getElementById('travelerFormContainer');
  if (container) container.innerHTML = '';
}

export async function submitAddTraveler(event) {
  const name = document.getElementById('newTravelerName').value.trim();
  const color = document.getElementById('newTravelerColor').value;

  // Get selected groups from checkboxes
  const groupCheckboxes = document.querySelectorAll('#newTravelerGroups input[type="checkbox"]:checked');
  const selectedGroups = Array.from(groupCheckboxes).map(cb => cb.value);

  // For backward compatibility, use first group name or 'guest'
  const primaryGroup = groupCheckboxes.length > 0 ? groupCheckboxes[0].dataset.groupName : 'guest';

  if (!name) {
    alert('Please enter a name');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    const result = await fetchTripSetup('travelers', 'POST', { name, group: primaryGroup, groups: selectedGroups, color });

    if (result.id) {
      // Ensure groups array is included
      result.groups = selectedGroups;
      travelers.push(result);
      hideAddTravelerForm();

      // Re-render based on mode
      if (wizardMode) {
        renderModalContent();
      } else {
        renderTabContent();
      }

      // Update global TRAVELERS
      if (window.TRAVELERS) {
        window.TRAVELERS.push({
          id: result.id,
          name: result.name,
          group: result.group,
          groups: selectedGroups,
          color: result.color,
          initials: result.initials
        });
      }
    } else {
      alert(result.error || 'Failed to add traveler');
    }
  } catch (err) {
    console.error('Add traveler error:', err);
    alert('Failed to add traveler');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add';
  }
}

export function editTraveler(id) {
  const traveler = travelers.find(t => t.id === id);
  if (!traveler) return;

  const container = document.getElementById('travelerFormContainer');
  const allGroups = getAllGroups();
  const travelerGroups = traveler.groups || [];

  container.innerHTML = `
    <div class="traveler-form">
      <h4>Edit Traveler</h4>
      <div class="form-row">
        <div class="form-group flex-grow">
          <label>Name</label>
          <input type="text" id="editTravelerName" value="${escapeHtml(traveler.name)}" maxlength="50">
        </div>
        <div class="form-group form-group-small">
          <label>Initial</label>
          <input type="text" id="editTravelerInitials" value="${escapeHtml(traveler.initials || '')}" maxlength="2" class="input-initials">
        </div>
      </div>
      <div class="form-group">
        <label>Groups</label>
        <div class="group-checkboxes" id="editTravelerGroups">
          ${allGroups.filter(g => g.id !== 'everyone').map(g => `
            <label class="group-checkbox">
              <input type="checkbox" value="${g.id}" ${travelerGroups.includes(g.id) ? 'checked' : ''} data-group-name="${escapeHtml(g.name)}">
              <span class="group-chip" style="--group-color: ${g.color}">
                <span class="material-symbols-outlined">${g.icon || 'group'}</span>
                ${escapeHtml(g.name)}
              </span>
            </label>
          `).join('') || '<span class="no-groups">No custom groups yet. Add groups in the Groups tab.</span>'}
        </div>
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="editTravelerColor" value="${traveler.color || '#134e5e'}">
      </div>
      <div class="form-actions">
        <button class="btn secondary" onclick="hideAddTravelerForm()">Cancel</button>
        <button class="btn primary" onclick="submitEditTraveler(event, '${id}')">Save</button>
      </div>
    </div>
  `;
}

export async function submitEditTraveler(event, id) {
  const name = document.getElementById('editTravelerName').value.trim();
  const initials = document.getElementById('editTravelerInitials').value.trim().toUpperCase();
  const color = document.getElementById('editTravelerColor').value;

  // Get selected groups from checkboxes
  const groupCheckboxes = document.querySelectorAll('#editTravelerGroups input[type="checkbox"]:checked');
  const selectedGroups = Array.from(groupCheckboxes).map(cb => cb.value);

  // For backward compatibility, use first group name or 'guest'
  const primaryGroup = groupCheckboxes.length > 0 ? groupCheckboxes[0].dataset.groupName : 'guest';

  if (!name) {
    alert('Please enter a name');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const result = await fetchTripSetup(`travelers/${id}`, 'PUT', { name, initials, group: primaryGroup, groups: selectedGroups, color });

    if (result.id) {
      // Update local state
      const idx = travelers.findIndex(t => t.id === id);
      if (idx >= 0) {
        travelers[idx] = { ...travelers[idx], ...result, groups: selectedGroups };
      }
      hideAddTravelerForm();

      // Re-render based on mode
      if (wizardMode) {
        renderModalContent();
      } else {
        renderTabContent();
      }

      // Update global TRAVELERS
      if (window.TRAVELERS) {
        const globalIdx = window.TRAVELERS.findIndex(t => t.id === id);
        if (globalIdx >= 0) {
          window.TRAVELERS[globalIdx] = { ...window.TRAVELERS[globalIdx], name, initials, group: primaryGroup, groups: selectedGroups, color };
        }
      }
    } else {
      alert(result.error || 'Failed to update traveler');
    }
  } catch (err) {
    console.error('Update traveler error:', err);
    alert('Failed to update traveler');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

export function confirmDeleteTraveler(id, name) {
  if (travelers.length <= 1) {
    alert('Cannot delete the last traveler');
    return;
  }

  if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
    deleteTraveler(id);
  }
}

async function deleteTraveler(id) {
  try {
    const result = await fetchTripSetup(`travelers/${id}`, 'DELETE');

    if (result.success) {
      travelers = travelers.filter(t => t.id !== id);

      // Re-render based on mode
      if (wizardMode) {
        renderModalContent();
      } else {
        renderTabContent();
      }

      // Update global TRAVELERS
      if (window.TRAVELERS) {
        const idx = window.TRAVELERS.findIndex(t => t.id === id);
        if (idx >= 0) window.TRAVELERS.splice(idx, 1);
      }
    } else {
      alert(result.error || 'Failed to delete traveler');
    }
  } catch (err) {
    console.error('Delete traveler error:', err);
    alert('Failed to delete traveler');
  }
}

// ========================================
// ACCESS CODE MANAGEMENT
// ========================================

export function toggleCodeVisibility(id) {
  const codeEl = document.getElementById(`code-${id}`);
  const rawEl = document.getElementById(`code-raw-${id}`);

  if (codeEl.classList.contains('masked')) {
    codeEl.textContent = rawEl.value || '(no code)';
    codeEl.classList.remove('masked');
  } else {
    codeEl.textContent = maskCode(rawEl.value);
    codeEl.classList.add('masked');
  }
}

export async function copyAccessCode(event, id) {
  const rawEl = document.getElementById(`code-raw-${id}`);
  const code = rawEl?.value;

  if (!code) {
    alert('No access code available');
    return;
  }

  try {
    await navigator.clipboard.writeText(code);

    // Show feedback
    const btn = event.target.closest('.icon-btn');
    const icon = btn.querySelector('.material-symbols-outlined');
    icon.textContent = 'check';
    setTimeout(() => {
      icon.textContent = 'content_copy';
    }, 1500);
  } catch (err) {
    console.error('Copy error:', err);
    alert('Failed to copy code');
  }
}

export async function regenerateCode(event, id) {
  if (!confirm('Generate a new access code? The old code will stop working.')) {
    return;
  }

  const btn = event.target.closest('.icon-btn');
  const icon = btn.querySelector('.material-symbols-outlined');
  icon.classList.add('spinning');

  try {
    const result = await fetchTripSetup(`travelers/${id}/code`, 'PUT');

    if (result.accessCode) {
      // Update local state
      const traveler = travelers.find(t => t.id === id);
      if (traveler) traveler.accessCode = result.accessCode;

      // Update UI
      const codeEl = document.getElementById(`code-${id}`);
      const rawEl = document.getElementById(`code-raw-${id}`);
      if (rawEl) rawEl.value = result.accessCode;
      if (codeEl) {
        codeEl.textContent = result.accessCode;
        codeEl.classList.remove('masked');
      }
    } else {
      alert(result.error || 'Failed to regenerate code');
    }
  } catch (err) {
    console.error('Regenerate code error:', err);
    alert('Failed to regenerate code');
  } finally {
    icon.classList.remove('spinning');
  }
}

// ========================================
// HELPERS
// ========================================

function maskCode(code) {
  if (!code) return '••••••••';
  return '•'.repeat(code.length);
}

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

function getGroupClass(group) {
  const classes = {
    family: 'family',
    couple: 'couple',
    guest: 'guest'
  };
  return classes[group] || 'guest';
}

function getNextTravelerColor() {
  // Get colors based on current theme
  const theme = getCurrentTheme();
  const themePalette = theme?.palette || {};

  // Build color palette from theme + complementary colors
  const themeColors = [
    themePalette.primary || '#134e5e',
    themePalette.secondary || '#71b280',
    themePalette.accent || '#f0b429'
  ];

  // Additional colors that complement most themes
  const additionalColors = [
    '#2c7a7b', // Teal
    '#805ad5', // Purple
    '#dd6b20', // Orange
    '#3182ce', // Blue
    '#38a169', // Green
    '#e53e3e', // Red
    '#319795', // Cyan
    '#d69e2e'  // Gold
  ];

  const allColors = [...themeColors, ...additionalColors];

  // Get colors already used by existing travelers
  const usedColors = travelers.map(t => t.color?.toLowerCase());

  // Find first unused color
  for (const color of allColors) {
    if (!usedColors.includes(color.toLowerCase())) {
      return color;
    }
  }

  // If all colors used, cycle based on traveler count
  return allColors[travelers.length % allColors.length];
}

// Legacy alias for backward compatibility
function getRandomColor() {
  return getNextTravelerColor();
}

// ========================================
// WINDOW EXPORTS
// ========================================

window.wizardNext = wizardNext;
window.wizardBack = wizardBack;
window.wizardSkip = wizardSkip;
window.wizardFinish = wizardFinish;

// Group management exports
window.showAddGroupForm = showAddGroupForm;
window.hideGroupForm = hideGroupForm;
window.submitAddGroup = submitAddGroup;
window.editGroup = editGroup;
window.submitEditGroup = submitEditGroup;
window.confirmDeleteGroup = confirmDeleteGroup;
window.selectGroupIcon = selectGroupIcon;

// Game management exports
window.toggleGame = toggleGame;
window.openGameSettings = openGameSettings;
window.closeGameSettings = closeGameSettings;
window.saveGameSetting = saveGameSetting;
window.getEnabledGames = getEnabledGames;
window.isGameEnabled = isGameEnabled;
