const {
  TABLES,
  getEntity,
  queryByPartition,
  queryEntities
} = require("./tableStorage");

/**
 * Build trip context for AI prompts
 * All data structures are designed to be easily serialized into AI prompts
 *
 * @param {string} tripId - The trip identifier
 * @param {Object} options - Context options
 * @param {string} options.date - Include specific day context
 * @param {string} options.eventId - Include specific event context
 * @param {boolean} options.includeRecent - Include recent events (last 5)
 * @param {boolean} options.includeDestinations - Include all destination info
 * @param {boolean} options.includeTravelers - Include traveler details (default: true)
 * @param {boolean} options.includeHotel - Include hotel details
 * @returns {Promise<string>} Formatted context string for AI prompts
 */
async function buildTripContext(tripId, options = {}) {
  const {
    date,
    eventId,
    includeRecent = false,
    includeDestinations = false,
    includeTravelers = true,
    includeHotel = false
  } = options;

  const context = {
    trip: null,
    travelers: [],
    currentDay: null,
    currentEvent: null,
    recentEvents: [],
    destinations: {},
    hotel: null
  };

  // Fetch trip details
  const tripEntity = await getEntity(TABLES.TRIPS, "trips", tripId);
  if (tripEntity) {
    context.trip = {
      id: tripEntity.rowKey,
      name: tripEntity.name,
      subtitle: tripEntity.subtitle,
      dates: tripEntity.dates,
      description: tripEntity.description
    };
  }

  // Fetch travelers
  if (includeTravelers) {
    const travelers = await queryByPartition(TABLES.TRAVELERS, tripId);
    context.travelers = travelers.map(t => ({
      id: t.rowKey,
      name: t.name,
      group: t.group
    }));
  }

  // Fetch specific day
  if (date) {
    const dayEntity = await getEntity(TABLES.DAYS, tripId, date);
    if (dayEntity) {
      context.currentDay = {
        date: dayEntity.rowKey,
        label: dayEntity.label,
        location: dayEntity.location,
        theme: dayEntity.theme,
        destination: dayEntity.destination,
        destinationInfo: dayEntity.destinationInfo
      };
    }
  }

  // Fetch specific event
  if (eventId) {
    const allEvents = await queryEntities(
      TABLES.EVENTS,
      `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
    );
    const eventEntity = allEvents.find(e => e.rowKey === eventId || e.id === eventId);
    if (eventEntity) {
      context.currentEvent = formatEventForContext(eventEntity);
    }
  }

  // Fetch recent events
  if (includeRecent) {
    const allEvents = await queryEntities(
      TABLES.EVENTS,
      `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
    );
    // Sort by date and time, take last 5
    const sorted = allEvents
      .map(e => ({
        ...e,
        sortKey: `${e.partitionKey.split("_")[1]}_${e.time || "00:00"}`
      }))
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
      .slice(0, 5);
    context.recentEvents = sorted.map(formatEventForContext);
  }

  // Fetch destinations
  if (includeDestinations) {
    const destinations = await queryByPartition(TABLES.DESTINATIONS, "destinations");
    for (const d of destinations) {
      context.destinations[d.rowKey] = {
        name: d.name,
        city: d.city,
        country: d.country,
        info: d.info,
        localTip: d.localTip
      };
    }
  }

  // Fetch hotel
  if (includeHotel) {
    const hotels = await queryByPartition(TABLES.HOTELS, tripId);
    if (hotels.length > 0) {
      context.hotel = {
        name: hotels[0].name,
        address: hotels[0].address,
        neighborhood: hotels[0].neighborhood,
        highlights: hotels[0].highlights
      };
    }
  }

  return formatForPrompt(context);
}

/**
 * Format event entity for context
 */
function formatEventForContext(entity) {
  let travelers = ["all"];
  try {
    if (entity.travelers) {
      travelers = typeof entity.travelers === "string"
        ? JSON.parse(entity.travelers)
        : entity.travelers;
    }
  } catch (e) {}

  return {
    id: entity.id || entity.rowKey,
    date: entity.date || entity.partitionKey?.split("_")[1],
    time: entity.time,
    type: entity.type,
    title: entity.title,
    subtitle: entity.subtitle,
    where: entity.where,
    details: entity.details,
    travelers
  };
}

/**
 * Format context object into AI prompt string
 */
function formatForPrompt(context) {
  const sections = [];

  // Trip overview
  if (context.trip) {
    sections.push(`## Trip Overview
Trip: ${context.trip.name}
${context.trip.subtitle ? `Subtitle: ${context.trip.subtitle}` : ""}
Dates: ${context.trip.dates}
${context.trip.description ? `Description: ${context.trip.description}` : ""}`);
  }

  // Travelers
  if (context.travelers && context.travelers.length > 0) {
    const travelerList = context.travelers
      .map(t => `- ${t.name} (${t.group})`)
      .join("\n");
    sections.push(`## Travelers
${travelerList}`);
  }

  // Current day
  if (context.currentDay) {
    sections.push(`## Today (${context.currentDay.label})
Location: ${context.currentDay.location}
Theme: ${context.currentDay.theme}
${context.currentDay.destinationInfo ? `Info: ${context.currentDay.destinationInfo}` : ""}`);
  }

  // Current event
  if (context.currentEvent) {
    const event = context.currentEvent;
    sections.push(`## Current Event
${event.title}${event.subtitle ? ` - ${event.subtitle}` : ""}
Time: ${event.time}
Type: ${event.type}
${event.where ? `Location: ${event.where}` : ""}
${event.details ? `Details: ${event.details}` : ""}`);
  }

  // Recent events
  if (context.recentEvents && context.recentEvents.length > 0) {
    const eventList = context.recentEvents
      .map(e => `- ${e.date} ${e.time}: ${e.title} (${e.type})`)
      .join("\n");
    sections.push(`## Recent Events
${eventList}`);
  }

  // Destinations
  if (context.destinations && Object.keys(context.destinations).length > 0) {
    const destList = Object.entries(context.destinations)
      .map(([code, d]) => `- ${code}: ${d.city}, ${d.country}${d.info ? ` - ${d.info}` : ""}`)
      .join("\n");
    sections.push(`## Trip Destinations
${destList}`);
  }

  // Hotel
  if (context.hotel) {
    sections.push(`## Accommodation
${context.hotel.name}
${context.hotel.neighborhood}
${context.hotel.highlights ? `Highlights: ${context.hotel.highlights}` : ""}`);
  }

  return sections.join("\n\n").trim();
}

/**
 * Build context for trivia question generation
 */
async function buildTriviaContext(tripId, options = {}) {
  const { category, eventId, date } = options;

  const baseContext = await buildTripContext(tripId, {
    date,
    eventId,
    includeDestinations: true,
    includeTravelers: true
  });

  const categoryPrompts = {
    funny: "Focus on amusing, lighthearted aspects of the trip, travel mishaps, cultural differences, or inside jokes.",
    historical: "Focus on historical facts about the destinations, ancient history, significant events, or cultural heritage.",
    news: "Focus on current events, recent news about the destinations, modern developments, or trending topics from 2025-2026.",
    expert: "Focus on deep knowledge about the destinations - obscure facts, local secrets, expert-level cultural knowledge."
  };

  const categoryInstruction = category && categoryPrompts[category]
    ? `\nQuestion Style: ${categoryPrompts[category]}`
    : "";

  return `${baseContext}${categoryInstruction}`;
}

/**
 * Build context for share post generation
 */
async function buildShareContext(tripId, options = {}) {
  const { date, includeTravelers = true } = options;

  return await buildTripContext(tripId, {
    date,
    includeRecent: true,
    includeDestinations: true,
    includeTravelers,
    includeHotel: true
  });
}

/**
 * Build context for AI chat
 */
async function buildChatContext(tripId, options = {}) {
  const { date } = options;

  return await buildTripContext(tripId, {
    date,
    includeRecent: true,
    includeDestinations: true,
    includeTravelers: true,
    includeHotel: true
  });
}

module.exports = {
  buildTripContext,
  buildTriviaContext,
  buildShareContext,
  buildChatContext,
  formatForPrompt
};
