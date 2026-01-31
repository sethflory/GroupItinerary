// ========================================
// SCOREBOARD
// ========================================

import { currentTripId, getCurrentTraveler } from '../state.js';
import { API_BASE } from '../config.js';

let TRAVELERS = [];
let cachedScores = null;
let cachedActivity = [];

export function setScoreboardDeps(deps) {
  TRAVELERS = deps.TRAVELERS || [];
}

// ========================================
// FETCH SCORES
// ========================================

async function fetchScores() {
  try {
    const response = await fetch(`${API_BASE}/scores/${currentTripId}`, {
      headers: {
        'x-trip-id': currentTripId
      }
    });

    if (!response.ok) {
      // Return demo data if API not available
      return getDemoScores();
    }

    const data = await response.json();
    cachedScores = data.scores || [];
    cachedActivity = data.recentActivity || [];

    return { scores: cachedScores, activity: cachedActivity };
  } catch (error) {
    console.error('Error fetching scores:', error);
    return getDemoScores();
  }
}

function getDemoScores() {
  // Generate scores from travelers if no API
  const scores = TRAVELERS.map((traveler, index) => ({
    travelerId: traveler.id,
    name: traveler.name,
    points: Math.floor(Math.random() * 50) + 10,
    gamePoints: Math.floor(Math.random() * 30),
    triviaPoints: Math.floor(Math.random() * 20)
  })).sort((a, b) => b.points - a.points);

  const activity = [
    { type: 'game', traveler: scores[0]?.name || 'Someone', action: 'spotted "Hadrian\'s Arch"', points: 4, time: '2 min ago' },
    { type: 'trivia', traveler: scores[1]?.name || 'Someone', action: 'won Trivia Round 3', points: 10, time: '15 min ago' },
    { type: 'game', traveler: scores[2]?.name || 'Someone', action: 'spotted "Street Art Alley"', points: 3, time: '1 hr ago' }
  ];

  return { scores, activity };
}

// ========================================
// RENDER SCOREBOARD
// ========================================

function renderScoreboard(scores, activity) {
  const currentUser = getCurrentTraveler();
  const currentUserId = currentUser?.id;

  const listHtml = scores.length > 0 ? scores.map((score, index) => {
    const rank = index + 1;
    const rankDisplay = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const isCurrentUser = score.travelerId === currentUserId;
    const initial = score.name?.charAt(0) || '?';

    return `
      <div class="score-row ${isCurrentUser ? 'current-user' : ''}">
        <span class="score-rank ${rankClass}">${rankDisplay}</span>
        <div class="score-avatar">${initial}</div>
        <div class="score-info">
          <div class="score-name">${score.name}${isCurrentUser ? ' (You)' : ''}</div>
          <div class="score-subtitle">${score.gamePoints || 0} game + ${score.triviaPoints || 0} trivia</div>
        </div>
        <div class="score-points">
          ${score.points}
          <span class="score-points-label">pts</span>
        </div>
      </div>
    `;
  }).join('') : `
    <div class="scoreboard-empty">
      <span class="material-symbols-outlined">emoji_events</span>
      <p>No scores yet!</p>
      <p>Play games and trivia to earn points.</p>
    </div>
  `;

  const activityHtml = activity.length > 0 ? activity.map(item => {
    const icon = item.type === 'game' ? '🎮' : item.type === 'trivia' ? '🎯' : '⭐';
    return `
      <div class="activity-item">
        <span class="activity-icon">${icon}</span>
        <div class="activity-text">
          <strong>${item.traveler}</strong> ${item.action}
          <span class="activity-points">+${item.points} pts</span>
          <div class="activity-time">${item.time}</div>
        </div>
      </div>
    `;
  }).join('') : '<p class="activity-empty">No recent activity</p>';

  return `
    <div class="scoreboard-header">
      <span class="material-symbols-outlined">emoji_events</span>
      <h3>Trip Scoreboard</h3>
      <button class="share-modal-close" onclick="closeScoreboard()">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="scoreboard-list">
      ${listHtml}
    </div>
    <div class="scoreboard-activity">
      <h4>Recent Activity</h4>
      ${activityHtml}
    </div>
    <div class="scoreboard-actions">
      <button class="scoreboard-share-btn" onclick="shareScoreboard()">
        <span class="material-symbols-outlined">share</span>
        Share Scoreboard
      </button>
    </div>
  `;
}

// ========================================
// MODAL CONTROLS
// ========================================

export async function openScoreboard() {
  let modal = document.getElementById('scoreboardModal');

  if (!modal) {
    // Create modal if it doesn't exist
    modal = document.createElement('div');
    modal.id = 'scoreboardModal';
    modal.className = 'share-modal-overlay';
    modal.innerHTML = `
      <div class="share-modal scoreboard-modal">
        <div class="scoreboard-loading">
          <span class="material-symbols-outlined spinning">progress_activity</span>
          Loading scores...
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.add('active');

  // Fetch and render scores
  const { scores, activity } = await fetchScores();
  const content = modal.querySelector('.share-modal');
  content.innerHTML = renderScoreboard(scores, activity);
}

export function closeScoreboard() {
  const modal = document.getElementById('scoreboardModal');
  modal?.classList.remove('active');
}

export async function shareScoreboard() {
  const { scores } = cachedScores ? { scores: cachedScores } : await fetchScores();

  const text = scores.slice(0, 5).map((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} ${s.name}: ${s.points} pts`;
  }).join('\n');

  const shareText = `🏆 Trip Scoreboard\n\n${text}\n\n#TripScoreboard`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Trip Scoreboard',
        text: shareText
      });
    } catch (e) {
      // User cancelled or error
      copyToClipboard(shareText);
    }
  } else {
    copyToClipboard(shareText);
  }
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => {
    // Show toast or feedback
    console.log('Copied to clipboard');
  }).catch(() => {
    console.error('Failed to copy');
  });
}

// ========================================
// EXPORTS FOR WINDOW
// ========================================

window.openScoreboard = openScoreboard;
window.closeScoreboard = closeScoreboard;
window.shareScoreboard = shareScoreboard;
