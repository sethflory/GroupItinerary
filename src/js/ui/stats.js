// ========================================
// STATS BANNER
// ========================================

import { getCurrentTrip } from '../state.js';
import { calculateTotalMiles, calculateFlightCount, calculateTotalSteps, calculateGroundTravelTime } from '../utils.js';

let DAYS, TRAVELERS;
let currentTravelerFilter = 'all';

export function setStatsDeps(deps) {
  DAYS = deps.DAYS;
  TRAVELERS = deps.TRAVELERS;
}

export function setStatsFilter(filter) {
  currentTravelerFilter = filter;
}

export function toggleStats() {
  document.getElementById('statsBanner')?.classList.toggle('expanded');
}

export function renderStats() {
  const summaryEl = document.getElementById('statsSummary');
  const detailEl = document.getElementById('statsGrid');
  const travelerStatsEl = document.getElementById('travelerStats');

  if (!summaryEl) return;

  const trip = getCurrentTrip();
  const totalDays = DAYS.length;
  const totalMiles = calculateTotalMiles(currentTravelerFilter, DAYS);
  const totalFlights = calculateFlightCount(currentTravelerFilter, DAYS);
  const totalSteps = calculateTotalSteps(currentTravelerFilter, DAYS);
  const groundTime = calculateGroundTravelTime(DAYS, currentTravelerFilter);

  // Count destinations
  const destinations = new Set(DAYS.map(d => d.destination).filter(d => d !== 'travel'));
  const destCount = destinations.size;

  // Count events
  let totalEvents = 0;
  DAYS.forEach(d => {
    totalEvents += (d.events || []).length;
  });

  // Summary (collapsed view)
  summaryEl.innerHTML = `
    <div class="stat-mini">
      <span class="material-symbols-outlined">calendar_month</span>
      <span><strong>${totalDays}</strong> days</span>
    </div>
    <div class="stat-mini">
      <span class="material-symbols-outlined">flight</span>
      <span><strong>${totalFlights}</strong> flights</span>
    </div>
    <div class="stat-mini">
      <span class="material-symbols-outlined">public</span>
      <span><strong>${destCount}</strong> destinations</span>
    </div>
    <div class="stat-mini">
      <span class="material-symbols-outlined">route</span>
      <span><strong>${totalMiles.toLocaleString()}</strong> miles</span>
    </div>
  `;

  // Detail grid (expanded view)
  if (detailEl) {
    detailEl.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-label">Total Duration</div>
        <div class="stat-card-value">${totalDays} Days</div>
        <div class="stat-card-sub">${trip.dates}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Air Miles</div>
        <div class="stat-card-value">${totalMiles.toLocaleString()}</div>
        <div class="stat-card-sub">${totalFlights} flights</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Destinations</div>
        <div class="stat-card-value">${destCount}</div>
        <div class="stat-card-sub">${[...destinations].join(', ')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Planned Events</div>
        <div class="stat-card-value">${totalEvents}</div>
        <div class="stat-card-sub">Activities, meals & more</div>
      </div>
      ${totalSteps > 0 ? `
        <div class="stat-card">
          <div class="stat-card-label">Est. Steps</div>
          <div class="stat-card-value">${totalSteps.toLocaleString()}</div>
          <div class="stat-card-sub">~${Math.round(totalSteps * 0.0005)} miles walking</div>
        </div>
      ` : ''}
      ${groundTime > 0 ? `
        <div class="stat-card">
          <div class="stat-card-label">Ground Travel</div>
          <div class="stat-card-value">${Math.round(groundTime / 60)}h ${groundTime % 60}m</div>
          <div class="stat-card-sub">Taxis, transfers, tours</div>
        </div>
      ` : ''}
    `;
  }

  // Traveler stats
  if (travelerStatsEl) {
    travelerStatsEl.innerHTML = TRAVELERS.map(t => {
      const miles = calculateTotalMiles(t.id, DAYS);
      const flights = calculateFlightCount(t.id, DAYS);

      return `
        <div class="traveler-stat">
          <div class="traveler-avatar" style="background: ${t.color}">${t.initials}</div>
          <div class="traveler-stat-info">
            <div class="traveler-stat-name">${t.name}</div>
            <div class="traveler-stat-detail">${miles.toLocaleString()} miles • ${flights} flights</div>
          </div>
        </div>
      `;
    }).join('');
  }
}
