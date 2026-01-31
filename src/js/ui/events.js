// ========================================
// EVENT FORM (ADD/EDIT/DELETE)
// ========================================

import { currentTripId } from '../state.js';
import { isFeatureEnabled } from '../config.js';
import { getStoredAccessCode } from '../auth.js';
import { createEvent, updateEvent, deleteEventAPI, searchImages } from '../api.js';

// Image search state
let selectedImage = null;
let isSearching = false;

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
  selectedImage = null;

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

  // Handle existing image
  clearImageSearch();
  setupImageSearchKeyHandler();

  if (event.linkedPhotoUrl) {
    selectedImage = { url: event.linkedPhotoUrl, thumb: event.linkedPhotoUrl };
    document.getElementById('eventFormLinkedPhoto').value = event.linkedPhotoUrl;

    const preview = document.getElementById('selectedImagePreview');
    const img = document.getElementById('selectedImageImg');
    const creditEl = document.getElementById('selectedImageCredit');

    img.src = event.linkedPhotoUrl;
    creditEl.innerHTML = 'Existing image';
    preview.style.display = 'block';
  }

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

  // Get linked photo URL if present (from "Add Moment" feature)
  const linkedPhotoInput = document.getElementById('eventFormLinkedPhoto');
  const linkedPhotoUrl = linkedPhotoInput?.value || null;

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
    linkedPhotoUrl
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

  resultsContainer.innerHTML = '<div class="image-search-loading"><span class="material-symbols-outlined spinning">progress_activity</span> Searching...</div>';

  try {
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

  } catch (err) {
    console.error('[Events] Image search error:', err);
    resultsContainer.innerHTML = `<div class="image-search-error">Search failed: ${err.message}</div>`;
  } finally {
    isSearching = false;
  }
}

export function selectEventImage(url, thumb, credit, creditUrl) {
  selectedImage = { url, thumb, credit, creditUrl };

  // Update hidden input
  document.getElementById('eventFormLinkedPhoto').value = url;

  // Show preview
  const preview = document.getElementById('selectedImagePreview');
  const img = document.getElementById('selectedImageImg');
  const creditEl = document.getElementById('selectedImageCredit');

  img.src = thumb || url;
  creditEl.innerHTML = creditUrl
    ? `Photo by <a href="${creditUrl}" target="_blank" rel="noopener">${credit}</a> on Unsplash`
    : `Photo by ${credit} on Unsplash`;

  preview.style.display = 'block';

  // Clear search results
  document.getElementById('imageSearchResults').innerHTML = '';
  document.getElementById('eventImageQuery').value = '';
}

export function clearSelectedImage() {
  selectedImage = null;
  document.getElementById('eventFormLinkedPhoto').value = '';
  document.getElementById('selectedImagePreview').style.display = 'none';
  document.getElementById('selectedImageImg').src = '';
}

function clearImageSearch() {
  selectedImage = null;
  const queryInput = document.getElementById('eventImageQuery');
  const resultsContainer = document.getElementById('imageSearchResults');
  const linkedPhotoInput = document.getElementById('eventFormLinkedPhoto');
  const preview = document.getElementById('selectedImagePreview');

  if (queryInput) queryInput.value = '';
  if (resultsContainer) resultsContainer.innerHTML = '';
  if (linkedPhotoInput) linkedPhotoInput.value = '';
  if (preview) preview.style.display = 'none';
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
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
