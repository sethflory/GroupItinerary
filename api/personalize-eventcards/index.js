/**
 * Personalize Event Cards API
 *
 * Generates card styles and images for each event.
 */

const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

const {
  TABLES,
  getEntity,
  upsertEntity,
  queryByPartition,
  queryEntities
} = require("../shared/tableStorage");

const { generateEventCards } = require("../personalize/eventcards");

module.exports = async function (context, req) {
  const headers = getHeaders("POST, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "POST, OPTIONS");
    return;
  }

  const auth = await requireTravelerAuth(context, req, { methods: "POST, OPTIONS" });
  if (!auth) return;

  const tripId = auth.tripId;
  context.log(`[EventCards] Generating event cards for trip: ${tripId}`);

  try {
    // Get trip data
    const [tripEntity, days] = await Promise.all([
      getEntity(TABLES.TRIPS, "trips", tripId),
      queryByPartition(TABLES.DAYS, tripId)
    ]);

    if (!tripEntity) {
      sendError(context, "Trip not found", 404, headers);
      return;
    }

    if (!days || days.length === 0) {
      sendError(context, "Trip has no days", 400, headers);
      return;
    }

    // Get events
    const events = await queryEntities(
      TABLES.EVENTS,
      `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
    );

    // Group events by date
    const eventsByDate = {};
    for (const e of events) {
      const date = e.date || e.partitionKey.split("_")[1];
      if (!eventsByDate[date]) eventsByDate[date] = [];
      eventsByDate[date].push({
        id: e.id || e.rowKey,
        type: e.type,
        title: e.title,
        where: e.where
      });
    }

    // Build trip data
    const tripData = {
      name: tripEntity.name,
      days: days.map(d => {
        // Extract date from rowKey (day_2026-02-01 -> 2026-02-01) or use d.date
        const date = d.date || d.rowKey.replace('day_', '');
        return {
          dayNum: d.dayNum,
          date,
          location: d.location,
          events: eventsByDate[date] || []
        };
      }).sort((a, b) => a.date.localeCompare(b.date))
    };

    // Count total events
    const totalEvents = tripData.days.reduce((sum, d) => sum + (d.events?.length || 0), 0);
    if (totalEvents === 0) {
      sendError(context, "Trip has no events", 400, headers);
      return;
    }

    // Generate event cards
    const eventCards = await generateEventCards(tripData);

    // Save to trip personalization
    let personalization = {};
    if (tripEntity.personalization) {
      try {
        personalization = JSON.parse(tripEntity.personalization);
      } catch (e) {}
    }

    personalization.eventCards = eventCards;
    personalization.lastUpdated = new Date().toISOString();

    // Update trip
    await upsertEntity(TABLES.TRIPS, {
      ...tripEntity,
      partitionKey: "trips",
      rowKey: tripId,
      personalization: JSON.stringify(personalization)
    });

    // Count results
    const heroCount = Object.values(eventCards).filter(c => c.style === "hero").length;
    const carouselCount = Object.values(eventCards).filter(c => c.style === "carousel").length;
    const imageCount = Object.values(eventCards).reduce((sum, c) => sum + (c.images?.length || 0), 0);

    context.log(`[EventCards] Generated: ${heroCount} hero, ${carouselCount} carousel, ${imageCount} total images`);

    sendSuccess(context, {
      eventCards,
      message: `Styled ${Object.keys(eventCards).length} events (${heroCount} hero, ${carouselCount} carousel, ${imageCount} images)`
    }, 200, headers);

  } catch (err) {
    context.log.error("[EventCards] Error:", err);
    sendError(context, "Failed to generate event cards: " + err.message, 500, headers);
  }
};
