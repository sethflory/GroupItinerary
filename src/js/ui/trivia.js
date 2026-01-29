// ========================================
// TRIP TRIVIA
// ========================================

import { currentTripId } from '../state.js';
import { API_BASE } from '../config.js';
import { getStoredAccessCode } from '../auth.js';

let currentRound = null;
let triviaInterval = null;
let countdownInterval = null;
let selectedAnswer = null;
let hasAnswered = false;

// ========================================
// API CALLS
// ========================================

async function fetchTrivia(action, method = 'GET', body = null) {
  const accessCode = getStoredAccessCode(currentTripId);
  const url = `${API_BASE}/trips/${currentTripId}/trivia/${action}?accessCode=${encodeURIComponent(accessCode)}`;

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };

  if (body) {
    options.body = JSON.stringify({ ...body, accessCode });
  }

  const response = await fetch(url, options);
  return response.json();
}

// ========================================
// TRIVIA MODAL
// ========================================

export function openTriviaModal() {
  const modal = document.getElementById('triviaModal');
  if (!modal) {
    createTriviaModal();
  }
  document.getElementById('triviaModal').classList.add('active');
  checkForActiveRound();
  loadLeaderboard();
}

export function closeTriviaModal() {
  document.getElementById('triviaModal')?.classList.remove('active');
  stopPolling();
}

function createTriviaModal() {
  const modal = document.createElement('div');
  modal.id = 'triviaModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal trivia-modal">
      <div class="modal-header">
        <h3><span class="material-symbols-outlined">quiz</span> Trip Trivia</h3>
        <button class="modal-close" onclick="closeTriviaModal()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body">
        <div id="triviaContent">
          <div class="trivia-lobby">
            <div class="trivia-leaderboard" id="triviaLeaderboard">
              <h4>Leaderboard</h4>
              <div class="leaderboard-list" id="leaderboardList">Loading...</div>
            </div>
            <div class="trivia-start-section">
              <p>Test your travel knowledge!</p>
              <div class="trivia-category-select">
                <label>Category:</label>
                <select id="triviaCategory">
                  <option value="general">General</option>
                  <option value="funny">Funny</option>
                  <option value="historical">Historical</option>
                  <option value="food">Food & Cuisine</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
              <button class="trivia-start-btn" onclick="startTriviaRound()">
                <span class="material-symbols-outlined">play_arrow</span>
                Start Round
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeTriviaModal();
  });
}

// ========================================
// ROUND MANAGEMENT
// ========================================

export async function startTriviaRound() {
  const category = document.getElementById('triviaCategory')?.value || 'general';
  const btn = document.querySelector('.trivia-start-btn');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span> Generating...';
  }

  try {
    const result = await fetchTrivia('rounds', 'POST', { category });

    if (result.round) {
      currentRound = result.round;
      hasAnswered = false;
      selectedAnswer = null;
      showCountdown();
    } else {
      alert(result.error || 'Failed to start round');
    }
  } catch (err) {
    console.error('Start round error:', err);
    alert('Failed to start round');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> Start Round';
    }
  }
}

async function checkForActiveRound() {
  try {
    const result = await fetchTrivia('rounds', 'GET');
    if (result.active && result.round) {
      currentRound = result.round;
      hasAnswered = false;
      selectedAnswer = null;

      const now = Date.now();
      const countdownEnd = new Date(currentRound.countdownEndsAt).getTime();
      const questionEnd = new Date(currentRound.questionEndsAt).getTime();

      if (now < countdownEnd) {
        showCountdown();
      } else if (now < questionEnd) {
        showQuestion();
      } else {
        showResults();
      }
    }
  } catch (err) {
    console.error('Check active round error:', err);
  }
}

// ========================================
// COUNTDOWN
// ========================================

function showCountdown() {
  const content = document.getElementById('triviaContent');
  content.innerHTML = `
    <div class="trivia-countdown">
      <div class="countdown-number" id="countdownNumber">3</div>
      <p>Get ready!</p>
    </div>
  `;

  let count = 3;
  const countdownEl = document.getElementById('countdownNumber');

  countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      countdownEl.textContent = count;
      countdownEl.classList.add('pulse');
      setTimeout(() => countdownEl.classList.remove('pulse'), 200);
    } else {
      clearInterval(countdownInterval);
      showQuestion();
    }
  }, 1000);
}

// ========================================
// QUESTION DISPLAY
// ========================================

function showQuestion() {
  if (!currentRound) return;

  const content = document.getElementById('triviaContent');
  const answers = currentRound.answers || [];

  content.innerHTML = `
    <div class="trivia-question-view">
      <div class="trivia-timer" id="triviaTimer">
        <div class="timer-bar" id="timerBar"></div>
      </div>
      <div class="trivia-question">${currentRound.question}</div>
      <div class="trivia-answers">
        ${answers.map((answer, i) => `
          <button class="trivia-answer-btn" data-index="${i}" onclick="selectTriviaAnswer(${i})">
            <span class="answer-letter">${String.fromCharCode(65 + i)}</span>
            ${answer}
          </button>
        `).join('')}
      </div>
      <div class="trivia-submit-section" id="triviaSubmitSection" style="display: none;">
        <button class="trivia-submit-btn" onclick="submitTriviaAnswer()">
          <span class="material-symbols-outlined">send</span>
          Lock In Answer
        </button>
      </div>
    </div>
  `;

  startTimer();
}

function startTimer() {
  const timerBar = document.getElementById('timerBar');
  const questionEnd = new Date(currentRound.questionEndsAt).getTime();
  const questionStart = new Date(currentRound.countdownEndsAt).getTime();
  const totalTime = questionEnd - questionStart;

  const updateTimer = () => {
    const now = Date.now();
    const remaining = Math.max(0, questionEnd - now);
    const percent = (remaining / totalTime) * 100;

    if (timerBar) {
      timerBar.style.width = `${percent}%`;
      if (percent < 20) timerBar.classList.add('danger');
      else if (percent < 50) timerBar.classList.add('warning');
    }

    if (remaining <= 0) {
      clearInterval(triviaInterval);
      if (!hasAnswered) {
        showResults();
      }
    }
  };

  triviaInterval = setInterval(updateTimer, 100);
  updateTimer();
}

// ========================================
// ANSWER HANDLING
// ========================================

export function selectTriviaAnswer(index) {
  if (hasAnswered) return;

  selectedAnswer = index;

  document.querySelectorAll('.trivia-answer-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === index);
  });

  document.getElementById('triviaSubmitSection').style.display = 'flex';
}

export async function submitTriviaAnswer() {
  if (hasAnswered || selectedAnswer === null) return;

  hasAnswered = true;
  const submitBtn = document.querySelector('.trivia-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span> Submitting...';
  }

  try {
    const result = await fetchTrivia('answer', 'POST', {
      roundId: currentRound.id,
      answerIndex: selectedAnswer,
      answeredAt: new Date().toISOString()
    });

    showAnswerResult(result);
  } catch (err) {
    console.error('Submit answer error:', err);
    alert('Failed to submit answer');
    hasAnswered = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="material-symbols-outlined">send</span> Lock In Answer';
    }
  }
}

function showAnswerResult(result) {
  clearInterval(triviaInterval);

  document.querySelectorAll('.trivia-answer-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === result.correctIndex) {
      btn.classList.add('correct');
    } else if (i === selectedAnswer && !result.correct) {
      btn.classList.add('incorrect');
    }
  });

  const submitSection = document.getElementById('triviaSubmitSection');
  submitSection.innerHTML = `
    <div class="answer-result ${result.correct ? 'correct' : 'incorrect'}">
      <span class="material-symbols-outlined">${result.correct ? 'check_circle' : 'cancel'}</span>
      ${result.correct ? `Correct! +${result.points} points` : 'Wrong answer'}
    </div>
  `;
  submitSection.style.display = 'flex';

  setTimeout(() => {
    showResults();
    loadLeaderboard();
  }, 2000);
}

// ========================================
// RESULTS
// ========================================

function showResults() {
  clearInterval(triviaInterval);
  clearInterval(countdownInterval);

  const content = document.getElementById('triviaContent');
  content.innerHTML = `
    <div class="trivia-lobby">
      <div class="trivia-leaderboard" id="triviaLeaderboard">
        <h4>Leaderboard</h4>
        <div class="leaderboard-list" id="leaderboardList">Loading...</div>
      </div>
      <div class="trivia-start-section">
        <p>Ready for another round?</p>
        <div class="trivia-category-select">
          <label>Category:</label>
          <select id="triviaCategory">
            <option value="general">General</option>
            <option value="funny">Funny</option>
            <option value="historical">Historical</option>
            <option value="food">Food & Cuisine</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <button class="trivia-start-btn" onclick="startTriviaRound()">
          <span class="material-symbols-outlined">play_arrow</span>
          Start Round
        </button>
      </div>
    </div>
  `;

  currentRound = null;
  loadLeaderboard();
}

// ========================================
// LEADERBOARD
// ========================================

async function loadLeaderboard() {
  try {
    const result = await fetchTrivia('leaderboard', 'GET');
    renderLeaderboard(result.leaderboard || []);
  } catch (err) {
    console.error('Load leaderboard error:', err);
  }
}

function renderLeaderboard(entries) {
  const list = document.getElementById('leaderboardList');
  if (!list) return;

  if (entries.length === 0) {
    list.innerHTML = '<p class="no-scores">No scores yet. Start a round!</p>';
    return;
  }

  list.innerHTML = entries.map((entry, i) => `
    <div class="leaderboard-entry ${i < 3 ? 'top-' + (i + 1) : ''}">
      <span class="rank">${i + 1}</span>
      <span class="name">${entry.displayName || 'Traveler'}</span>
      <span class="points">${entry.totalPoints} pts</span>
      ${entry.streak > 1 ? `<span class="streak">🔥${entry.streak}</span>` : ''}
    </div>
  `).join('');
}

// ========================================
// POLLING
// ========================================

function stopPolling() {
  if (triviaInterval) {
    clearInterval(triviaInterval);
    triviaInterval = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// ========================================
// EXPORTS
// ========================================

export {
  loadLeaderboard,
  checkForActiveRound
};
