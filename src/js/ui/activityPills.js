// ========================================
// FLOATING ACTIVITY PILLS
// ========================================

import { currentTripId } from '../state.js';
import { API_BASE } from '../config.js';
import { fetchActiveHunt } from '../api.js';

let TRAVELERS = [];
let pollInterval = null;
let lastActivityState = { games: [], polls: [], hunt: null };

export function setActivityPillsDeps(deps) {
  TRAVELERS = deps.TRAVELERS || [];
}

// ========================================
// FETCH ACTIVE ACTIVITIES
// ========================================

async function fetchActiveGames() {
  try {
    const response = await fetch(`${API_BASE}/sawit/active/${currentTripId}`, {
      headers: {
        'x-trip-id': currentTripId
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.games || [];
  } catch (error) {
    console.error('Error fetching active games:', error);
    return [];
  }
}

async function fetchOpenPolls() {
  try {
    const response = await fetch(`${API_BASE}/polls/open/${currentTripId}`, {
      headers: {
        'x-trip-id': currentTripId
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.polls || [];
  } catch (error) {
    console.error('Error fetching open polls:', error);
    return [];
  }
}

async function fetchActiveScavengerHunt() {
  try {
    const data = await fetchActiveHunt(currentTripId);
    if (data.hunt && data.hunt.status === 'active') {
      const items = data.items || [];
      const foundCount = items.filter(i => i.foundBy).length;
      return {
        ...data.hunt,
        foundCount,
        totalCount: items.length
      };
    }
    return null;
  } catch (error) {
    // Hunt API may not exist yet or no active hunt
    return null;
  }
}

// ========================================
// RENDER PILLS
// ========================================

function renderActivityPills(games, polls, hunt = null) {
  const container = document.getElementById('activityPills');
  if (!container) return;

  // Check if anything changed
  const newState = JSON.stringify({ games, polls, hunt });
  const oldState = JSON.stringify(lastActivityState);

  const hasChanges = newState !== oldState;
  lastActivityState = { games, polls, hunt };

  // Clear and rebuild
  container.innerHTML = '';

  // Render scavenger hunt pill (first, most prominent)
  if (hunt) {
    const pill = document.createElement('button');
    pill.className = 'activity-pill hunt';

    if (hasChanges && !oldState.includes(hunt.id)) {
      pill.classList.add('new');
    }

    // Add pulse when 80%+ complete
    const completionRate = hunt.totalCount > 0 ? hunt.foundCount / hunt.totalCount : 0;
    if (completionRate >= 0.8 && completionRate < 1) {
      pill.classList.add('almost-done');
    }

    const displayName = truncateName(hunt.title || 'Scavenger Hunt', 15);

    pill.innerHTML = `
      <span class="pill-icon">🎯</span>
      <span class="pill-name">${displayName}</span>
      <span class="pill-badge">${hunt.foundCount}/${hunt.totalCount}</span>
    `;

    pill.onclick = () => openScavengerHunt(hunt.id);
    container.appendChild(pill);
  }

  // Render game pills
  games.forEach((game, index) => {
    const pill = document.createElement('button');
    pill.className = 'activity-pill game';

    // Add 'new' class for animation if this is a new game
    if (hasChanges && !oldState.includes(game.id || game.eventId)) {
      pill.classList.add('new');
    }

    const playerCount = game.playerCount || game.sightings?.length || 0;
    const displayName = truncateName(game.eventTitle || game.name || 'Game', 15);

    pill.innerHTML = `
      <span class="pill-icon">🎮</span>
      <span class="pill-name">${displayName}</span>
      <span class="pill-badge">${playerCount}</span>
    `;

    pill.onclick = () => openGame(game.eventId || game.id);
    container.appendChild(pill);
  });

  // Render poll pills
  polls.forEach((poll, index) => {
    const pill = document.createElement('button');
    pill.className = 'activity-pill poll';

    // Add 'new' class for animation if this is a new poll
    if (hasChanges && !oldState.includes(poll.id)) {
      pill.classList.add('new');
    }

    const voteCount = poll.voteCount || 0;
    const totalTravelers = TRAVELERS.length || 4;
    const displayName = truncateName(poll.title || poll.name || 'Poll', 12);

    pill.innerHTML = `
      <span class="pill-icon">🗳️</span>
      <span class="pill-name">${displayName}</span>
      <span class="pill-badge">${voteCount}/${totalTravelers}</span>
    `;

    pill.onclick = () => openPoll(poll.id);
    container.appendChild(pill);
  });
}

function truncateName(name, maxLength) {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 1) + '…';
}

// ========================================
// ACTIONS
// ========================================

function openGame(gameId) {
  // Open the Saw It game modal
  if (typeof window.openSawItGame === 'function') {
    window.openSawItGame(gameId);
  } else if (typeof window.openWhatsYouWillSee === 'function') {
    window.openWhatsYouWillSee(gameId);
  } else {
    console.log('Open game:', gameId);
  }
}

function openPoll(pollId) {
  // Open the poll modal
  if (typeof window.openDinnerPoll === 'function') {
    window.openDinnerPoll(pollId);
  } else if (typeof window.openPollModal === 'function') {
    window.openPollModal(pollId);
  } else {
    console.log('Open poll:', pollId);
  }
}

function openScavengerHunt(huntId) {
  // Open the scavenger hunt modal
  if (typeof window.openScavengerHunt === 'function') {
    window.openScavengerHunt(huntId);
  } else {
    console.log('Open scavenger hunt:', huntId);
  }
}

// ========================================
// POLLING
// ========================================

async function refreshActivities() {
  const [games, polls, hunt] = await Promise.all([
    fetchActiveGames(),
    fetchOpenPolls(),
    fetchActiveScavengerHunt()
  ]);

  renderActivityPills(games, polls, hunt);
}

export function startActivityPolling(intervalMs = 30000) {
  // Initial fetch
  refreshActivities();

  // Set up polling
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  pollInterval = setInterval(refreshActivities, intervalMs);
}

export function stopActivityPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ========================================
// MANUAL UPDATE (for immediate feedback)
// ========================================

export function addGamePill(game) {
  lastActivityState.games.push(game);
  renderActivityPills(lastActivityState.games, lastActivityState.polls);
}

export function addPollPill(poll) {
  lastActivityState.polls.push(poll);
  renderActivityPills(lastActivityState.games, lastActivityState.polls);
}

export function removeGamePill(gameId) {
  lastActivityState.games = lastActivityState.games.filter(g =>
    (g.id || g.eventId) !== gameId
  );
  renderActivityPills(lastActivityState.games, lastActivityState.polls);
}

export function removePollPill(pollId) {
  lastActivityState.polls = lastActivityState.polls.filter(p => p.id !== pollId);
  renderActivityPills(lastActivityState.games, lastActivityState.polls);
}

// ========================================
// DEMO DATA (for development)
// ========================================

export function showDemoPills() {
  const demoGames = [
    { eventId: 'demo1', eventTitle: 'Acropolis Walk', playerCount: 3 },
    { eventId: 'demo2', eventTitle: 'Plaka Hunt', playerCount: 2 }
  ];

  const demoPolls = [
    { id: 'poll1', title: 'Dinner', voteCount: 2 }
  ];

  const demoHunt = {
    id: 'hunt1',
    title: 'Photo Safari',
    foundCount: 3,
    totalCount: 12
  };

  renderActivityPills(demoGames, demoPolls, demoHunt);
}

// ========================================
// INITIALIZATION
// ========================================

export function initActivityPills() {
  // Start polling for activities
  startActivityPolling();

  // Listen for visibility changes to pause/resume polling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopActivityPolling();
    } else {
      startActivityPolling();
    }
  });
}
