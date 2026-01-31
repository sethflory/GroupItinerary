const {
  TABLES,
  getEntity,
  queryByPartition,
  upsertEntity,
  generateRowKey
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
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

  const action = context.bindingData.action;

  try {
    switch (action) {
      case "trip-code":
        // POST /api/auth/trip-code - Validate trip code, return session
        if (req.method === "POST") {
          return await validateTripCode(context, req, headers);
        }
        break;

      case "register":
        // POST /api/auth/register - Lightweight registration
        if (req.method === "POST") {
          return await registerUser(context, req, headers);
        }
        break;

      case "session":
        // GET /api/auth/session - Get current session (from Easy Auth headers)
        if (req.method === "GET") {
          return await getSession(context, req, headers);
        }
        break;

      case "google":
        // POST /api/auth/google - Handle Google OAuth (via Easy Auth)
        if (req.method === "POST") {
          return await handleGoogleAuth(context, req, headers);
        }
        break;

      default:
        sendError(context, "Unknown auth action", 404, headers);
        return;
    }

    sendError(context, "Method not allowed", 405, headers);

  } catch (err) {
    console.error("Auth API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Validate trip code and return session info
async function validateTripCode(context, req, headers) {
  const { tripId, accessCode } = req.body || {};

  if (!tripId) {
    sendError(context, "Missing tripId", 400, headers);
    return;
  }
  if (!accessCode) {
    sendError(context, "Missing accessCode", 400, headers);
    return;
  }

  // Check if trip exists
  const trip = await getEntity(TABLES.TRIPS, "trips", tripId);
  if (!trip) {
    sendError(context, "Trip not found", 404, headers);
    return;
  }

  // First, check trip-level access code (admin access)
  const tripCodes = JSON.parse(process.env.TRIP_ACCESS_CODES || "{}");
  const tripLevelCode = tripCodes[tripId];

  if (tripLevelCode && accessCode.toLowerCase() === tripLevelCode.toLowerCase()) {
    // Admin access - no specific traveler, full access
    sendSuccess(context, {
      valid: true,
      tripId,
      role: "admin",
      userId: null,
      travelerId: null,
      displayName: "Admin",
      needsRegistration: false,
      trip: formatTrip(trip)
    }, 200, headers);
    return;
  }

  // Check TripMembers table for traveler-specific code
  const members = await queryByPartition(TABLES.TRIP_MEMBERS, tripId);
  console.log(`[Auth] Checking ${members.length} TripMembers for tripId=${tripId}, code=${accessCode}`);
  const memberCodes = members.map(m => m.tripCode).filter(Boolean);
  console.log("[Auth] TripMembers codes:", memberCodes);

  const member = members.find(m =>
    m.tripCode && accessCode.toLowerCase() === m.tripCode.toLowerCase()
  );

  if (member) {
    // Found member with matching code
    const user = await getEntity(TABLES.USERS, "users", member.userId);

    sendSuccess(context, {
      valid: true,
      tripId,
      role: member.role || "traveler",
      userId: member.userId,
      travelerId: member.rowKey.replace("member_", ""),
      displayName: member.displayName || (user ? user.displayName : "Traveler"),
      color: member.color,
      initials: member.initials,
      needsRegistration: !user,
      onboardingComplete: member.onboardingComplete || false,
      trip: formatTrip(trip)
    }, 200, headers);
    return;
  }

  // Legacy: Check old Travelers table
  const legacyTravelers = await queryByPartition(TABLES.TRAVELERS, tripId);
  console.log(`[Auth] Checking ${legacyTravelers.length} legacy Travelers for tripId=${tripId}`);
  const legacyCodes = legacyTravelers.map(t => t.accessCode).filter(Boolean);
  console.log("[Auth] Travelers accessCodes:", legacyCodes);

  const legacyTraveler = legacyTravelers.find(t =>
    t.accessCode && accessCode.toLowerCase() === t.accessCode.toLowerCase()
  );

  if (legacyTraveler) {
    // Found in legacy table - they need to complete registration
    sendSuccess(context, {
      valid: true,
      tripId,
      role: "traveler",
      userId: null,
      travelerId: legacyTraveler.rowKey,
      displayName: legacyTraveler.name,
      color: legacyTraveler.color,
      initials: legacyTraveler.initials,
      needsRegistration: true,
      isLegacy: true,
      trip: formatTrip(trip)
    }, 200, headers);
    return;
  }

  // No matching code found
  console.log(`[Auth] No matching code found for: ${accessCode}`);
  sendError(context, "Invalid access code", 403, headers);
}

// Register a new user (lightweight registration)
async function registerUser(context, req, headers) {
  const { tripId, travelerId, displayName, email, accessCode, isLegacy } = req.body || {};

  if (!displayName || displayName.trim().length < 1) {
    sendError(context, "Display name is required", 400, headers);
    return;
  }

  if (!tripId || !accessCode) {
    sendError(context, "Trip ID and access code are required", 400, headers);
    return;
  }

  // Generate user ID
  const userId = generateRowKey("user");
  const now = new Date().toISOString();

  // Create user record
  const user = {
    partitionKey: "users",
    rowKey: userId,
    displayName: displayName.trim(),
    email: email ? email.trim().toLowerCase() : null,
    profileLevel: "basic",
    createdAt: now,
    lastActiveAt: now
  };

  await upsertEntity(TABLES.USERS, user);

  // Get or create trip member record
  let member;
  let memberRowKey;

  if (isLegacy && travelerId) {
    // Migrating from legacy Travelers table
    const legacyTraveler = await getEntity(TABLES.TRAVELERS, tripId, travelerId);
    if (!legacyTraveler) {
      sendError(context, "Legacy traveler not found", 404, headers);
      return;
    }

    memberRowKey = `member_${userId}`;
    member = {
      partitionKey: tripId,
      rowKey: memberRowKey,
      userId: userId,
      role: "traveler",
      tripCode: legacyTraveler.accessCode,
      displayName: displayName.trim(),
      color: legacyTraveler.color,
      initials: legacyTraveler.initials,
      group: legacyTraveler.group,
      joinedAt: now,
      onboardingComplete: false,
      // Preserve legacy ID for backward compatibility
      legacyTravelerId: travelerId
    };
  } else {
    // New member (code already exists in TripMembers)
    const existingMembers = await queryByPartition(TABLES.TRIP_MEMBERS, tripId);
    const existingMember = existingMembers.find(m =>
      m.tripCode && accessCode.toLowerCase() === m.tripCode.toLowerCase()
    );

    if (existingMember) {
      // Update existing member with user ID
      memberRowKey = existingMember.rowKey;
      member = {
        ...existingMember,
        userId: userId,
        displayName: displayName.trim(),
        joinedAt: now,
        onboardingComplete: false
      };
    } else {
      sendError(context, "Trip code not found", 404, headers);
      return;
    }
  }

  await upsertEntity(TABLES.TRIP_MEMBERS, member);

  // Return session
  sendSuccess(context, {
    success: true,
    userId,
    tripId,
    travelerId: memberRowKey.replace("member_", ""),
    role: member.role || "traveler",
    displayName: member.displayName,
    color: member.color,
    initials: member.initials,
    onboardingComplete: false
  }, 201, headers);
}

// Get current session from Azure Easy Auth headers
async function getSession(context, req, headers) {
  // Azure Static Web Apps Easy Auth provides these headers
  const clientPrincipalHeader = req.headers["x-ms-client-principal"];

  if (!clientPrincipalHeader) {
    // Not authenticated via Easy Auth
    sendSuccess(context, {
      authenticated: false,
      provider: null,
      userId: null
    }, 200, headers);
    return;
  }

  try {
    // Decode the client principal
    const decoded = Buffer.from(clientPrincipalHeader, "base64").toString("utf8");
    const clientPrincipal = JSON.parse(decoded);

    // Extract user info
    const provider = clientPrincipal.identityProvider; // "google", "aad", etc.
    const providerId = clientPrincipal.userId; // Provider-specific user ID
    const claims = clientPrincipal.claims || [];

    // Get email and name from claims
    const emailClaim = claims.find(c => c.typ === "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");
    const nameClaim = claims.find(c => c.typ === "name" || c.typ === "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");

    const email = emailClaim?.val;
    const displayName = nameClaim?.val;

    // Check if user exists in our Users table
    let user = null;
    if (provider === "google" && providerId) {
      // Query for user with this Google ID
      const users = await queryByPartition(TABLES.USERS, "users");
      user = users.find(u => u.googleId === providerId);
    }

    sendSuccess(context, {
      authenticated: true,
      provider,
      providerId,
      email,
      displayName,
      userId: user ? user.rowKey : null,
      isLinked: !!user
    }, 200, headers);

  } catch (err) {
    console.error("Error parsing client principal:", err);
    sendSuccess(context, {
      authenticated: false,
      error: "Failed to parse authentication"
    }, 200, headers);
  }
}

// Handle Google OAuth callback (link Google account to user)
async function handleGoogleAuth(context, req, headers) {
  const clientPrincipalHeader = req.headers["x-ms-client-principal"];

  if (!clientPrincipalHeader) {
    sendError(context, "Not authenticated", 401, headers);
    return;
  }

  try {
    const decoded = Buffer.from(clientPrincipalHeader, "base64").toString("utf8");
    const clientPrincipal = JSON.parse(decoded);

    if (clientPrincipal.identityProvider !== "google") {
      sendError(context, "Google authentication required", 400, headers);
      return;
    }

    const providerId = clientPrincipal.userId;
    const claims = clientPrincipal.claims || [];
    const emailClaim = claims.find(c => c.typ === "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");
    const nameClaim = claims.find(c => c.typ === "name");
    const pictureClaim = claims.find(c => c.typ === "picture");

    const email = emailClaim?.val;
    const displayName = nameClaim?.val || email?.split("@")[0] || "User";
    const avatarUrl = pictureClaim?.val;

    // Check if user with this Google ID already exists
    const users = await queryByPartition(TABLES.USERS, "users");
    let user = users.find(u => u.googleId === providerId);

    const now = new Date().toISOString();

    if (user) {
      // Update last active
      user.lastActiveAt = now;
      if (avatarUrl && !user.avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
      await upsertEntity(TABLES.USERS, user);
    } else {
      // Check if user with same email exists (link accounts)
      user = users.find(u => u.email && u.email.toLowerCase() === email?.toLowerCase());

      if (user) {
        // Link Google to existing user
        user.googleId = providerId;
        user.lastActiveAt = now;
        if (avatarUrl && !user.avatarUrl) {
          user.avatarUrl = avatarUrl;
        }
        user.profileLevel = user.profileLevel === "basic" ? "partial" : user.profileLevel;
        await upsertEntity(TABLES.USERS, user);
      } else {
        // Create new user
        const userId = generateRowKey("user");
        user = {
          partitionKey: "users",
          rowKey: userId,
          googleId: providerId,
          email: email?.toLowerCase(),
          displayName,
          avatarUrl,
          profileLevel: "partial",
          createdAt: now,
          lastActiveAt: now
        };
        await upsertEntity(TABLES.USERS, user);
      }
    }

    sendSuccess(context, {
      success: true,
      userId: user.rowKey,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      profileLevel: user.profileLevel,
      canCreateTrips: true
    }, 200, headers);

  } catch (err) {
    console.error("Google auth error:", err);
    sendError(context, "Authentication failed", 500, headers);
  }
}

// Format trip for response
function formatTrip(trip) {
  return {
    id: trip.rowKey,
    name: trip.name,
    subtitle: trip.subtitle,
    dates: trip.dates,
    icon: trip.icon,
    startDate: trip.startDate,
    endDate: trip.endDate
  };
}
