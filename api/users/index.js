const {
  TABLES,
  getEntity,
  queryByPartition,
  upsertEntity
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  sendError,
  sendSuccess
} = require("../shared/validation");

module.exports = async function (context, req) {
  const headers = getHeaders("GET, PUT, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, PUT, OPTIONS");
    return;
  }

  const userId = context.bindingData.userId;

  try {
    if (userId === "me") {
      // /api/users/me - Current user operations
      if (req.method === "GET") {
        return await getCurrentUser(context, req, headers);
      }
      if (req.method === "PUT") {
        return await updateCurrentUser(context, req, headers);
      }
    } else if (userId) {
      // /api/users/{userId} - Specific user operations
      if (req.method === "GET") {
        return await getUser(context, userId, headers);
      }
    } else {
      sendError(context, "User ID required", 400, headers);
      return;
    }

    sendError(context, "Method not allowed", 405, headers);

  } catch (err) {
    console.error("Users API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Get current user from session
async function getCurrentUser(context, req, headers) {
  // Get user ID from request (could be from header, query, or body)
  const userId = req.headers["x-user-id"] || req.query.userId;

  if (!userId) {
    // Check Easy Auth
    const clientPrincipalHeader = req.headers["x-ms-client-principal"];
    if (clientPrincipalHeader) {
      try {
        const decoded = Buffer.from(clientPrincipalHeader, "base64").toString("utf8");
        const clientPrincipal = JSON.parse(decoded);
        const providerId = clientPrincipal.userId;

        // Find user by Google ID
        const users = await queryByPartition(TABLES.USERS, "users");
        const user = users.find(u => u.googleId === providerId);

        if (user) {
          return sendUserResponse(context, user, headers);
        }
      } catch (err) {
        console.error("Error parsing client principal:", err);
      }
    }

    sendError(context, "Not authenticated", 401, headers);
    return;
  }

  const user = await getEntity(TABLES.USERS, "users", userId);
  if (!user) {
    sendError(context, "User not found", 404, headers);
    return;
  }

  return sendUserResponse(context, user, headers);
}

// Get user by ID
async function getUser(context, userId, headers) {
  const user = await getEntity(TABLES.USERS, "users", userId);
  if (!user) {
    sendError(context, "User not found", 404, headers);
    return;
  }

  // Return limited public info
  sendSuccess(context, {
    id: user.rowKey,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl || null,
    profileLevel: user.profileLevel
  }, 200, headers);
}

// Update current user profile
async function updateCurrentUser(context, req, headers) {
  const userId = req.headers["x-user-id"] || req.query.userId || req.body?.userId;

  if (!userId) {
    sendError(context, "Not authenticated", 401, headers);
    return;
  }

  const user = await getEntity(TABLES.USERS, "users", userId);
  if (!user) {
    sendError(context, "User not found", 404, headers);
    return;
  }

  const { displayName, email, avatarUrl } = req.body || {};

  // Update allowed fields
  if (displayName && displayName.trim().length > 0) {
    user.displayName = displayName.trim();
  }
  if (email !== undefined) {
    user.email = email ? email.trim().toLowerCase() : null;
  }
  if (avatarUrl !== undefined) {
    user.avatarUrl = avatarUrl || null;
  }

  // Update profile level based on completeness
  user.profileLevel = calculateProfileLevel(user);
  user.lastActiveAt = new Date().toISOString();

  await upsertEntity(TABLES.USERS, user);

  return sendUserResponse(context, user, headers);
}

// Calculate profile level based on filled fields
function calculateProfileLevel(user) {
  let score = 0;

  if (user.displayName) score += 1;
  if (user.email) score += 1;
  if (user.avatarUrl) score += 1;
  if (user.googleId) score += 1;

  if (score >= 4) return "full";
  if (score >= 2) return "partial";
  return "basic";
}

// Send user response
function sendUserResponse(context, user, headers) {
  sendSuccess(context, {
    id: user.rowKey,
    displayName: user.displayName,
    email: user.email || null,
    avatarUrl: user.avatarUrl || null,
    profileLevel: user.profileLevel || "basic",
    googleLinked: !!user.googleId,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt
  }, 200, headers);
}
