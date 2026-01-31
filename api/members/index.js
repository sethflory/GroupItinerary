const {
  TABLES,
  getEntity,
  queryByPartition,
  upsertEntity,
  deleteEntity,
  generateRowKey
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  sendError,
  sendSuccess,
  requireTravelerAuth
} = require("../shared/validation");

module.exports = async function (context, req) {
  const headers = getHeaders("GET, POST, PUT, DELETE, OPTIONS");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    handleOptions(context, "GET, POST, PUT, DELETE, OPTIONS");
    return;
  }

  const tripId = context.bindingData.tripId;
  const memberId = context.bindingData.memberId;

  // Validate access (supports both trip-level and traveler-specific codes)
  const auth = await requireTravelerAuth(context, req, { methods: "GET, POST, PUT, DELETE, OPTIONS" });
  if (!auth) return;

  if (tripId !== auth.tripId) {
    sendError(context, "Trip ID mismatch", 403, headers);
    return;
  }

  try {
    if (!memberId) {
      // /api/trips/{tripId}/members
      if (req.method === "GET") {
        return await listMembers(context, tripId, headers);
      }
      if (req.method === "POST") {
        return await addMember(context, tripId, req.body, headers);
      }
    } else {
      // /api/trips/{tripId}/members/{memberId}
      if (req.method === "GET") {
        return await getMember(context, tripId, memberId, headers);
      }
      if (req.method === "PUT") {
        return await updateMember(context, tripId, memberId, req.body, headers);
      }
      if (req.method === "DELETE") {
        return await deleteMember(context, tripId, memberId, headers);
      }
    }

    sendError(context, "Method not allowed", 405, headers);

  } catch (err) {
    console.error("Members API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// List all members for a trip
async function listMembers(context, tripId, headers) {
  const members = await queryByPartition(TABLES.TRIP_MEMBERS, tripId);

  const formatted = members.map(m => formatMember(m));

  sendSuccess(context, { members: formatted }, 200, headers);
}

// Get single member
async function getMember(context, tripId, memberId, headers) {
  const rowKey = memberId.startsWith("member_") ? memberId : `member_${memberId}`;
  const member = await getEntity(TABLES.TRIP_MEMBERS, tripId, rowKey);

  if (!member) {
    sendError(context, "Member not found", 404, headers);
    return;
  }

  sendSuccess(context, formatMember(member), 200, headers);
}

// Add new member to trip (generates trip code)
async function addMember(context, tripId, body, headers) {
  const { displayName, email, color, initials, role, group } = body || {};

  if (!displayName || displayName.trim().length < 1) {
    sendError(context, "Display name is required", 400, headers);
    return;
  }

  // Generate unique trip code
  const tripCode = generateTripCode(displayName);

  // Check for duplicate code
  const existingMembers = await queryByPartition(TABLES.TRIP_MEMBERS, tripId);
  if (existingMembers.some(m => m.tripCode?.toLowerCase() === tripCode.toLowerCase())) {
    // Add random suffix if collision
    tripCode = tripCode + Math.random().toString(36).substring(2, 5);
  }

  const memberId = generateRowKey("member");
  const now = new Date().toISOString();

  const member = {
    partitionKey: tripId,
    rowKey: memberId,
    userId: null, // Will be set when traveler registers
    role: role || "traveler",
    tripCode,
    displayName: displayName.trim(),
    color: color || generateColor(),
    initials: initials || generateInitials(displayName),
    group: group || null,
    createdAt: now,
    joinedAt: null, // Set when traveler actually joins
    onboardingComplete: false
  };

  await upsertEntity(TABLES.TRIP_MEMBERS, member);

  sendSuccess(context, {
    ...formatMember(member),
    tripCode // Include the generated code in response
  }, 201, headers);
}

// Update member
async function updateMember(context, tripId, memberId, body, headers) {
  const rowKey = memberId.startsWith("member_") ? memberId : `member_${memberId}`;
  const member = await getEntity(TABLES.TRIP_MEMBERS, tripId, rowKey);

  if (!member) {
    sendError(context, "Member not found", 404, headers);
    return;
  }

  // Allowed fields to update
  const { displayName, color, initials, role, group, onboardingComplete } = body || {};

  if (displayName !== undefined) member.displayName = displayName.trim();
  if (color !== undefined) member.color = color;
  if (initials !== undefined) member.initials = initials;
  if (role !== undefined) member.role = role;
  if (group !== undefined) member.group = group;
  if (onboardingComplete !== undefined) member.onboardingComplete = onboardingComplete;

  await upsertEntity(TABLES.TRIP_MEMBERS, member);

  sendSuccess(context, formatMember(member), 200, headers);
}

// Delete member from trip
async function deleteMember(context, tripId, memberId, headers) {
  const rowKey = memberId.startsWith("member_") ? memberId : `member_${memberId}`;

  const deleted = await deleteEntity(TABLES.TRIP_MEMBERS, tripId, rowKey);

  if (!deleted) {
    sendError(context, "Member not found", 404, headers);
    return;
  }

  sendSuccess(context, { success: true }, 200, headers);
}

// Format member for response
function formatMember(member) {
  return {
    id: member.rowKey,
    userId: member.userId || null,
    role: member.role || "traveler",
    displayName: member.displayName,
    color: member.color,
    initials: member.initials,
    group: member.group || null,
    joinedAt: member.joinedAt || null,
    onboardingComplete: member.onboardingComplete || false,
    hasRegistered: !!member.userId
  };
}

// Generate a trip code from display name
function generateTripCode(displayName) {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 8);

  const year = new Date().getFullYear().toString().substring(2);
  return `${base}${year}`;
}

// Generate a random color for traveler
function generateColor() {
  const colors = [
    "#4a90d9", // Blue
    "#d94a8c", // Pink
    "#4ad99a", // Green
    "#d9a84a", // Orange
    "#9a4ad9", // Purple
    "#4ad9d9", // Cyan
    "#d94a4a", // Red
    "#8cd94a"  // Lime
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate initials from display name
function generateInitials(displayName) {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
}
