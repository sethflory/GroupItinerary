// ========================================
// EVENT FORM (ADD/EDIT/DELETE)
// ========================================

import { currentTripId } from '../state.js';
import { isFeatureEnabled } from '../config.js';
import { getStoredAccessCode } from '../auth.js';
import { createEvent, updateEvent, deleteEventAPI, searchImages, searchPlacePhotos } from '../api.js';

// Image search state
let selectedImages = []; // Array of selected images
let isSearching = false;
let imageSource = 'places'; // 'places' or 'unsplash'
const MAX_IMAGES = 5;

let DAYS, TRAVELERS;
let editingEventId = null;
let editingEventDate = null;
let selectedEventTravelers = ['all'];

export function setEventsDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
}

export function populateDayDropdown(selectedDate) {
  const select = document.getElementById('eventFormDate');
  select.innerHTML = DAYS.map(d =>
    `<option value="${d.date}" ${d.date === selectedDate ? 'selected' : ''}>${d.label} - ${d.theme}</option>`
  ).join('');
}

export function openAddEventForm(date) {
  editingEventId = null;
  editingEventDate = date;
  selectedEventTravelers = ['all'];
  selectedImages = [];

  document.getElementById('eventFormTitle').innerHTML = '<span class="material-symbols-outlined">add_circle</span> Add Event';
  document.getElementById('eventFormSubmitBtn').textContent = 'Add Event';
  document.getElementById('eventFormDeleteBtn').style.display = 'none';
  document.getElementById('eventForm').reset();
  document.getElementById('eventFormId').value = '';
  document.getElementById('eventFormOriginalDate').value = date;

  // Clear image search state
  clearImageSearch();
  setupImageSearchKeyHandler();

  populateDayDropdown(date);
  renderEventFormTravelers();

  document.getElementById('eventFormModal').classList.add('active');
}

export function openEditEventForm(eventId) {
  const day = DAYS.find(d => d.events.some(e => e.id === eventId));
  if (!day) return;
  const event = day.events.find(e => e.id === eventId);
  if (!event) return;

  editingEventId = eventId;
  editingEventDate = day.date;
  selectedEventTravelers = Array.isArray(event.travelers) ? [...event.travelers] : ['all'];

  document.getElementById('eventFormTitle').innerHTML = '<span class="material-symbols-outlined">edit</span> Edit Event';
  document.getElementById('eventFormSubmitBtn').textContent = 'Save Changes';
  document.getElementById('eventFormDeleteBtn').style.display = 'block';
  document.getElementById('eventFormId').value = eventId;
  document.getElementById('eventFormOriginalDate').value = day.date;
  document.getElementById('eventFormTitleInput').value = event.title || '';
  document.getElementById('eventFormType').value = event.type || 'activity';
  document.getElementById('eventFormTime').value = event.time || '';
  document.getElementById('eventFormEndTime').value = event.endTime || '';
  document.getElementById('eventFormSubtitle').value = event.subtitle || '';
  document.getElementById('eventFormWhere').value = event.where || '';
  document.getElementById('eventFormStatus').value = event.status || 'confirmed';
  document.getElementById('eventFormDetails').value = event.details || '';

  // Handle existing images
  clearImageSearch();
  setupImageSearchKeyHandler();

  // Support both old single image and new array format
  if (event.linkedPhotos && event.linkedPhotos.length > 0) {
    selectedImages = event.linkedPhotos.map(p =>
      typeof p === 'string' ? { url: p, thumb: p, credit: '' } : p
    );
  } else if (event.linkedPhotoUrl) {
    selectedImages = [{ url: event.linkedPhotoUrl, thumb: event.linkedPhotoUrl, credit: '' }];
  } else {
    selectedImages = [];
  }

  renderSelectedImages();

  populateDayDropdown(day.date);
  renderEventFormTravelers();

  document.getElementById('eventFormModal').classList.add('active');
}

export function closeEventForm() {
  document.getElementById('eventFormModal').classList.remove('active');
  editingEventId = null;
  editingEventDate = null;

  // Clear linked photo input if present
  const linkedPhotoInput = document.getElementById('eventFormLinkedPhoto');
  if (linkedPhotoInput) {
    linkedPhotoInput.value = '';
  }
}

function renderEventFormTravelers() {
  const container = document.getElementById('eventFormTravelers');
  const options = [
    { id: 'all', label: 'Everyone' },
    ...TRAVELERS.map(t => ({ id: t.id, label: t.name }))
  ];

  container.innerHTML = options.map(opt => `
    <div class="event-form-traveler ${selectedEventTravelers.includes(opt.id) ? 'selected' : ''}"
         onclick="toggleEventTraveler('${opt.id}')">
      ${opt.label}
    </div>
  `).join('');
}

export function toggleEventTraveler(id) {
  if (id === 'all') {
    if (selectedEventTravelers.includes('all')) {
      selectedEventTravelers = [];
    } else {
      selectedEventTravelers = ['all'];
    }
  } else {
    selectedEventTravelers = selectedEventTravelers.filter(t => t !== 'all');

    if (selectedEventTravelers.includes(id)) {
      selectedEventTravelers = selectedEventTravelers.filter(t => t !== id);
    } else {
      selectedEventTravelers.push(id);
    }

    if (selectedEventTravelers.length === 0) {
      selectedEventTravelers = ['all'];
    }

    if (selectedEventTravelers.length === TRAVELERS.length) {
      selectedEventTravelers = ['all'];
    }
  }

  renderEventFormTravelers();
}

export async function submitEventForm(e) {
  e.preventDefault();

  const newDate = document.getElementById('eventFormDate').value;
  const originalDate = document.getElementById('eventFormOriginalDate').value;
  const dateChanged = editingEventId && newDate !== originalDate;

  // Build linked photos array (keep backwards compatible with linkedPhotoUrl)
  const linkedPhotos = selectedImages.length > 0 ? selectedImages : null;
  const linkedPhotoUrl = linkedPhotos?.[0]?.url || null; // Keep for backwards compatibility

  const eventData = {
    title: document.getElementById('eventFormTitleInput').value,
    type: document.getElementById('eventFormType').value,
    time: document.getElementById('eventFormTime').value,
    endTime: document.getElementById('eventFormEndTime').value || null,
    subtitle: document.getElementById('eventFormSubtitle').value || null,
    where: document.getElementById('eventFormWhere').value || null,
    status: document.getElementById('eventFormStatus').value,
    details: document.getElementById('eventFormDetails').value || null,
    travelers: selectedEventTravelers,
    date: newDate,
    isUserGenerated: true,
    linkedPhotoUrl,
    linkedPhotos
  };

  let createdEvent = null;
  if (isFeatureEnabled('USE_TABLE_STORAGE')) {
    try {
      if (dateChanged) {
        await deleteEventAPI(currentTripId, editingEventId);
        createdEvent = await createEvent(currentTripId, { ...eventData, id: editingEventId });
      } else if (editingEventId) {
        await updateEvent(currentTripId, editingEventId, eventData);
      } else {
        createdEvent = await createEvent(currentTripId, eventData);
      }
    } catch (err) {
      alert('Failed to save event: ' + err.message);
      return;
    }
  }

  // Update local data
  if (dateChanged) {
    const oldDay = DAYS.find(d => d.date === originalDate);
    if (oldDay) {
      const existingEvent = oldDay.events.find(e => e.id === editingEventId);
      oldDay.events = oldDay.events.filter(e => e.id !== editingEventId);

      const newDay = DAYS.find(d => d.date === newDate);
      if (newDay) {
        newDay.events.push({ ...existingEvent, ...eventData });
        newDay.events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      }
    }
  } else {
    const day = DAYS.find(d => d.date === newDate);
    if (day) {
      if (editingEventId) {
        const eventIndex = day.events.findIndex(e => e.id === editingEventId);
        if (eventIndex >= 0) {
          day.events[eventIndex] = { ...day.events[eventIndex], ...eventData };
        }
      } else {
        // Use the ID from the API response if available, otherwise generate one
        const newEventId = createdEvent?.id || ('evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
        const newEvent = {
          id: newEventId,
          ...eventData
        };
        day.events.push(newEvent);
        day.events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      }
    }
  }

  closeEventForm();

  // Trigger re-render (will be called by app.js)
  if (window.renderDayDetail) window.renderDayDetail();
  if (window.renderListView) window.renderListView();
}

export async function deleteEventFromForm() {
  if (!editingEventId) return;

  if (!confirm('Are you sure you want to delete this event?')) {
    return;
  }

  if (isFeatureEnabled('USE_TABLE_STORAGE')) {
    try {
      await deleteEventAPI(currentTripId, editingEventId);
    } catch (err) {
      alert('Failed to delete event: ' + err.message);
      return;
    }
  }

  const day = DAYS.find(d => d.date === editingEventDate);
  if (day) {
    day.events = day.events.filter(e => e.id !== editingEventId);
  }

  closeEventForm();
  if (window.renderDayDetail) window.renderDayDetail();
  if (window.renderListView) window.renderListView();
}

export async function deleteEvent(eventId) {
  if (!confirm('Are you sure you want to delete this event?')) {
    return;
  }

  const day = DAYS.find(d => d.events.some(e => e.id === eventId));
  if (!day) return;

  if (isFeatureEnabled('USE_TABLE_STORAGE')) {
    try {
      await deleteEventAPI(currentTripId, eventId);
    } catch (err) {
      alert('Failed to delete event: ' + err.message);
      return;
    }
  }

  day.events = day.events.filter(e => e.id !== eventId);

  if (window.renderDayDetail) window.renderDayDetail();
  if (window.renderListView) window.renderListView();
}

// ========================================
// IMAGE SEARCH
// ========================================

export function setImageSource(source) {
  imageSource = source;

  // Update button states
  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.source === source);
  });

  // Update hint text
  const hint = document.getElementById('imageSearchHint');
  if (hint) {
    hint.textContent = source === 'places'
      ? 'Search Google Places for venue photos, or click ✨ to use event title'
      : 'Search Unsplash for stock photos, or click ✨ to use event title';
  }

  // Update placeholder
  const queryInput = document.getElementById('eventImageQuery');
  if (queryInput) {
    queryInput.placeholder = source === 'places'
      ? 'Search venue name (e.g., "Acropolis Museum")...'
      : 'Search keywords (e.g., "greek sunset")...';
  }

  // Clear results when switching
  const resultsContainer = document.getElementById('imageSearchResults');
  if (resultsContainer) resultsContainer.innerHTML = '';
}

export async function searchEventImages() {
  const queryInput = document.getElementById('eventImageQuery');
  const resultsContainer = document.getElementById('imageSearchResults');
  const query = queryInput?.value?.trim();

  if (!query || query.length < 2) {
    resultsContainer.innerHTML = '<div class="image-search-empty">Enter at least 2 characters to search</div>';
    return;
  }

  if (isSearching) return;
  isSearching = true;

  const sourceLabel = imageSource === 'places' ? 'Google Places' : 'Unsplash';
  resultsContainer.innerHTML = `<div class="image-search-loading"><span class="material-symbols-outlined spinning">progress_activity</span> Searching ${sourceLabel}...</div>`;

  try {
    if (imageSource === 'places') {
      // Google Places search
      const result = await searchPlacePhotos(currentTripId, query, { count: 6 });

      if (!result.place) {
        resultsContainer.innerHTML = '<div class="image-search-empty">Place not found. Try a more specific name.</div>';
        return;
      }

      if (result.photos.length === 0) {
        resultsContainer.innerHTML = `<div class="image-search-empty">No photos for "${result.place.name}". Try Unsplash instead.</div>`;
        return;
      }

      // Show place info
      const placeInfo = `<div class="image-search-place-info">
        <span class="material-symbols-outlined">location_on</span>
        <strong>${escapeHtml(result.place.name)}</strong>
        ${result.place.address ? `<span class="place-address">${escapeHtml(result.place.address)}</span>` : ''}
      </div>`;

      resultsContainer.innerHTML = placeInfo + result.photos.map(photo => {
        const credit = photo.attributions?.[0]?.name || 'Google';
        const creditUrl = photo.attributions?.[0]?.url || '';
        return `
          <div class="image-search-item" onclick="selectEventImage('${photo.url}', '${photo.thumb}', '${escapeAttr(credit)}', '${escapeAttr(creditUrl)}')">
            <img src="${photo.thumb}" alt="Photo of ${escapeAttr(result.place.name)}" loading="lazy">
          </div>
        `;
      }).join('');

    } else {
      // Unsplash search
      const images = await searchImages(currentTripId, query, { count: 8 });

      if (images.length === 0) {
        resultsContainer.innerHTML = '<div class="image-search-empty">No images found. Try different keywords.</div>';
        return;
      }

      resultsContainer.innerHTML = images.map(img => `
        <div class="image-search-item" onclick="selectEventImage('${img.url}', '${img.thumb}', '${escapeAttr(img.credit)}', '${escapeAttr(img.creditUrl || '')}')">
          <img src="${img.thumb}" alt="${escapeAttr(img.description || '')}" loading="lazy">
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('[Events] Image search error:', err);
    resultsContainer.innerHTML = `<div class="image-search-error">Search failed: ${err.message}</div>`;
  } finally {
    isSearching = false;
  }
}

export function selectEventImage(url, thumb, credit, creditUrl) {
  // Check if already selected
  if (selectedImages.some(img => img.url === url)) {
    return;
  }

  // Check max limit
  if (selectedImages.length >= MAX_IMAGES) {
    alert(`Maximum ${MAX_IMAGES} images allowed`);
    return;
  }

  selectedImages.push({ url, thumb, credit, creditUrl });
  renderSelectedImages();

  // Mark as selected in results
  const resultItems = document.querySelectorAll('.image-search-item');
  resultItems.forEach(item => {
    if (item.querySelector(`img[src="${thumb}"]`)) {
      item.classList.add('selected');
    }
  });
}

export function removeSelectedImage(index) {
  selectedImages.splice(index, 1);
  renderSelectedImages();
}

export function clearSelectedImages() {
  selectedImages = [];
  renderSelectedImages();
}

function renderSelectedImages() {
  const container = document.getElementById('selectedImagesPreview');
  if (!container) return;

  if (selectedImages.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = selectedImages.map((img, index) => `
    <div class="selected-image-item">
      <img src="${img.thumb || img.url}" alt="Selected ${index + 1}">
      <button type="button" class="remove-image-btn" onclick="removeSelectedImage(${index})">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
  `).join('') + `
    <div class="selected-images-count">${selectedImages.length}/${MAX_IMAGES}</div>
  `;
}

// Legacy function for backwards compatibility
export function clearSelectedImage() {
  clearSelectedImages();
}

function clearImageSearch() {
  selectedImages = [];
  const queryInput = document.getElementById('eventImageQuery');
  const resultsContainer = document.getElementById('imageSearchResults');
  const previewContainer = document.getElementById('selectedImagesPreview');

  if (queryInput) queryInput.value = '';
  if (resultsContainer) resultsContainer.innerHTML = '';
  if (previewContainer) {
    previewContainer.style.display = 'none';
    previewContainer.innerHTML = '';
  }
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
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

function setupImageSearchKeyHandler() {
  const queryInput = document.getElementById('eventImageQuery');
  if (queryInput) {
    queryInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchEventImages();
      }
    };
  }
}

export function suggestImageFromTitle() {
  const titleInput = document.getElementById('eventFormTitleInput');
  const queryInput = document.getElementById('eventImageQuery');
  const type = document.getElementById('eventFormType')?.value;

  if (titleInput && queryInput) {
    let query = titleInput.value.trim();

    // Enhance query based on event type
    if (type === 'meal' && !query.toLowerCase().includes('restaurant') && !query.toLowerCase().includes('food')) {
      query += ' restaurant food';
    } else if (type === 'hotel' && !query.toLowerCase().includes('hotel')) {
      query += ' hotel room';
    } else if (type === 'flight' && !query.toLowerCase().includes('airport') && !query.toLowerCase().includes('plane')) {
      query += ' airplane travel';
    }

    queryInput.value = query;
    if (query.length >= 2) {
      searchEventImages();
    }
  }
}
