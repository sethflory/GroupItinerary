/**
 * Personalize Nicknames API
 *
 * Simple endpoint to generate day nicknames only.
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

const { generateNicknames } = require("../personalize/nicknames");

module.exports = async function (context, req) {
  const headers = getHeaders("POST, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "POST, OPTIONS");
    return;
  }

  const auth = await requireTravelerAuth(context, req, { methods: "POST, OPTIONS" });
  if (!auth) return;

  const tripId = auth.tripId;
  context.log(`[Nicknames] Generating nicknames for trip: ${tripId}`);

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

    // Build minimal trip data for nickname generation
    const tripData = {
      name: tripEntity.name,
      days: days.map(d => ({
        dayNum: d.dayNum,
        date: d.rowKey,
        location: d.location,
        theme: d.theme
      })).sort((a, b) => a.date.localeCompare(b.date))
    };

    // Generate nicknames
    const nicknames = await generateNicknames(tripData);

    // Save to trip personalization
    let personalization = {};
    if (tripEntity.personalization) {
      try {
        personalization = JSON.parse(tripEntity.personalization);
      } catch (e) {}
    }

    personalization.dayNicknames = nicknames;
    personalization.lastUpdated = new Date().toISOString();

    // Update trip
    await upsertEntity(TABLES.TRIPS, {
      ...tripEntity,
      partitionKey: "trips",
      rowKey: tripId,
      personalization: JSON.stringify(personalization)
    });

    context.log("[Nicknames] Generated:", nicknames);

    sendSuccess(context, {
      nicknames,
      message: `Generated nicknames for ${Object.keys(nicknames).length} days`
    }, 200, headers);

  } catch (err) {
    context.log.error("[Nicknames] Error:", err);
    sendError(context, "Failed to generate nicknames: " + err.message, 500, headers);
  }
};
