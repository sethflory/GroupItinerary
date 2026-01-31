// ========================================
// SCAVENGER HUNT UI
// ========================================

import { fetchActiveHunt, fetchHunts, fetchHunt, createHunt, endHunt, claimHuntItem, addHuntItem, sendAIMessage } from '../api.js';
import { currentTripId } from '../state.js';
import { pushNotification } from './notifications.js';

let currentHunt = null;
let currentItems = [];
let isModalOpen = false;

// Dependencies injected from app.js
let DAYS, TRAVELERS, DESTINATIONS;

export function setScavengerHuntDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
  DESTINATIONS = deps.DESTINATIONS;
}

// ========================================
// MODAL MANAGEMENT
// ========================================

export async function openScavengerHunt(huntId = null) {
  const modal = document.getElementById('scavengerHuntModal');
  if (!modal) {
    createModal();
  }

  isModalOpen = true;
  document.getElementById('scavengerHuntModal').classList.add('active');

  // Load hunt data
  await refreshHuntData(huntId);
}

export function closeScavengerHunt() {
  const modal = document.getElementById('scavengerHuntModal');
  if (modal) {
    modal.classList.remove('active');
  }
  isModalOpen = false;
}

// Create the modal HTML
function createModal() {
  const modal = document.createElement('div');
  modal.id = 'scavengerHuntModal';
  modal.className = 'share-modal-overlay';
  modal.innerHTML = `
    <div class="share-modal scavenger-hunt-modal">
      <button class="modal-close" onclick="closeScavengerHunt()">
        <span class="material-symbols-outlined">close</span>
      </button>
      <div id="scavengerHuntContent">
        <!-- Content rendered dynamically -->
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'scavengerHuntModal') {
      closeScavengerHunt();
    }
  });
}

// ========================================
// DATA LOADING
// ========================================

async function refreshHuntData(huntId = null) {
  const content = document.getElementById('scavengerHuntContent');
  if (!content) return;

  content.innerHTML = '<div class="hunt-loading"><span class="material-symbols-outlined spinning">sync</span> Loading...</div>';

  try {
    if (huntId) {
      // Load specific hunt
      const data = await fetchHunt(currentTripId, huntId);
      currentHunt = data.hunt;
      currentItems = data.items || [];
    } else {
      // Load active hunt
      const data = await fetchActiveHunt(currentTripId);
      currentHunt = data.hunt;
      currentItems = data.items || [];
    }

    renderHuntView();
  } catch (err) {
    console.error('[ScavengerHunt] Failed to load:', err);
    content.innerHTML = `
      <div class="hunt-error">
        <span class="material-symbols-outlined">error</span>
        <p>Failed to load hunt data</p>
        <button class="btn btn-primary" onclick="refreshHuntData()">Retry</button>
      </div>
    `;
  }
}

// ========================================
// VIEW RENDERING
// ========================================

function renderHuntView() {
  const content = document.getElementById('scavengerHuntContent');
  if (!content) return;

  if (!currentHunt) {
    renderNoHuntView(content);
  } else if (currentHunt.status === 'active') {
    renderActiveHuntView(content);
  } else {
    renderCompletedHuntView(content);
  }
}

// No active hunt - show create option
function renderNoHuntView(content) {
  content.innerHTML = `
    <div class="hunt-header">
      <h3><span class="material-symbols-outlined">search</span> Scavenger Hunt</h3>
    </div>
    <div class="hunt-empty">
      <div class="hunt-empty-icon">🎯</div>
      <h4>No Active Hunt</h4>
      <p>Create a scavenger hunt for your group! AI will generate location-aware items based on your trip.</p>
      <button class="btn btn-primary btn-large" onclick="showHuntSetup()">
        <span class="material-symbols-outlined">add</span>
        Create Scavenger Hunt
      </button>
    </div>
    <div class="hunt-history-section">
      <h4>Past Hunts</h4>
      <div id="huntHistoryList">Loading...</div>
    </div>
  `;

  loadHuntHistory();
}

// Active hunt view
function renderActiveHuntView(content) {
  const foundCount = currentItems.filter(i => i.foundBy).length;
  const totalPoints = currentItems.reduce((sum, i) => sum + (i.points || 0), 0);
  const earnedPoints = currentItems.filter(i => i.foundBy).reduce((sum, i) => sum + (i.points || 0), 0);

  content.innerHTML = `
    <div class="hunt-header">
      <h3><span class="material-symbols-outlined">search</span> ${currentHunt.title}</h3>
      <div class="hunt-meta">
        Created by ${currentHunt.createdByName || 'Unknown'} • ${foundCount}/${currentItems.length} found
      </div>
    </div>

    <div class="hunt-progress">
      <div class="hunt-progress-bar">
        <div class="hunt-progress-fill" style="width: ${(foundCount / currentItems.length) * 100}%"></div>
      </div>
      <div class="hunt-progress-text">${earnedPoints} / ${totalPoints} points</div>
    </div>

    <div class="hunt-items-list" id="huntItemsList">
      ${currentItems.map(item => renderHuntItem(item)).join('')}
    </div>

    <div class="hunt-leaderboard">
      <h4>🏆 Leaderboard</h4>
      ${renderLeaderboard()}
    </div>

    <div class="hunt-actions">
      <button class="btn btn-secondary" onclick="showAddItemForm()">
        <span class="material-symbols-outlined">add</span> Add Item
      </button>
      <button class="btn btn-danger" onclick="confirmEndHunt()">
        <span class="material-symbols-outlined">stop</span> End Hunt
      </button>
    </div>
  `;
}

// Completed hunt view
function renderCompletedHuntView(content) {
  const foundCount = currentItems.filter(i => i.foundBy).length;

  content.innerHTML = `
    <div class="hunt-header">
      <h3><span class="material-symbols-outlined">emoji_events</span> ${currentHunt.title}</h3>
      <div class="hunt-meta hunt-completed">
        Completed • ${foundCount}/${currentItems.length} items found
      </div>
    </div>

    <div class="hunt-final-scores">
      <h4>🏆 Final Scores</h4>
      ${renderFinalScores()}
    </div>

    <div class="hunt-items-list completed">
      ${currentItems.map(item => renderHuntItem(item, true)).join('')}
    </div>

    <div class="hunt-actions">
      <button class="btn btn-secondary" onclick="refreshHuntData()">
        <span class="material-symbols-outlined">refresh</span> Refresh
      </button>
      <button class="btn btn-primary" onclick="showHuntSetup()">
        <span class="material-symbols-outlined">add</span> New Hunt
      </button>
    </div>
  `;
}

// Render single hunt item
function renderHuntItem(item, isCompleted = false) {
  const isFound = !!item.foundBy;
  const canClaim = !isFound && !isCompleted;

  return `
    <div class="hunt-item ${isFound ? 'found' : ''}" data-item-id="${item.id}">
      <div class="hunt-item-check">
        ${isFound ? '✅' : '⬜'}
      </div>
      <div class="hunt-item-content">
        <div class="hunt-item-description">${item.description}</div>
        <div class="hunt-item-meta">
          <span class="hunt-item-points">${item.points} pts</span>
          ${item.hint ? `<button class="hunt-hint-btn" onclick="toggleHint('${item.id}')">💡 Hint</button>` : ''}
        </div>
        ${item.hint ? `<div class="hunt-item-hint" id="hint-${item.id}" style="display:none">${item.hint}</div>` : ''}
        ${isFound ? `
          <div class="hunt-item-found">
            Found by ${item.foundByName || 'Unknown'} • ${formatTime(item.foundAt)}
            ${item.photoUrl ? `<img src="${item.photoUrl}" class="hunt-item-photo" alt="Proof">` : ''}
          </div>
        ` : ''}
      </div>
      ${canClaim ? `
        <button class="hunt-claim-btn" onclick="openClaimModal('${item.id}')">
          Claim
        </button>
      ` : ''}
    </div>
  `;
}

// Render leaderboard
function renderLeaderboard() {
  const scores = {};
  currentItems.forEach(item => {
    if (item.foundBy) {
      const name = item.foundByName || item.foundBy;
      scores[name] = (scores[name] || 0) + (item.points || 0);
    }
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return '<div class="hunt-leaderboard-empty">No items claimed yet</div>';
  }

  const medals = ['🥇', '🥈', '🥉'];
  return `
    <div class="hunt-leaderboard-list">
      ${sorted.map(([name, points], i) => `
        <div class="hunt-leaderboard-row">
          <span class="hunt-lb-rank">${medals[i] || (i + 1)}</span>
          <span class="hunt-lb-name">${name}</span>
          <span class="hunt-lb-points">${points} pts</span>
        </div>
      `).join('')}
    </div>
  `;
}

// Render final scores
function renderFinalScores() {
  let scores = currentHunt.finalScores || {};

  // Build name mapping from items if needed
  const nameMap = {};
  currentItems.forEach(item => {
    if (item.foundBy && item.foundByName) {
      nameMap[item.foundBy] = item.foundByName;
    }
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return '<div class="hunt-leaderboard-empty">No scores recorded</div>';
  }

  const medals = ['🥇', '🥈', '🥉'];
  return `
    <div class="hunt-leaderboard-list">
      ${sorted.map(([id, points], i) => `
        <div class="hunt-leaderboard-row ${i === 0 ? 'winner' : ''}">
          <span class="hunt-lb-rank">${medals[i] || (i + 1)}</span>
          <span class="hunt-lb-name">${nameMap[id] || id}</span>
          <span class="hunt-lb-points">${points} pts</span>
        </div>
      `).join('')}
    </div>
  `;
}

// Load hunt history
async function loadHuntHistory() {
  const container = document.getElementById('huntHistoryList');
  if (!container) return;

  try {
    const hunts = await fetchHunts(currentTripId, 'completed');

    if (hunts.length === 0) {
      container.innerHTML = '<div class="hunt-history-empty">No completed hunts yet</div>';
      return;
    }

    container.innerHTML = hunts.slice(0, 5).map(hunt => `
      <div class="hunt-history-item" onclick="openScavengerHunt('${hunt.id}')">
        <div class="hunt-history-title">${hunt.title}</div>
        <div class="hunt-history-meta">${formatDate(hunt.completedAt)}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="hunt-history-empty">Could not load history</div>';
  }
}

// ========================================
// HUNT SETUP / CREATION
// ========================================

export function showHuntSetup() {
  const content = document.getElementById('scavengerHuntContent');
  if (!content) return;

  content.innerHTML = `
    <div class="hunt-header">
      <h3><span class="material-symbols-outlined">add</span> Create Scavenger Hunt</h3>
    </div>

    <div class="hunt-setup-form">
      <div class="hunt-form-group">
        <label>Hunt Title</label>
        <input type="text" id="huntTitle" placeholder="e.g., Athens Photo Safari" value="">
      </div>

      <div class="hunt-form-group">
        <label>Theme</label>
        <select id="huntTheme">
          <option value="photo_ops">📷 Photo Opportunities</option>
          <option value="landmarks">🏛️ Landmarks & History</option>
          <option value="food">🍽️ Food & Drinks</option>
          <option value="culture">🎭 Local Culture</option>
          <option value="nature">🌿 Nature & Parks</option>
          <option value="mixed">🎯 Mixed (All Types)</option>
        </select>
      </div>

      <div class="hunt-form-row">
        <div class="hunt-form-group">
          <label>Difficulty</label>
          <select id="huntDifficulty">
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div class="hunt-form-group">
          <label>Number of Items</label>
          <select id="huntItemCount">
            <option value="5">5 items</option>
            <option value="10" selected>10 items</option>
            <option value="15">15 items</option>
            <option value="20">20 items</option>
          </select>
        </div>
      </div>

      <div class="hunt-form-group">
        <label>Location Scope</label>
        <select id="huntScope">
          <option value="current">Current Location Only</option>
          <option value="all">All Trip Destinations</option>
        </select>
      </div>

      <div class="hunt-form-group">
        <label>End Condition</label>
        <select id="huntEndCondition">
          <option value="manual">Manual (End when ready)</option>
          <option value="all_found">Auto-end when all found</option>
        </select>
      </div>

      <div class="hunt-setup-actions">
        <button class="btn btn-secondary" onclick="renderHuntView()">Cancel</button>
        <button class="btn btn-primary" onclick="generateHuntItems()">
          <span class="material-symbols-outlined">auto_awesome</span>
          Generate Items with AI
        </button>
      </div>
    </div>
  `;
}

// Generate hunt items using AI
export async function generateHuntItems() {
  const title = document.getElementById('huntTitle').value || 'Scavenger Hunt';
  const theme = document.getElementById('huntTheme').value;
  const difficulty = document.getElementById('huntDifficulty').value;
  const itemCount = parseInt(document.getElementById('huntItemCount').value);
  const scope = document.getElementById('huntScope').value;
  const endCondition = document.getElementById('huntEndCondition').value;

  const content = document.getElementById('scavengerHuntContent');
  content.innerHTML = `
    <div class="hunt-generating">
      <div class="hunt-generating-spinner">
        <span class="material-symbols-outlined spinning">auto_awesome</span>
      </div>
      <h4>Generating Hunt Items...</h4>
      <p>AI is creating ${itemCount} items based on your trip</p>
    </div>
  `;

  try {
    // Build context for AI
    const currentLocation = getCurrentLocation();
    const destinations = scope === 'all' ? Object.values(DESTINATIONS || {}) : [currentLocation];

    const themeNames = {
      photo_ops: 'photo opportunities',
      landmarks: 'landmarks and historical sites',
      food: 'food and local cuisine',
      culture: 'local culture and traditions',
      nature: 'nature and outdoor spots',
      mixed: 'mixed activities'
    };

    const prompt = buildHuntGenerationPrompt({
      destinations,
      theme: themeNames[theme],
      difficulty,
      itemCount,
      days: DAYS,
      travelers: TRAVELERS
    });

    const response = await sendAIMessage(currentTripId, {
      system: 'You are a scavenger hunt creator for travel groups. Generate fun, location-specific items that travelers can find and photograph. Always respond with valid JSON only.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048
    });

    // Parse AI response
    const items = parseAIHuntItems(response, itemCount);

    // Show preview
    showHuntPreview(title, items, { theme, difficulty, endCondition });

  } catch (err) {
    console.error('[ScavengerHunt] AI generation failed:', err);
    content.innerHTML = `
      <div class="hunt-error">
        <span class="material-symbols-outlined">error</span>
        <p>Failed to generate items: ${err.message}</p>
        <button class="btn btn-primary" onclick="showHuntSetup()">Try Again</button>
      </div>
    `;
  }
}

// Build the AI prompt for hunt generation
function buildHuntGenerationPrompt({ destinations, theme, difficulty, itemCount, days, travelers }) {
  const destInfo = destinations.map(d => `${d.city || d.name}, ${d.country || ''}`).join('; ');

  // Get scheduled activities for context
  const activities = [];
  (days || []).forEach(day => {
    (day.events || []).forEach(e => {
      if (e.type === 'activity' || e.type === 'meal') {
        activities.push(`${e.title} at ${e.where || 'TBD'}`);
      }
    });
  });

  const difficultyMix = {
    easy: '60% easy (5pts), 30% medium (10pts), 10% hard (15pts)',
    medium: '30% easy (5pts), 50% medium (10pts), 20% hard (15-20pts)',
    hard: '10% easy (5pts), 40% medium (10pts), 50% hard (15-20pts)'
  };

  return `Create a scavenger hunt for a travel group.

LOCATION: ${destInfo}
THEME: ${theme}
DIFFICULTY: ${difficulty}
ITEMS NEEDED: ${itemCount}

${activities.length > 0 ? `SCHEDULED ACTIVITIES (for context):
${activities.slice(0, 10).join('\n')}` : ''}

DIFFICULTY MIX: ${difficultyMix[difficulty]}

Generate exactly ${itemCount} scavenger hunt items. For each item provide:
- description: Clear, specific thing to find (e.g., "A blue door in the old town")
- points: 5, 10, 15, or 20 based on difficulty
- hint: Optional helpful clue (1 sentence)

Make items:
- Relevant to the location and theme
- Fun and photographable
- Mix of easy, medium, and hard
- Specific enough to verify but not impossible

Return ONLY a JSON array, no other text:
[{"description":"...", "points":10, "hint":"..."}, ...]`;
}

// Parse AI response into items
function parseAIHuntItems(response, expectedCount) {
  try {
    // Find JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const items = JSON.parse(jsonMatch[0]);

    // Validate and clean items
    return items.slice(0, expectedCount).map((item, i) => ({
      description: item.description || `Item ${i + 1}`,
      points: [5, 10, 15, 20].includes(item.points) ? item.points : 10,
      hint: item.hint || null
    }));

  } catch (err) {
    console.error('[ScavengerHunt] Failed to parse AI response:', err);
    // Return fallback items
    return Array.from({ length: expectedCount }, (_, i) => ({
      description: `Scavenger hunt item ${i + 1}`,
      points: 10,
      hint: null
    }));
  }
}

// Show hunt preview before creating
function showHuntPreview(title, items, options) {
  const content = document.getElementById('scavengerHuntContent');

  content.innerHTML = `
    <div class="hunt-header">
      <h3><span class="material-symbols-outlined">preview</span> Preview Hunt</h3>
    </div>

    <div class="hunt-preview">
      <div class="hunt-preview-title">
        <input type="text" id="previewTitle" value="${escapeHtml(title)}" placeholder="Hunt title">
      </div>

      <div class="hunt-preview-items" id="previewItems">
        ${items.map((item, i) => `
          <div class="hunt-preview-item" data-index="${i}">
            <div class="hunt-preview-item-header">
              <span class="hunt-preview-points">${item.points} pts</span>
              <button class="hunt-preview-delete" onclick="removePreviewItem(${i})">×</button>
            </div>
            <input type="text" class="hunt-preview-desc" value="${escapeHtml(item.description)}" data-field="description">
            ${item.hint ? `<input type="text" class="hunt-preview-hint" value="${escapeHtml(item.hint)}" placeholder="Hint (optional)" data-field="hint">` : ''}
          </div>
        `).join('')}
      </div>

      <div class="hunt-preview-summary">
        Total: ${items.length} items • ${items.reduce((s, i) => s + i.points, 0)} points
      </div>

      <div class="hunt-preview-actions">
        <button class="btn btn-secondary" onclick="showHuntSetup()">
          <span class="material-symbols-outlined">refresh</span> Regenerate
        </button>
        <button class="btn btn-primary" onclick="launchHunt()">
          <span class="material-symbols-outlined">rocket_launch</span> Launch Hunt!
        </button>
      </div>
    </div>
  `;

  // Store items and options for launch
  window._pendingHuntItems = items;
  window._pendingHuntOptions = options;
}

// Remove item from preview
window.removePreviewItem = function(index) {
  if (window._pendingHuntItems) {
    window._pendingHuntItems.splice(index, 1);
    showHuntPreview(
      document.getElementById('previewTitle')?.value || 'Scavenger Hunt',
      window._pendingHuntItems,
      window._pendingHuntOptions
    );
  }
};

// Launch the hunt
window.launchHunt = async function() {
  const title = document.getElementById('previewTitle')?.value || 'Scavenger Hunt';
  const items = window._pendingHuntItems || [];
  const options = window._pendingHuntOptions || {};

  if (items.length === 0) {
    alert('Please add at least one item');
    return;
  }

  const content = document.getElementById('scavengerHuntContent');
  content.innerHTML = `
    <div class="hunt-generating">
      <div class="hunt-generating-spinner">
        <span class="material-symbols-outlined spinning">rocket_launch</span>
      </div>
      <h4>Launching Hunt...</h4>
    </div>
  `;

  try {
    const huntData = {
      title,
      theme: options.theme,
      difficulty: options.difficulty,
      endCondition: options.endCondition,
      items
    };

    await createHunt(currentTripId, huntData);

    // Refresh to show active hunt
    await refreshHuntData();

    // Push local notification
    pushNotification({
      type: 'hunt_started',
      message: `Scavenger hunt "${title}" has started!`,
      icon: '🎯'
    });

  } catch (err) {
    console.error('[ScavengerHunt] Failed to create hunt:', err);
    content.innerHTML = `
      <div class="hunt-error">
        <span class="material-symbols-outlined">error</span>
        <p>Failed to create hunt: ${err.message}</p>
        <button class="btn btn-primary" onclick="showHuntSetup()">Try Again</button>
      </div>
    `;
  }
};

// ========================================
// CLAIM ITEM
// ========================================

export function openClaimModal(itemId) {
  const item = currentItems.find(i => i.id === itemId);
  if (!item) return;

  const modal = document.createElement('div');
  modal.id = 'claimModal';
  modal.className = 'share-modal-overlay active';
  modal.innerHTML = `
    <div class="share-modal claim-modal">
      <button class="modal-close" onclick="closeClaimModal()">
        <span class="material-symbols-outlined">close</span>
      </button>
      <h3>🎯 Claim Item</h3>
      <p class="claim-item-desc">"${item.description}"</p>

      <div class="claim-photo-upload">
        <div class="claim-dropzone" onclick="document.getElementById('claimPhotoInput').click()">
          <span class="material-symbols-outlined">add_a_photo</span>
          <p>Add photo (optional)</p>
        </div>
        <input type="file" id="claimPhotoInput" accept="image/*" style="display:none" onchange="handleClaimPhoto(event)">
        <img id="claimPhotoPreview" class="claim-photo-preview" style="display:none">
      </div>

      <div class="claim-form-group">
        <label>Note (optional)</label>
        <input type="text" id="claimNote" placeholder="Where did you find it?">
      </div>

      <div class="claim-actions">
        <button class="btn btn-secondary" onclick="closeClaimModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitClaim('${itemId}')">
          Claim! +${item.points} pts
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

window.closeClaimModal = function() {
  const modal = document.getElementById('claimModal');
  if (modal) {
    modal.remove();
  }
};

window.handleClaimPhoto = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('claimPhotoPreview');
    const dropzone = document.querySelector('.claim-dropzone');
    if (preview) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    }
    if (dropzone) {
      dropzone.style.display = 'none';
    }
  };
  reader.readAsDataURL(file);
};

window.submitClaim = async function(itemId) {
  const note = document.getElementById('claimNote')?.value || '';
  const photoPreview = document.getElementById('claimPhotoPreview');
  const photoUrl = photoPreview?.style.display !== 'none' ? photoPreview.src : null;

  try {
    await claimHuntItem(currentTripId, currentHunt.id, itemId, { note, photoUrl });
    closeClaimModal();
    await refreshHuntData();

    // Local notification
    const item = currentItems.find(i => i.id === itemId);
    pushNotification({
      type: 'hunt_item_claimed',
      message: `You found "${item?.description}"! +${item?.points} pts`,
      icon: '✅'
    });

  } catch (err) {
    alert('Failed to claim: ' + err.message);
  }
};

// ========================================
// END HUNT
// ========================================

window.confirmEndHunt = function() {
  if (confirm('Are you sure you want to end this hunt? Final scores will be calculated.')) {
    endHuntNow();
  }
};

async function endHuntNow() {
  try {
    await endHunt(currentTripId, currentHunt.id);
    await refreshHuntData();

    pushNotification({
      type: 'hunt_ended',
      message: `Scavenger hunt "${currentHunt.title}" has ended!`,
      icon: '🏆'
    });
  } catch (err) {
    alert('Failed to end hunt: ' + err.message);
  }
}

// ========================================
// ADD CUSTOM ITEM
// ========================================

window.showAddItemForm = function() {
  const modal = document.createElement('div');
  modal.id = 'addItemModal';
  modal.className = 'share-modal-overlay active';
  modal.innerHTML = `
    <div class="share-modal claim-modal">
      <button class="modal-close" onclick="closeAddItemModal()">
        <span class="material-symbols-outlined">close</span>
      </button>
      <h3>➕ Add Item</h3>

      <div class="claim-form-group">
        <label>Description *</label>
        <input type="text" id="newItemDesc" placeholder="What to find...">
      </div>

      <div class="claim-form-group">
        <label>Points</label>
        <select id="newItemPoints">
          <option value="5">5 pts (Easy)</option>
          <option value="10" selected>10 pts (Medium)</option>
          <option value="15">15 pts (Hard)</option>
          <option value="20">20 pts (Very Hard)</option>
        </select>
      </div>

      <div class="claim-form-group">
        <label>Hint (optional)</label>
        <input type="text" id="newItemHint" placeholder="A helpful clue...">
      </div>

      <div class="claim-actions">
        <button class="btn btn-secondary" onclick="closeAddItemModal()">Cancel</button>
        <button class="btn btn-primary" onclick="submitNewItem()">Add Item</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

window.closeAddItemModal = function() {
  const modal = document.getElementById('addItemModal');
  if (modal) modal.remove();
};

window.submitNewItem = async function() {
  const description = document.getElementById('newItemDesc')?.value;
  const points = parseInt(document.getElementById('newItemPoints')?.value) || 10;
  const hint = document.getElementById('newItemHint')?.value || null;

  if (!description) {
    alert('Please enter a description');
    return;
  }

  try {
    await addHuntItem(currentTripId, currentHunt.id, { description, points, hint });
    closeAddItemModal();
    await refreshHuntData();
  } catch (err) {
    alert('Failed to add item: ' + err.message);
  }
};

// ========================================
// HELPERS
// ========================================

function toggleHint(itemId) {
  const hint = document.getElementById(`hint-${itemId}`);
  if (hint) {
    hint.style.display = hint.style.display === 'none' ? 'block' : 'none';
  }
}
window.toggleHint = toggleHint;

function getCurrentLocation() {
  // Try to determine current location from trip data
  const today = new Date().toISOString().split('T')[0];
  const currentDay = (DAYS || []).find(d => d.date === today);

  if (currentDay && DESTINATIONS) {
    return DESTINATIONS[currentDay.location] || DESTINATIONS[currentDay.destination] || {};
  }

  // Fallback to first destination
  return Object.values(DESTINATIONS || {})[0] || { city: 'Unknown', country: '' };
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// Expose functions globally
window.openScavengerHunt = openScavengerHunt;
window.closeScavengerHunt = closeScavengerHunt;
window.showHuntSetup = showHuntSetup;
window.generateHuntItems = generateHuntItems;
window.openClaimModal = openClaimModal;
window.refreshHuntData = refreshHuntData;
