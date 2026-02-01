/**
 * Personalize Backgrounds API
 *
 * Generates day background images via AI queries + Unsplash.
 * Now writes directly to day.backgroundImage instead of
 * trip.personalization.dayBackgrounds.
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

    // Filter days that need backgrounds (skip those with existing backgroundImage)
    const daysNeedingBg = [];
    const daysSkipped = [];

    for (const d of days) {
      // Parse existing backgroundImage
      let backgroundImage = null;
      try {
        if (d.backgroundImage) {
          backgroundImage = typeof d.backgroundImage === "string" ? JSON.parse(d.backgroundImage) : d.backgroundImage;
        }
      } catch (err) {}

      // Skip days that already have a background (protects user selections)
      if (backgroundImage && backgroundImage.url) {
        daysSkipped.push(d.dayNum);
        continue;
      }

      daysNeedingBg.push(d);
    }

    context.log(`[Backgrounds] ${daysNeedingBg.length} days need backgrounds, ${daysSkipped.length} already have backgrounds`);

    if (daysNeedingBg.length === 0) {
      sendSuccess(context, {
        message: `All ${daysSkipped.length} days already have backgrounds`,
        daysUpdated: 0,
        daysSkipped: daysSkipped.length
      }, 200, headers);
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

    // Build trip data for AI (only days needing backgrounds)
    const tripData = {
      name: tripEntity.name,
      days: daysNeedingBg.map(d => {
        const date = d.date || d.rowKey.replace('day_', '');
        return {
          dayNum: d.dayNum,
          date,
          location: d.location,
          theme: d.theme,
          events: eventsByDate[date] || []
        };
      }).sort((a, b) => a.date.localeCompare(b.date))
    };

    // Generate backgrounds via AI
    const backgrounds = await generateBackgrounds(tripData);

    // Update each day directly with backgroundImage
    let daysUpdated = 0;
    for (const d of daysNeedingBg) {
      const bgData = backgrounds[d.dayNum];
      if (!bgData || !bgData.url) {
        continue;
      }

      // Exclude Azure metadata fields
      const { etag, timestamp, ...existingData } = d;

      // Update with new background
      const updated = {
        ...existingData,
        partitionKey: tripId,
        rowKey: d.rowKey,
        backgroundImage: JSON.stringify(bgData),
        updatedAt: new Date().toISOString()
      };

      await upsertEntity(TABLES.DAYS, updated);
      daysUpdated++;
    }

    const resolvedCount = Object.values(backgrounds).filter(b => b.url).length;
    context.log(`[Backgrounds] Updated ${daysUpdated} days with backgrounds (${resolvedCount} images resolved)`);

    sendSuccess(context, {
      message: `Updated ${daysUpdated} days with backgrounds`,
      daysUpdated,
      daysSkipped: daysSkipped.length
    }, 200, headers);

  } catch (err) {
    context.log.error("[Backgrounds] Error:", err);
    sendError(context, "Failed to generate backgrounds: " + err.message, 500, headers);
  }
};
