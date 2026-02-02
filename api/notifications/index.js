const {
  TABLES,
  ensureTable,
  queryByPartition,
  upsertEntity,
  deleteEntity,
  generateRowKey
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

module.exports = async function (context, req) {
  const headers = getHeaders("GET, POST, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, POST, OPTIONS");
    return;
  }

  // Extract path parameters
  const action = context.bindingData.action;

  // Validate access
  const auth = await requireTravelerAuth(context, req, { methods: "GET, POST, OPTIONS" });
  if (!auth) return;

  const tripId = auth.tripId;

  // Ensure Notifications table exists
  await ensureTable(TABLES.NOTIFICATIONS);

  try {
    switch (action) {
      case "recent":
      case undefined:
        if (req.method === "GET") {
          return await getRecentNotifications(context, tripId, req.query, headers);
        }
        sendError(context, "Method not allowed", 405, headers);
        return;

      case "create":
        if (req.method === "POST") {
          return await createNotification(context, tripId, req.body, auth, headers);
        }
        sendError(context, "Method not allowed", 405, headers);
        return;

      default:
        sendError(context, "Unknown action", 404, headers);
    }

  } catch (err) {
    console.error("Notifications API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Get recent notifications for a trip
async function getRecentNotifications(context, tripId, query, headers) {
  const { limit = 20, since } = query;

  let notifications = await queryByPartition(TABLES.NOTIFICATIONS, tripId);

  // Filter by timestamp if 'since' provided
  if (since) {
    notifications = notifications.filter(n => n.createdAt > since);
  }

  // Filter out expired notifications
  const now = new Date().toISOString();
  notifications = notifications.filter(n => !n.expiresAt || n.expiresAt > now);

  // Sort by creation date (newest first)
  notifications.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  // Apply limit
  const limitNum = parseInt(limit, 10) || 20;
  notifications = notifications.slice(0, limitNum);

  const formatted = notifications.map(formatNotification);
  sendSuccess(context, { notifications: formatted, count: formatted.length }, 200, headers);
}

// Create a new notification
async function createNotification(context, tripId, body, auth, headers) {
  const { type, message, icon, relatedId, expiresIn } = body;

  if (!type || !message) {
    sendError(context, "Missing required fields: type, message", 400, headers);
    return;
  }

  const notifId = generateRowKey("notif");
  const now = new Date();

  // Calculate expiration time (default 24 hours)
  let expiresAt = null;
  if (expiresIn) {
    expiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString();
  } else {
    // Default expiry: 24 hours
    expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  const notification = {
    partitionKey: tripId,
    rowKey: notifId,
    id: notifId,
    tripId,
    type,
    message,
    icon: icon || getDefaultIcon(type),
    travelerId: auth.travelerId || null,
    travelerName: auth.travelerName || null,
    relatedId: relatedId || null,
    createdAt: now.toISOString(),
    expiresAt
  };

  await upsertEntity(TABLES.NOTIFICATIONS, notification);

  sendSuccess(context, formatNotification(notification), 201, headers);
}

// Get default icon for notification type
function getDefaultIcon(type) {
  const icons = {
    hunt_started: "🎯",
    hunt_item_claimed: "✅",
    hunt_ended: "🏆",
    trivia_starting: "🧠",
    trivia_ended: "🎉",
    trivia_answer: "💡",
    poll_result: "🗳️",
    poll_created: "📊",
    poll_closed: "🔒",
    photo_uploaded: "📷",
    event_added: "📅",
    member_joined: "👋"
  };
  return icons[type] || "🔔";
}

// Format notification for API response
function formatNotification(entity) {
  return {
    id: entity.id || entity.rowKey,
    tripId: entity.tripId || entity.partitionKey,
    type: entity.type,
    message: entity.message,
    icon: entity.icon,
    travelerId: entity.travelerId,
    travelerName: entity.travelerName,
    relatedId: entity.relatedId,
    createdAt: entity.createdAt,
    expiresAt: entity.expiresAt
  };
}

// Helper to create notification from other APIs
async function createNotificationInternal(tripId, type, message, options = {}) {
  await ensureTable(TABLES.NOTIFICATIONS);

  const notifId = generateRowKey("notif");
  const now = new Date();

  const notification = {
    partitionKey: tripId,
    rowKey: notifId,
    id: notifId,
    tripId,
    type,
    message,
    icon: options.icon || getDefaultIcon(type),
    travelerId: options.travelerId || null,
    travelerName: options.travelerName || null,
    relatedId: options.relatedId || null,
    createdAt: now.toISOString(),
    expiresAt: options.expiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  };

  await upsertEntity(TABLES.NOTIFICATIONS, notification);
  return notification;
}

module.exports.createNotificationInternal = createNotificationInternal;
