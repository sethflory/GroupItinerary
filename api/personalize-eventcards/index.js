/**
 * Personalize Event Cards API
 *
 * Generates card styles and images for each event.
 * Now writes directly to event.linkedPhotos and event.cardStyle
 * instead of trip.personalization.eventCards.
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

    // Get events (full entities, not just summary)
    const events = await queryEntities(
      TABLES.EVENTS,
      `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
    );

    // Filter events that need images (skip those with existing linkedPhotos)
    const eventsNeedingImages = [];
    const eventsSkipped = [];

    for (const e of events) {
      // Parse existing linkedPhotos
      let linkedPhotos = [];
      try {
        if (e.linkedPhotos) {
          linkedPhotos = typeof e.linkedPhotos === "string" ? JSON.parse(e.linkedPhotos) : e.linkedPhotos;
        }
      } catch (err) {}

      // Skip events that already have images (protects user selections)
      if (linkedPhotos.length > 0) {
        eventsSkipped.push(e.id || e.rowKey);
        continue;
      }

      const date = e.date || e.partitionKey.split("_")[1];
      eventsNeedingImages.push({
        id: e.id || e.rowKey,
        type: e.type,
        title: e.title,
        where: e.where,
        date,
        partitionKey: e.partitionKey,
        rowKey: e.rowKey
      });
    }

    context.log(`[EventCards] ${eventsNeedingImages.length} events need images, ${eventsSkipped.length} already have images`);

    if (eventsNeedingImages.length === 0) {
      sendSuccess(context, {
        message: `All ${eventsSkipped.length} events already have images`,
        eventsUpdated: 0,
        eventsSkipped: eventsSkipped.length
      }, 200, headers);
      return;
    }

    // Group events by date for AI processing
    const eventsByDate = {};
    for (const e of eventsNeedingImages) {
      if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
      eventsByDate[e.date].push({
        id: e.id,
        type: e.type,
        title: e.title,
        where: e.where
      });
    }

    // Build trip data for AI
    const tripData = {
      name: tripEntity.name,
      days: days.map(d => {
        const date = d.date || d.rowKey.replace('day_', '');
        return {
          dayNum: d.dayNum,
          date,
          location: d.location,
          events: eventsByDate[date] || []
        };
      }).filter(d => d.events.length > 0).sort((a, b) => a.date.localeCompare(b.date))
    };

    // Generate event cards via AI
    const eventCards = await generateEventCards(tripData);

    // Update each event directly with linkedPhotos and cardStyle
    let eventsUpdated = 0;
    for (const e of eventsNeedingImages) {
      const cardData = eventCards[e.id];
      if (!cardData || !cardData.images || cardData.images.length === 0) {
        continue;
      }

      // Fetch the full event entity to update
      const eventEntity = await getEntity(TABLES.EVENTS, e.partitionKey, e.rowKey);
      if (!eventEntity) continue;

      // Exclude Azure metadata fields
      const { etag, timestamp, ...existingData } = eventEntity;

      // Update with new image data
      const updated = {
        ...existingData,
        partitionKey: e.partitionKey,
        rowKey: e.rowKey,
        linkedPhotos: JSON.stringify(cardData.images),
        cardStyle: cardData.style || 'hero',
        updatedAt: new Date().toISOString()
      };

      await upsertEntity(TABLES.EVENTS, updated);
      eventsUpdated++;
    }

    // Count results
    const heroCount = Object.values(eventCards).filter(c => c.style === "hero").length;
    const carouselCount = Object.values(eventCards).filter(c => c.style === "carousel").length;
    const imageCount = Object.values(eventCards).reduce((sum, c) => sum + (c.images?.length || 0), 0);

    context.log(`[EventCards] Updated ${eventsUpdated} events: ${heroCount} hero, ${carouselCount} carousel, ${imageCount} total images`);

    sendSuccess(context, {
      message: `Updated ${eventsUpdated} events (${heroCount} hero, ${carouselCount} carousel, ${imageCount} images)`,
      eventsUpdated,
      eventsSkipped: eventsSkipped.length
    }, 200, headers);

  } catch (err) {
    context.log.error("[EventCards] Error:", err);
    sendError(context, "Failed to generate event cards: " + err.message, 500, headers);
  }
};
