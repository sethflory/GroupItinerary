// ========================================
// EVENT FORM (ADD/EDIT/DELETE)
// ========================================

import { currentTripId } from '../state.js';
import { isFeatureEnabled } from '../config.js';
import { getStoredAccessCode } from '../auth.js';
import { createEvent, updateEvent, deleteEventAPI } from '../api.js';

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

  document.getElementById('eventFormTitle').innerHTML = '<span class="material-symbols-outlined">add_circle</span> Add Event';
  document.getElementById('eventFormSubmitBtn').textContent = 'Add Event';
  document.getElementById('eventFormDeleteBtn').style.display = 'none';
  document.getElementById('eventForm').reset();
  document.getElementById('eventFormId').value = '';
  document.getElementById('eventFormOriginalDate').value = date;

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

  if (isFeatureEnabled('USE_TABLE_STORAGE')) {
    try {
      if (dateChanged) {
        await deleteEventAPI(currentTripId, editingEventId);
        await createEvent(currentTripId, { ...eventData, id: editingEventId });
      } else if (editingEventId) {
        await updateEvent(currentTripId, editingEventId, eventData);
      } else {
        await createEvent(currentTripId, eventData);
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
        const newEvent = {
          id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
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
