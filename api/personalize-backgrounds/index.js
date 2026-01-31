/**
 * Personalize Backgrounds API
 *
 * Generates day background images via AI queries + Unsplash.
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
  queryByPartition
} = require("../shared/tableStorage");

const { generateBackgrounds } = require("../personalize/backgrounds");

module.exports = async function (context, req) {
  const headers = getHeaders("POST, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "POST, OPTIONS");
    return;
  }

  const auth = await requireTravelerAuth(context, req, { methods: "POST, OPTIONS" });
  if (!auth) return;

  const tripId = auth.tripId;
  context.log(`[Backgrounds] Generating backgrounds for trip: ${tripId}`);

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

    // Get events for context
    const { queryEntities } = require("../shared/tableStorage");
    const events = await queryEntities(
      TABLES.EVENTS,
      `PartitionKey ge '${tripId}_' and PartitionKey lt '${tripId}~'`
    );

    // Group events by date
    const eventsByDate = {};
    for (const e of events) {
      const date = e.date || e.partitionKey.split("_")[1];
      if (!eventsByDate[date]) eventsByDate[date] = [];
      eventsByDate[date].push({ title: e.title, type: e.type });
    }

    // Build trip data
    const tripData = {
      name: tripEntity.name,
      days: days.map(d => ({
        dayNum: d.dayNum,
        date: d.rowKey,
        location: d.location,
        theme: d.theme,
        events: eventsByDate[d.rowKey] || []
      })).sort((a, b) => a.date.localeCompare(b.date))
    };

    // Generate backgrounds
    const backgrounds = await generateBackgrounds(tripData);

    // Save to trip personalization
    let personalization = {};
    if (tripEntity.personalization) {
      try {
        personalization = JSON.parse(tripEntity.personalization);
      } catch (e) {}
    }

    personalization.dayBackgrounds = backgrounds;
    personalization.lastUpdated = new Date().toISOString();

    // Update trip
    await upsertEntity(TABLES.TRIPS, {
      ...tripEntity,
      partitionKey: "trips",
      rowKey: tripId,
      personalization: JSON.stringify(personalization)
    });

    const resolvedCount = Object.values(backgrounds).filter(b => b.url).length;
    context.log(`[Backgrounds] Generated ${Object.keys(backgrounds).length} queries, resolved ${resolvedCount} images`);

    sendSuccess(context, {
      backgrounds,
      message: `Generated backgrounds for ${Object.keys(backgrounds).length} days (${resolvedCount} images resolved)`
    }, 200, headers);

  } catch (err) {
    context.log.error("[Backgrounds] Error:", err);
    sendError(context, "Failed to generate backgrounds: " + err.message, 500, headers);
  }
};
