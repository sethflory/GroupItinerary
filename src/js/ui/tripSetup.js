// ========================================
// TRIP SETUP MODAL
// ========================================

import { currentTripId } from '../state.js';
import { API_BASE } from '../config.js';
import { getStoredAccessCode, isAdmin } from '../auth.js';

// ========================================
// STATE
// ========================================

let activeTab = 'travelers';
let travelers = [];
let isLoading = false;

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
// MODAL MANAGEMENT
// ========================================

export function openTripSetupModal() {
  let modal = document.getElementById('tripSetupModal');
  if (!modal) {
    createTripSetupModal();
    modal = document.getElementById('tripSetupModal');
  }
  modal.classList.add('active');
  loadTravelers();
}

export function closeTripSetupModal() {
  const modal = document.getElementById('tripSetupModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function createTripSetupModal() {
  const modal = document.createElement('div');
  modal.id = 'tripSetupModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal trip-setup-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">settings</span> Trip Settings</h3>
        <button class="modal-close" onclick="closeTripSetupModal()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-tabs">
        <button class="tab active" data-tab="travelers" onclick="switchTripSetupTab('travelers')">
          <span class="material-symbols-outlined">group</span>
          Travelers
        </button>
        <button class="tab" data-tab="codes" onclick="switchTripSetupTab('codes')">
          <span class="material-symbols-outlined">key</span>
          Access Codes
        </button>
      </div>
      <div class="modal-body" id="tripSetupBody">
        <div class="loading-spinner">Loading...</div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeTripSetupModal();
  });
}

// ========================================
// TAB SWITCHING
// ========================================

export function switchTripSetupTab(tab) {
  activeTab = tab;

  // Update tab buttons
  document.querySelectorAll('.trip-setup-modal .tab').forEach(btn => {
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
  renderTabContent();

  try {
    const result = await fetchTripSetup('travelers');
    if (result.travelers) {
      travelers = result.travelers;
    }
  } catch (err) {
    console.error('Load travelers error:', err);
  }

  isLoading = false;
  renderTabContent();
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

  if (activeTab === 'travelers') {
    renderTravelersTab(body);
  } else {
    renderCodesTab(body);
  }
}

function renderTravelersTab(container) {
  container.innerHTML = `
    <div class="travelers-list">
      ${travelers.length > 0 ? travelers.map(t => `
        <div class="traveler-item" data-id="${t.id}">
          <div class="traveler-avatar" style="background: ${t.color}">${t.initials}</div>
          <div class="traveler-info">
            <span class="traveler-name">${escapeHtml(t.name)}</span>
            <span class="traveler-group badge-${getGroupClass(t.group)}">${t.group || 'guest'}</span>
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
      `).join('') : '<p class="no-data">No travelers yet</p>'}
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
            <button class="icon-btn" onclick="copyAccessCode('${t.id}')" title="Copy">
              <span class="material-symbols-outlined">content_copy</span>
            </button>
            <button class="icon-btn" onclick="regenerateCode('${t.id}')" title="Regenerate">
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

// ========================================
// TRAVELER CRUD
// ========================================

export function showAddTravelerForm() {
  const container = document.getElementById('travelerFormContainer');
  container.innerHTML = `
    <div class="traveler-form">
      <h4>Add Traveler</h4>
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="newTravelerName" placeholder="Enter name" maxlength="50">
      </div>
      <div class="form-group">
        <label>Group</label>
        <select id="newTravelerGroup">
          <option value="guest">Guest</option>
          <option value="family">Family</option>
          <option value="couple">Couple</option>
        </select>
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="newTravelerColor" value="${getRandomColor()}">
      </div>
      <div class="form-actions">
        <button class="btn secondary" onclick="hideAddTravelerForm()">Cancel</button>
        <button class="btn primary" onclick="submitAddTraveler()">Add</button>
      </div>
    </div>
  `;

  document.getElementById('newTravelerName').focus();
}

export function hideAddTravelerForm() {
  const container = document.getElementById('travelerFormContainer');
  if (container) container.innerHTML = '';
}

export async function submitAddTraveler() {
  const name = document.getElementById('newTravelerName').value.trim();
  const group = document.getElementById('newTravelerGroup').value;
  const color = document.getElementById('newTravelerColor').value;

  if (!name) {
    alert('Please enter a name');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    const result = await fetchTripSetup('travelers', 'POST', { name, group, color });

    if (result.id) {
      travelers.push(result);
      hideAddTravelerForm();
      renderTabContent();

      // Update global TRAVELERS
      if (window.TRAVELERS) {
        window.TRAVELERS.push({
          id: result.id,
          name: result.name,
          group: result.group,
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
  container.innerHTML = `
    <div class="traveler-form">
      <h4>Edit Traveler</h4>
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="editTravelerName" value="${escapeHtml(traveler.name)}" maxlength="50">
      </div>
      <div class="form-group">
        <label>Group</label>
        <select id="editTravelerGroup">
          <option value="guest" ${traveler.group === 'guest' ? 'selected' : ''}>Guest</option>
          <option value="family" ${traveler.group === 'family' ? 'selected' : ''}>Family</option>
          <option value="couple" ${traveler.group === 'couple' ? 'selected' : ''}>Couple</option>
        </select>
      </div>
      <div class="form-group">
        <label>Color</label>
        <input type="color" id="editTravelerColor" value="${traveler.color || '#667eea'}">
      </div>
      <div class="form-actions">
        <button class="btn secondary" onclick="hideAddTravelerForm()">Cancel</button>
        <button class="btn primary" onclick="submitEditTraveler('${id}')">Save</button>
      </div>
    </div>
  `;
}

export async function submitEditTraveler(id) {
  const name = document.getElementById('editTravelerName').value.trim();
  const group = document.getElementById('editTravelerGroup').value;
  const color = document.getElementById('editTravelerColor').value;

  if (!name) {
    alert('Please enter a name');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const result = await fetchTripSetup(`travelers/${id}`, 'PUT', { name, group, color });

    if (result.id) {
      // Update local state
      const idx = travelers.findIndex(t => t.id === id);
      if (idx >= 0) {
        travelers[idx] = { ...travelers[idx], ...result };
      }
      hideAddTravelerForm();
      renderTabContent();

      // Update global TRAVELERS
      if (window.TRAVELERS) {
        const globalIdx = window.TRAVELERS.findIndex(t => t.id === id);
        if (globalIdx >= 0) {
          window.TRAVELERS[globalIdx] = { ...window.TRAVELERS[globalIdx], name, group, color };
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
      renderTabContent();

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

export async function copyAccessCode(id) {
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

export async function regenerateCode(id) {
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

function getRandomColor() {
  const colors = [
    '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688',
    '#4caf50', '#8bc34a', '#ff9800', '#ff5722'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ========================================
// EXPORTS
// ========================================

export {
  loadTravelers
};
