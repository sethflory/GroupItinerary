/**
 * AI Assist Personalization API
 *
 * Orchestrates the full personalization pipeline:
 * 1. Validate & sanitize trip data
 * 2. Generate narrative (day nicknames, image queries) via Claude
 * 3. Resolve images from Unsplash
 * 4. Analyze image colors
 * 5. Generate theme options via Claude
 * 6. Return complete personalization
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

const { sanitizeTripForAI } = require("./sanitize");
const { generateNarrative } = require("./narrative");
const { resolveImages, analyzeColors } = require("./images");
const { generateThemes } = require("./themes");

// Rate limiting: max personalizations per trip per day
const MAX_PER_TRIP_PER_DAY = 5;

module.exports = async function (context, req) {
  const headers = getHeaders("POST, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "POST, OPTIONS");
    return;
  }

  // Validate access
  const auth = await requireTravelerAuth(context, req, { methods: "POST, OPTIONS" });
  if (!auth) return;

  const tripId = auth.tripId;
  const { mode = "auto" } = req.body || {};

  context.log(`[Personalize] Starting personalization for trip: ${tripId}, mode: ${mode}`);

  try {
    // Check rate limit
    const rateLimitKey = `${tripId}_${new Date().toISOString().split('T')[0]}`;
    const rateLimitEntity = await getEntity(TABLES.RATE_LIMITS, "personalize", rateLimitKey).catch(() => null);

    if (rateLimitEntity && rateLimitEntity.count >= MAX_PER_TRIP_PER_DAY) {
      sendError(context, "Rate limit exceeded. Try again tomorrow.", 429, headers);
      return;
    }

    // Get full trip data
    const [tripEntity, days, travelers, destinations] = await Promise.all([
      getEntity(TABLES.TRIPS, "trips", tripId),
      queryByPartition(TABLES.DAYS, tripId),
      queryByPartition(TABLES.TRAVELERS, tripId),
      queryByPartition(TABLES.DESTINATIONS, "destinations")
    ]);

    if (!tripEntity) {
      sendError(context, "Trip not found", 404, headers);
      return;
    }

    if (!days || days.length === 0) {
      sendError(context, "Trip has no days. Add days before personalizing.", 400, headers);
      return;
    }

    // Get events for each day
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
      eventsByDate[date].push({
        id: e.id || e.rowKey,
        type: e.type,
        title: e.title,
        time: e.time,
        where: e.where
      });
    }

    // Build trip data structure
    const tripData = {
      name: tripEntity.name,
      startDate: tripEntity.startDate,
      endDate: tripEntity.endDate,
      travelers: travelers.map(t => ({ name: t.name, group: t.group })),
      days: days.map(d => ({
        dayNum: d.dayNum,
        date: d.rowKey,
        location: d.location,
        theme: d.theme,
        destination: d.destination,
        events: eventsByDate[d.rowKey] || []
      })).sort((a, b) => a.date.localeCompare(b.date)),
      destinations: Object.fromEntries(
        destinations.map(d => [d.rowKey, { city: d.city, country: d.country }])
      )
    };

    // Step 1: Sanitize trip data for AI
    context.log("[Personalize] Sanitizing trip data...");
    const sanitizedTrip = sanitizeTripForAI(tripData);

    // Step 2: Generate narrative (day nicknames + image queries)
    context.log("[Personalize] Generating narrative...");
    const narrative = await generateNarrative(sanitizedTrip);

    if (!narrative || !narrative.days) {
      sendError(context, "Failed to generate narrative", 500, headers);
      return;
    }

    // Step 3: Resolve images from Unsplash
    context.log("[Personalize] Resolving images...");
    const resolvedImages = await resolveImages(narrative);

    // Step 4: Analyze colors from resolved images
    context.log("[Personalize] Analyzing colors...");
    const colorAnalysis = analyzeColors(resolvedImages);

    // Step 5: Generate theme options
    context.log("[Personalize] Generating themes...");
    const themeOptions = await generateThemes(narrative, colorAnalysis, sanitizedTrip);

    if (!themeOptions || themeOptions.length === 0) {
      sendError(context, "Failed to generate themes", 500, headers);
      return;
    }

    // Find recommended theme
    const recommended = themeOptions.find(t => t.recommended) || themeOptions[0];

    // Build final personalization object
    const personalization = {
      generatedAt: new Date().toISOString(),
      generatedBy: "ai-assist-v1",
      mode,

      narrativeArc: narrative.narrativeArc,

      dayNicknames: Object.fromEntries(
        narrative.days.map(d => [d.dayNum, d.nickname])
      ),

      dayBackgrounds: Object.fromEntries(
        narrative.days.map(d => {
          const resolved = resolvedImages.days?.find(r => r.dayNum === d.dayNum);
          return [d.dayNum, {
            query: d.bgQuery,
            mood: d.bgMood,
            url: resolved?.bgImage?.url || null,
            thumb: resolved?.bgImage?.thumb || null,
            credit: resolved?.bgImage?.credit || null,
            creditUrl: resolved?.bgImage?.creditUrl || null,
            color: resolved?.bgImage?.color || null
          }];
        })
      ),

      eventCards: Object.fromEntries(
        (resolvedImages.events || []).map(e => [e.eventId, {
          cardStyle: e.cardStyle || "minimal",
          images: (e.images || []).map(img => ({
            url: img?.url || null,
            thumb: img?.thumb || null,
            small: img?.small || null,
            credit: img?.credit || null,
            creditUrl: img?.creditUrl || null,
            color: img?.color || null
          }))
        }])
      ),

      // Legacy format for backwards compatibility
      eventImages: Object.fromEntries(
        (resolvedImages.events || [])
          .filter(e => e.images && e.images.length > 0)
          .map(e => [e.eventId, {
            url: e.images[0]?.url || null,
            thumb: e.images[0]?.thumb || null,
            credit: e.images[0]?.credit || null
          }])
      ),

      colorAnalysis,
      themeOptions,
      selectedTheme: recommended.id,
      theme: recommended
    };

    // Save personalization to trip
    const { etag, timestamp, ...existingTrip } = tripEntity;
    const updatedTrip = {
      ...existingTrip,
      partitionKey: "trips",
      rowKey: tripId,
      personalization: JSON.stringify(personalization)
    };

    await upsertEntity(TABLES.TRIPS, updatedTrip);

    // Update rate limit
    await upsertEntity(TABLES.RATE_LIMITS, {
      partitionKey: "personalize",
      rowKey: rateLimitKey,
      count: (rateLimitEntity?.count || 0) + 1,
      lastUpdated: new Date().toISOString()
    }).catch(err => context.log("Rate limit update failed:", err.message));

    // Log summary of what was generated
    const nicknameCount = Object.keys(personalization.dayNicknames || {}).length;
    const imageCount = Object.values(personalization.dayBackgrounds || {}).filter(bg => bg?.url).length;
    const themeCount = (personalization.themeOptions || []).length;

    context.log("[Personalize] ===== SUMMARY =====");
    context.log(`[Personalize] Trip: ${tripEntity.name}`);
    context.log(`[Personalize] Days processed: ${nicknameCount}`);
    context.log(`[Personalize] Images resolved: ${imageCount}`);
    context.log(`[Personalize] Themes generated: ${themeCount}`);
    context.log(`[Personalize] Selected theme: ${personalization.theme?.name || 'None'}`);
    context.log(`[Personalize] Narrative arc: ${personalization.narrativeArc?.theme || 'None'}`);
    context.log("[Personalize] Day nicknames:");
    Object.entries(personalization.dayNicknames || {}).forEach(([day, nickname]) => {
      context.log(`[Personalize]   Day ${day}: "${nickname}"`);
    });
    context.log("[Personalize] ===================");

    sendSuccess(context, { personalization }, 200, headers);

  } catch (err) {
    context.log.error("[Personalize] Error:", err);
    context.log.error("[Personalize] Stack:", err.stack);
    // Return detailed error for debugging
    sendError(context, "Personalization failed: " + err.message + " | Stack: " + (err.stack || "").split("\n").slice(0, 3).join(" <- "), 500, headers);
  }
};
