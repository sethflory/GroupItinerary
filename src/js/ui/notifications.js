// ========================================
// NOTIFICATION TICKER UI
// ========================================

import { fetchNotifications } from '../api.js';
import { currentTripId } from '../state.js';

let notificationQueue = [];
let isTickerVisible = false;
let tickerTimeout = null;
let pollInterval = null;
let lastNotificationTime = null;

// Initialize the notification system
export function initNotifications() {
  // Create ticker element if it doesn't exist
  if (!document.getElementById('notificationTicker')) {
    createTickerElement();
  }

  // Start polling for notifications
  startPolling();
}

// Create the ticker DOM element
function createTickerElement() {
  const ticker = document.createElement('div');
  ticker.id = 'notificationTicker';
  ticker.className = 'notification-ticker';
  ticker.innerHTML = `
    <div class="notification-ticker-content">
      <span class="notification-icon"></span>
      <span class="notification-message"></span>
    </div>
  `;

  // Insert after activity pills or context bar
  const activityPills = document.getElementById('activityPills');
  const contextBar = document.querySelector('.context-bar-wrapper');
  const insertAfter = activityPills || contextBar;

  if (insertAfter && insertAfter.parentNode) {
    insertAfter.parentNode.insertBefore(ticker, insertAfter.nextSibling);
  } else {
    // Fallback: insert at beginning of main content
    const main = document.querySelector('.main-content');
    if (main) {
      main.insertBefore(ticker, main.firstChild);
    }
  }

  // Click handler to open related modal
  ticker.addEventListener('click', handleTickerClick);
}

// Start polling for new notifications
function startPolling() {
  // Initial fetch
  fetchAndDisplayNotifications();

  // Poll every 30 seconds
  pollInterval = setInterval(fetchAndDisplayNotifications, 30000);
}

// Stop polling
export function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Fetch notifications from API and display new ones
async function fetchAndDisplayNotifications() {
  const tripId = currentTripId;
  if (!tripId) return;

  try {
    const options = lastNotificationTime ? { since: lastNotificationTime } : { limit: 5 };
    const notifications = await fetchNotifications(tripId, options);

    if (notifications.length > 0) {
      // Update last notification time
      lastNotificationTime = notifications[0].createdAt;

      // Add new notifications to queue (reverse to show oldest first)
      const newNotifs = notifications.reverse();
      notificationQueue.push(...newNotifs);

      // Display if not currently showing
      if (!isTickerVisible) {
        showNextNotification();
      }
    }
  } catch (err) {
    console.warn('[Notifications] Failed to fetch:', err.message);
  }
}

// Show the next notification in queue
function showNextNotification() {
  if (notificationQueue.length === 0) {
    hideTicker();
    return;
  }

  const notification = notificationQueue.shift();
  displayNotification(notification);

  // Auto-hide after 5 seconds, then show next
  tickerTimeout = setTimeout(() => {
    showNextNotification();
  }, 5000);
}

// Display a single notification in the ticker
function displayNotification(notification) {
  const ticker = document.getElementById('notificationTicker');
  if (!ticker) return;

  const iconEl = ticker.querySelector('.notification-icon');
  const messageEl = ticker.querySelector('.notification-message');

  iconEl.textContent = notification.icon || '🔔';
  messageEl.textContent = notification.message;

  // Store related ID for click handling
  ticker.dataset.type = notification.type;
  ticker.dataset.relatedId = notification.relatedId || '';

  // Show with animation
  ticker.classList.add('visible');
  isTickerVisible = true;
}

// Hide the ticker
function hideTicker() {
  const ticker = document.getElementById('notificationTicker');
  if (ticker) {
    ticker.classList.remove('visible');
  }
  isTickerVisible = false;

  if (tickerTimeout) {
    clearTimeout(tickerTimeout);
    tickerTimeout = null;
  }
}

// Handle click on ticker to open related modal
function handleTickerClick(event) {
  const ticker = event.currentTarget;
  const type = ticker.dataset.type;
  const relatedId = ticker.dataset.relatedId;

  // Open appropriate modal based on notification type
  switch (type) {
    case 'hunt_started':
    case 'hunt_item_claimed':
    case 'hunt_ended':
      if (typeof window.openScavengerHunt === 'function') {
        window.openScavengerHunt(relatedId);
      }
      break;

    case 'trivia_starting':
    case 'trivia_answer':
      if (typeof window.openTrivia === 'function') {
        window.openTrivia();
      }
      break;

    case 'poll_result':
    case 'poll_created':
      if (typeof window.openDinnerPollModal === 'function') {
        window.openDinnerPollModal();
      }
      break;

    case 'photo_uploaded':
      // Scroll to photo ribbon or open gallery
      const photoRibbon = document.getElementById('photoRibbon');
      if (photoRibbon) {
        photoRibbon.scrollIntoView({ behavior: 'smooth' });
      }
      break;

    default:
      // No specific action
      break;
  }

  // Hide ticker after click
  hideTicker();
}

// Manually push a notification (for local events)
export function pushNotification(notification) {
  notificationQueue.push(notification);

  if (!isTickerVisible) {
    showNextNotification();
  }
}

// Clear all notifications
export function clearNotifications() {
  notificationQueue = [];
  hideTicker();
}

// Expose for global access
window.pushNotification = pushNotification;
