// ========================================
// RECEIPT UPLOAD & PARSING
// ========================================

import { API_BASE } from '../config.js';
import { currentTripId } from '../state.js';
import { getStoredAccessCode } from '../auth.js';

let extractedEvents = [];
let existingEvents = [];
let currentImage = null;
let currentText = null;

// ========================================
// MODAL MANAGEMENT
// ========================================

export function openReceiptUploadModal() {
  let modal = document.getElementById('receiptUploadModal');
  if (!modal) {
    createReceiptUploadModal();
    modal = document.getElementById('receiptUploadModal');
  }
  modal.classList.add('active');
  resetState();
  showUploadStep();
}

export function closeReceiptUploadModal() {
  const modal = document.getElementById('receiptUploadModal');
  if (modal) {
    modal.classList.remove('active');
  }
  resetState();
}

function resetState() {
  extractedEvents = [];
  existingEvents = [];
  currentImage = null;
  currentText = null;
}

function createReceiptUploadModal() {
  const modal = document.createElement('div');
  modal.id = 'receiptUploadModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal receipt-upload-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">receipt_long</span> Add from Receipt</h3>
        <button class="modal-close" onclick="closeReceiptUploadModal()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body" id="receiptUploadBody">
        <!-- Content rendered dynamically -->
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeReceiptUploadModal();
  });
}

// ========================================
// STEP 1: UPLOAD
// ========================================

let inputMode = 'image'; // 'image' or 'text'

function showUploadStep() {
  const body = document.getElementById('receiptUploadBody');
  body.innerHTML = `
    <div class="receipt-upload-step">
      <div class="input-mode-toggle">
        <button class="mode-btn ${inputMode === 'image' ? 'active' : ''}" onclick="setInputMode('image')">
          <span class="material-symbols-outlined">image</span>
          Upload Image
        </button>
        <button class="mode-btn ${inputMode === 'text' ? 'active' : ''}" onclick="setInputMode('text')">
          <span class="material-symbols-outlined">content_paste</span>
          Paste Text
        </button>
      </div>

      ${inputMode === 'image' ? `
        <div class="upload-zone" id="receiptDropZone">
          <span class="material-symbols-outlined upload-icon">cloud_upload</span>
          <p class="upload-title">Drop your receipt here</p>
          <p class="upload-subtitle">or click to browse</p>
          <p class="upload-formats">Supports: JPG, PNG, GIF, WebP</p>
          <input type="file" id="receiptFileInput" accept="image/jpeg,image/png,image/gif,image/webp" style="display: none">
        </div>
      ` : `
        <div class="paste-zone">
          <textarea id="receiptTextInput" placeholder="Paste your confirmation email or booking details here...

Example:
- Flight confirmation from airline
- Hotel booking confirmation
- Restaurant reservation details
- Activity/tour tickets"></textarea>
          <button class="btn primary" onclick="handleTextInput()">
            <span class="material-symbols-outlined">auto_awesome</span>
            Extract Events
          </button>
        </div>
      `}

      <div class="upload-examples">
        <p>Works great with:</p>
        <ul>
          <li><span class="material-symbols-outlined">flight</span> Flight confirmations</li>
          <li><span class="material-symbols-outlined">hotel</span> Hotel bookings</li>
          <li><span class="material-symbols-outlined">restaurant</span> Restaurant reservations</li>
          <li><span class="material-symbols-outlined">confirmation_number</span> Activity tickets</li>
        </ul>
      </div>
    </div>
  `;

  // Expose functions for onclick handlers
  window.setInputMode = setInputMode;
  window.handleTextInput = handleTextInput;

  if (inputMode === 'image') {
    setupDropZone();
  }
}

function setInputMode(mode) {
  inputMode = mode;
  showUploadStep();
}

function setupDropZone() {
  const dropZone = document.getElementById('receiptDropZone');
  const fileInput = document.getElementById('receiptFileInput');

  // Click to browse
  dropZone.addEventListener('click', () => fileInput.click());

  // File selected
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
}

async function handleFile(file) {
  // Validate file type (Claude vision API only supports images, not PDFs)
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    alert('Please upload an image file (JPG, PNG, GIF, or WebP).');
    return;
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert('File is too large. Please upload a file under 10MB.');
    return;
  }

  // Convert to base64
  const base64 = await fileToBase64(file);
  currentImage = {
    data: base64,
    type: file.type,
    name: file.name
  };

  showProcessingStep();
  await parseReceipt();
}

async function handleTextInput() {
  const textarea = document.getElementById('receiptTextInput');
  const text = textarea?.value?.trim();

  if (!text) {
    alert('Please paste some text to analyze.');
    return;
  }

  if (text.length < 20) {
    alert('Please paste more details. The text seems too short to extract travel information.');
    return;
  }

  currentText = text;
  currentImage = null;

  showProcessingStep();
  await parseReceipt();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove the data URL prefix to get just the base64 data
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ========================================
// STEP 2: PROCESSING
// ========================================

function showProcessingStep() {
  const body = document.getElementById('receiptUploadBody');

  const previewContent = currentImage
    ? `<img src="data:${currentImage.type};base64,${currentImage.data}" alt="Receipt preview">`
    : `<div class="text-preview"><span class="material-symbols-outlined">description</span><p>${escapeHtml(currentText.substring(0, 100))}${currentText.length > 100 ? '...' : ''}</p></div>`;

  body.innerHTML = `
    <div class="receipt-processing-step">
      <div class="processing-preview">
        ${previewContent}
      </div>
      <div class="processing-status">
        <span class="material-symbols-outlined spinning">progress_activity</span>
        <p>Analyzing your ${currentImage ? 'receipt' : 'text'}...</p>
        <p class="processing-subtitle">Extracting travel details with AI</p>
      </div>
    </div>
  `;
}

async function parseReceipt() {
  try {
    const accessCode = getStoredAccessCode(currentTripId);

    // Build request body based on input type
    const requestBody = {
      tripId: currentTripId,
      accessCode
    };

    if (currentImage) {
      requestBody.image = currentImage.data;
      requestBody.imageType = currentImage.type;
    } else if (currentText) {
      requestBody.text = currentText;
    }

    const response = await fetch(`${API_BASE}/receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to parse receipt');
    }

    extractedEvents = result.events || [];

    // Fetch existing events to find potential matches
    await fetchExistingEvents();

    // Find matches between extracted and existing events
    matchEventsWithExisting();

    showReviewStep(result);

  } catch (err) {
    console.error('[ReceiptUpload] Parse error:', err);
    showErrorStep(err.message);
  }
}

// ========================================
// EVENT MATCHING
// ========================================

async function fetchExistingEvents() {
  try {
    const accessCode = getStoredAccessCode(currentTripId);
    const response = await fetch(
      `${API_BASE}/events?tripId=${encodeURIComponent(currentTripId)}&accessCode=${encodeURIComponent(accessCode)}`
    );

    if (response.ok) {
      const data = await response.json();
      existingEvents = data.events || [];
      console.log('[ReceiptUpload] Fetched', existingEvents.length, 'existing events');
    }
  } catch (err) {
    console.error('[ReceiptUpload] Failed to fetch existing events:', err);
    existingEvents = [];
  }
}

function matchEventsWithExisting() {
  for (const extracted of extractedEvents) {
    extracted.matchedEvent = null;
    extracted.matchType = null;

    for (const existing of existingEvents) {
      const match = checkEventMatch(extracted, existing);
      if (match) {
        extracted.matchedEvent = existing;
        extracted.matchType = match;
        break;
      }
    }
  }
}

function checkEventMatch(extracted, existing) {
  // Must be same type
  if (extracted.type !== existing.type) return null;

  // Check date match (same date or within 1 day for multi-day events)
  const dateMatch = extracted.date === existing.date;

  // Flight matching: check flight code, or from/to airports
  if (extracted.type === 'flight') {
    // Exact flight code match
    if (extracted.flightCode && existing.flightCode) {
      const extractedCode = extracted.flightCode.replace(/\s+/g, '').toUpperCase();
      const existingCode = existing.flightCode.replace(/\s+/g, '').toUpperCase();
      if (extractedCode === existingCode) {
        return 'exact';
      }
    }

    // Same route on same date
    if (dateMatch && extracted.from && extracted.to && existing.from && existing.to) {
      const sameRoute =
        extracted.from.toUpperCase() === existing.from.toUpperCase() &&
        extracted.to.toUpperCase() === existing.to.toUpperCase();
      if (sameRoute) {
        return 'route';
      }
    }
  }

  // Hotel matching: check hotel name or check-in date
  if (extracted.type === 'hotel') {
    if (extracted.hotelName && existing.title) {
      const extractedName = extracted.hotelName.toLowerCase();
      const existingName = existing.title.toLowerCase();
      if (extractedName.includes(existingName) || existingName.includes(extractedName)) {
        return 'name';
      }
    }
    if (dateMatch) {
      return 'date';
    }
  }

  // Activity/meal matching: same date and similar title
  if (dateMatch && extracted.title && existing.title) {
    const extractedTitle = extracted.title.toLowerCase();
    const existingTitle = existing.title.toLowerCase();

    // Check for significant word overlap
    const extractedWords = extractedTitle.split(/\s+/).filter(w => w.length > 3);
    const existingWords = existingTitle.split(/\s+/).filter(w => w.length > 3);

    const overlap = extractedWords.filter(w => existingWords.some(ew => ew.includes(w) || w.includes(ew)));
    if (overlap.length >= 1) {
      return 'title';
    }
  }

  return null;
}

// ========================================
// STEP 3: REVIEW
// ========================================

function showReviewStep(result) {
  const body = document.getElementById('receiptUploadBody');

  if (extractedEvents.length === 0) {
    body.innerHTML = `
      <div class="receipt-review-step">
        <div class="review-empty">
          <span class="material-symbols-outlined">search_off</span>
          <h4>No events found</h4>
          <p>${result.notes || "We couldn't extract any travel events from this image."}</p>
          <button class="btn secondary" onclick="showUploadStep()">
            <span class="material-symbols-outlined">arrow_back</span>
            Try another image
          </button>
        </div>
      </div>
    `;
    // Re-expose showUploadStep to window for onclick
    window.showUploadStep = showUploadStep;
    return;
  }

  body.innerHTML = `
    <div class="receipt-review-step">
      <div class="review-header">
        <span class="material-symbols-outlined success-icon">check_circle</span>
        <div>
          <h4>Found ${extractedEvents.length} event${extractedEvents.length > 1 ? 's' : ''}</h4>
          <p class="confidence-badge ${result.confidence}">Confidence: ${result.confidence}</p>
        </div>
      </div>

      <div class="extracted-events-list">
        ${extractedEvents.map((event, i) => renderExtractedEvent(event, i)).join('')}
      </div>

      ${result.notes ? `<p class="review-notes"><span class="material-symbols-outlined">info</span> ${result.notes}</p>` : ''}

      <div class="review-actions">
        <button class="btn secondary" onclick="showUploadStep()">
          <span class="material-symbols-outlined">arrow_back</span>
          Back
        </button>
        <button class="btn primary" onclick="saveExtractedEvents()">
          <span class="material-symbols-outlined">add</span>
          Add ${extractedEvents.length} Event${extractedEvents.length > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  `;

  // Expose functions to window for onclick handlers
  window.showUploadStep = showUploadStep;
  window.saveExtractedEvents = saveExtractedEvents;
  window.toggleEventSelection = toggleEventSelection;
  window.editExtractedEvent = editExtractedEvent;
  window.setMatchAction = setMatchAction;
}

function renderExtractedEvent(event, index) {
  const icon = getEventIcon(event.type);
  const dateStr = event.date ? formatDate(event.date) : 'Date TBD';
  const timeStr = event.time || '';
  const hasMatch = event.matchedEvent;

  // Build match badge if there's a matching existing event
  let matchBadge = '';
  if (hasMatch) {
    const matchLabel = getMatchLabel(event.matchType, event.matchedEvent);
    matchBadge = `
      <div class="match-indicator">
        <span class="material-symbols-outlined">link</span>
        <span class="match-label">Matches: ${escapeHtml(matchLabel)}</span>
        <select id="match-action-${index}" class="match-action-select" onchange="setMatchAction(${index}, this.value)">
          <option value="update">Update existing</option>
          <option value="create">Create new</option>
          <option value="skip">Skip</option>
        </select>
      </div>
    `;
  }

  return `
    <div class="extracted-event-card ${hasMatch ? 'has-match' : ''}" data-index="${index}">
      <div class="event-checkbox">
        <input type="checkbox" id="event-${index}" checked onchange="toggleEventSelection(${index})">
      </div>
      <div class="event-icon ${event.type}">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <div class="event-details">
        <h5>${escapeHtml(event.title)}</h5>
        <p class="event-meta">
          <span class="material-symbols-outlined">calendar_today</span>
          ${dateStr}
          ${timeStr ? `<span class="material-symbols-outlined">schedule</span> ${timeStr}` : ''}
        </p>
        ${event.location ? `<p class="event-location"><span class="material-symbols-outlined">location_on</span> ${escapeHtml(event.location)}</p>` : ''}
        ${event.flightCode ? `<p class="event-flight"><span class="material-symbols-outlined">flight</span> ${escapeHtml(event.flightCode)} &bull; ${escapeHtml(event.from)} → ${escapeHtml(event.to)}</p>` : ''}
        ${matchBadge}
      </div>
      <button class="edit-event-btn" onclick="editExtractedEvent(${index})" title="Edit">
        <span class="material-symbols-outlined">edit</span>
      </button>
    </div>
  `;
}

function getMatchLabel(matchType, matchedEvent) {
  const title = matchedEvent.title || 'Existing event';
  switch (matchType) {
    case 'exact':
      return `${title} (exact match)`;
    case 'route':
      return `${title} (same route)`;
    case 'name':
      return `${title} (same name)`;
    case 'date':
    case 'title':
      return title;
    default:
      return title;
  }
}

function setMatchAction(index, action) {
  extractedEvents[index].matchAction = action;
  const card = document.querySelector(`.extracted-event-card[data-index="${index}"]`);
  const checkbox = document.getElementById(`event-${index}`);

  if (action === 'skip') {
    card.classList.add('deselected');
    checkbox.checked = false;
  } else {
    card.classList.remove('deselected');
    checkbox.checked = true;
  }
}

function toggleEventSelection(index) {
  const checkbox = document.getElementById(`event-${index}`);
  const card = document.querySelector(`.extracted-event-card[data-index="${index}"]`);
  if (card) {
    card.classList.toggle('deselected', !checkbox.checked);
  }
}

function editExtractedEvent(index) {
  // TODO: Implement inline editing
  console.log('Edit event:', index, extractedEvents[index]);
  alert('Event editing coming soon! For now, you can edit after adding.');
}

// ========================================
// STEP 4: SAVE
// ========================================

async function saveExtractedEvents() {
  // Get selected events
  const selectedEvents = extractedEvents.filter((_, i) => {
    const checkbox = document.getElementById(`event-${i}`);
    return checkbox && checkbox.checked;
  });

  if (selectedEvents.length === 0) {
    alert('Please select at least one event to add.');
    return;
  }

  const btn = document.querySelector('.review-actions .btn.primary');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span> Saving...';
  }

  try {
    const accessCode = getStoredAccessCode(currentTripId);
    let savedCount = 0;
    let updatedCount = 0;

    for (const event of selectedEvents) {
      // Determine if we should update an existing event or create new
      const shouldUpdate = event.matchedEvent && event.matchAction !== 'create';
      const existingId = shouldUpdate ? event.matchedEvent.id : null;

      // Convert to our event format
      // API requires: date, time, type, title
      const eventData = {
        date: event.date || new Date().toISOString().split('T')[0], // Default to today if missing
        time: event.time || event.departureTime || '09:00', // Default time if missing
        endTime: event.endTime || event.arrivalTime || null,
        type: event.type || 'activity',
        title: event.title,
        subtitle: event.details || null,
        where: event.location || null,
        status: 'confirmed',
        travelers: ['all'],
        isUserGenerated: true,
        // Flight-specific fields
        flightCode: event.flightCode || null,
        airline: event.airline || null,
        from: event.from || null,
        to: event.to || null,
        // Hotel-specific fields
        address: event.address || null
      };

      let url, method;
      if (shouldUpdate && existingId) {
        // Update existing event
        url = `${API_BASE}/events/${existingId}?tripId=${encodeURIComponent(currentTripId)}&accessCode=${encodeURIComponent(accessCode)}`;
        method = 'PUT';
      } else {
        // Create new event
        url = `${API_BASE}/events?tripId=${encodeURIComponent(currentTripId)}&accessCode=${encodeURIComponent(accessCode)}`;
        method = 'POST';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });

      if (response.ok) {
        if (shouldUpdate) {
          updatedCount++;
        } else {
          savedCount++;
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to save event:', event.title, 'Error:', errorData.error || response.status);
      }
    }

    showSuccessStep(savedCount, updatedCount);

  } catch (err) {
    console.error('[ReceiptUpload] Save error:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined">add</span> Add Events';
    }
    alert('Failed to save events: ' + err.message);
  }
}

// ========================================
// SUCCESS STEP
// ========================================

function showSuccessStep(createdCount, updatedCount = 0) {
  const body = document.getElementById('receiptUploadBody');
  const total = createdCount + updatedCount;

  let message = '';
  if (createdCount > 0 && updatedCount > 0) {
    message = `Added ${createdCount} new event${createdCount > 1 ? 's' : ''} and updated ${updatedCount} existing event${updatedCount > 1 ? 's' : ''}!`;
  } else if (updatedCount > 0) {
    message = `Updated ${updatedCount} event${updatedCount > 1 ? 's' : ''}!`;
  } else {
    message = `Added ${createdCount} event${createdCount > 1 ? 's' : ''}!`;
  }

  body.innerHTML = `
    <div class="receipt-success-step">
      <span class="material-symbols-outlined success-icon">celebration</span>
      <h4>${message}</h4>
      <p>Your itinerary has been updated.</p>
      <div class="success-actions">
        <button class="btn secondary" onclick="showUploadStep()">
          <span class="material-symbols-outlined">add</span>
          Add more
        </button>
        <button class="btn primary" onclick="closeReceiptUploadModal(); if(window.refreshTripData) window.refreshTripData();">
          <span class="material-symbols-outlined">done</span>
          Done
        </button>
      </div>
    </div>
  `;

  window.showUploadStep = showUploadStep;
}

// ========================================
// ERROR STEP
// ========================================

function showErrorStep(message) {
  const body = document.getElementById('receiptUploadBody');
  body.innerHTML = `
    <div class="receipt-error-step">
      <span class="material-symbols-outlined error-icon">error</span>
      <h4>Something went wrong</h4>
      <p>${escapeHtml(message)}</p>
      <button class="btn secondary" onclick="showUploadStep()">
        <span class="material-symbols-outlined">arrow_back</span>
        Try again
      </button>
    </div>
  `;

  window.showUploadStep = showUploadStep;
}

// ========================================
// HELPERS
// ========================================

function getEventIcon(type) {
  const icons = {
    flight: 'flight',
    hotel: 'hotel',
    activity: 'local_activity',
    meal: 'restaurant',
    transport: 'directions_car',
    other: 'event'
  };
  return icons[type] || 'event';
}

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
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
