// ========================================
// AI CHAT & INSIGHTS
// ========================================

import { currentTripId, getCurrentTrip } from '../state.js';
import { isFeatureEnabled } from '../config.js';
import { sendAIMessage } from '../api.js';
import { escapeHtml, formatAiResponse } from '../utils.js';

let DAYS, TRAVELERS, DESTINATIONS;
let chatHistory = [];

export function setAiDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
  DESTINATIONS = deps.DESTINATIONS;
}

export function toggleAiChat() {
  if (!isFeatureEnabled('AI_CHAT')) return;
  document.getElementById('aiChatWindow').classList.toggle('visible');
}

function getTripContext() {
  const trip = getCurrentTrip();
  const travelerNames = TRAVELERS.map(t => t.name).join(', ');
  const destinations = [...new Set(DAYS.map(d => d.location))].join(', ');

  return `You are a helpful travel assistant for a trip called "${trip.name}".
Trip dates: ${trip.dates}
Travelers: ${travelerNames}
Destinations: ${destinations}

Be helpful, friendly, and concise. Provide practical travel tips, cultural insights, and helpful suggestions.
If asked about specific events or days, refer to the itinerary context provided.`;
}

export async function sendAiMessage() {
  if (!isFeatureEnabled('AI_CHAT')) return;

  const input = document.getElementById('aiChatInput');
  const message = input.value.trim();
  if (!message) return;

  const messagesEl = document.getElementById('aiChatMessages');

  // Add user message
  messagesEl.innerHTML += `<div class="ai-chat-message user">${escapeHtml(message)}</div>`;
  input.value = '';
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Add loading indicator
  const loadingId = 'loading-' + Date.now();
  messagesEl.innerHTML += `<div class="ai-chat-message assistant" id="${loadingId}"><span class="typing-indicator">Thinking...</span></div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Add to chat history
  chatHistory.push({ role: 'user', content: message });

  try {
    const response = await sendAIMessage(currentTripId, {
      system: getTripContext(),
      messages: chatHistory,
      maxTokens: 1024
    });

    // Add to history
    chatHistory.push({ role: 'assistant', content: response });

    // Keep history manageable
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(-20);
    }

    // Replace loading with response
    document.getElementById(loadingId).innerHTML = formatAiResponse(response);
    messagesEl.scrollTop = messagesEl.scrollHeight;

  } catch (error) {
    console.error('AI Chat error:', error);
    document.getElementById(loadingId).innerHTML = `⚠️ Error: ${error.message}`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

// AI Insights Modal
let currentInsightEvent = null;

export function openAiInsights(eventId, eventTitle, eventDetails) {
  if (!isFeatureEnabled('AI_INSIGHTS')) return;

  currentInsightEvent = { id: eventId, title: eventTitle, details: eventDetails };

  document.getElementById('aiInsightsTitle').textContent = eventTitle || 'AI Insights';
  document.getElementById('aiInsightsContent').innerHTML = `
    <div class="insights-prompt">
      <p>What would you like to know about <strong>${eventTitle}</strong>?</p>
      <div class="insights-buttons">
        <button onclick="getInsight('tips')" class="insight-btn">
          <span class="material-symbols-outlined">lightbulb</span>
          Travel Tips
        </button>
        <button onclick="getInsight('culture')" class="insight-btn">
          <span class="material-symbols-outlined">public</span>
          Cultural Insights
        </button>
        <button onclick="getInsight('food')" class="insight-btn">
          <span class="material-symbols-outlined">restaurant</span>
          Food & Dining
        </button>
        <button onclick="getInsight('photo')" class="insight-btn">
          <span class="material-symbols-outlined">photo_camera</span>
          Photo Spots
        </button>
      </div>
    </div>
  `;

  document.getElementById('aiInsightsModal').classList.add('active');
}

export function closeAiInsights() {
  document.getElementById('aiInsightsModal').classList.remove('active');
  currentInsightEvent = null;
}

export async function getInsight(type) {
  if (!currentInsightEvent) return;

  const contentEl = document.getElementById('aiInsightsContent');
  contentEl.innerHTML = '<div class="insights-loading"><span class="material-symbols-outlined spinning">progress_activity</span> Getting insights...</div>';

  const prompts = {
    tips: `Give me 3-4 practical travel tips for "${currentInsightEvent.title}". Be specific and actionable.`,
    culture: `What cultural insights should I know about "${currentInsightEvent.title}"? Include etiquette and local customs.`,
    food: `What food and dining options should I try near or at "${currentInsightEvent.title}"? Include local specialties.`,
    photo: `What are the best photo spots and angles for "${currentInsightEvent.title}"? Include timing tips.`
  };

  try {
    const response = await sendAIMessage(currentTripId, {
      system: getTripContext(),
      messages: [{ role: 'user', content: prompts[type] }],
      maxTokens: 512
    });

    contentEl.innerHTML = `
      <div class="insights-response">
        ${formatAiResponse(response)}
      </div>
      <div class="insights-actions">
        <button onclick="openAiInsights('${currentInsightEvent.id}', '${currentInsightEvent.title.replace(/'/g, "\\'")}', '')" class="insight-back-btn">
          <span class="material-symbols-outlined">arrow_back</span>
          Ask another question
        </button>
      </div>
    `;

  } catch (error) {
    contentEl.innerHTML = `
      <div class="insights-error">
        <span class="material-symbols-outlined">error</span>
        <p>Failed to get insights: ${error.message}</p>
        <button onclick="openAiInsights('${currentInsightEvent.id}', '${currentInsightEvent.title.replace(/'/g, "\\'")}', '')" class="insight-back-btn">
          Try again
        </button>
      </div>
    `;
  }
}
