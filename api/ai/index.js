const {
  TABLES,
  upsertEntity,
  generateRowKey,
  queryByPartition,
  getEntity
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

// Tools the AI can use
const TOOLS = [
  {
    name: "create_event",
    description: "Create a new event on the trip itinerary. Use this when the user asks to add an activity, meal, flight, hotel, or any other event to their trip.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Event date in YYYY-MM-DD format"
        },
        time: {
          type: "string",
          description: "Event time in HH:MM format (24-hour)"
        },
        type: {
          type: "string",
          enum: ["flight", "hotel", "activity", "meal", "transport", "other"],
          description: "Type of event"
        },
        title: {
          type: "string",
          description: "Event title/name"
        },
        details: {
          type: "string",
          description: "Additional details about the event"
        },
        location: {
          type: "string",
          description: "Location or venue name"
        }
      },
      required: ["date", "time", "type", "title"]
    }
  }
];

module.exports = async function (context, req) {
  const headers = getHeaders("POST, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "POST, OPTIONS");
    return;
  }

  // Use shared auth that accepts both trip-level and traveler-specific codes
  const auth = await requireTravelerAuth(context, req, { methods: "POST, OPTIONS" });
  if (!auth) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendError(context, "AI service not configured", 500, headers);
    return;
  }

  const { system, messages, max_tokens = 1024, tripId } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    sendError(context, "Missing messages array", 400, headers);
    return;
  }

  try {
    // First API call with tools
    let response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens,
        system: system || "",
        messages,
        tools: TOOLS
      })
    });

    let data = await response.json();

    if (!response.ok) {
      sendError(context, "AI error: " + (data.error?.message || "Unknown"), response.status, headers);
      return;
    }

    // Check if Claude wants to use a tool
    if (data.stop_reason === "tool_use") {
      const toolUseBlock = data.content.find(block => block.type === "tool_use");

      if (toolUseBlock && toolUseBlock.name === "create_event") {
        const eventInput = toolUseBlock.input;
        const effectiveTripId = tripId || auth.tripId;

        // Create the event
        const eventResult = await createEventFromAI(effectiveTripId, eventInput);

        // Send tool result back to Claude for final response
        const followUpMessages = [
          ...messages,
          { role: "assistant", content: data.content },
          {
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(eventResult)
            }]
          }
        ];

        // Get Claude's final response
        response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens,
            system: system || "",
            messages: followUpMessages,
            tools: TOOLS
          })
        });

        data = await response.json();

        if (!response.ok) {
          sendError(context, "AI error: " + (data.error?.message || "Unknown"), response.status, headers);
          return;
        }
      }
    }

    sendSuccess(context, {
      content: data.content,
      stop_reason: data.stop_reason
    }, 200, headers);

  } catch (err) {
    console.error("[AI] Error:", err);
    sendError(context, err.message, 500, headers);
  }
};

// Create an event from AI tool call
async function createEventFromAI(tripId, input) {
  try {
    const { date, time, type, title, details, location } = input;

    // Ensure day exists
    await ensureDayExists(tripId, date, { location });

    // Generate event ID
    const eventId = generateRowKey("evt");
    const partitionKey = `${tripId}_${date}`;

    // Build event entity
    const event = {
      partitionKey,
      rowKey: eventId,
      id: eventId,
      date,
      time,
      type,
      title,
      subtitle: details || null,
      where: location || null,
      travelers: JSON.stringify(["all"]),
      status: "confirmed",
      isUserGenerated: true,
      createdAt: new Date().toISOString(),
      createdBy: "ai-concierge"
    };

    await upsertEntity(TABLES.EVENTS, event);

    console.log(`[AI] Created event: ${title} on ${date}`);

    return {
      success: true,
      event: {
        id: eventId,
        date,
        time,
        type,
        title,
        location
      },
      message: `Created "${title}" on ${date} at ${time}`
    };

  } catch (err) {
    console.error("[AI] Failed to create event:", err);
    return {
      success: false,
      error: err.message
    };
  }
}

// Ensure a day record exists for the given date
async function ensureDayExists(tripId, date, eventData = {}) {
  const dayRowKey = `day_${date}`;

  // Check if day already exists
  const existingDay = await getEntity(TABLES.DAYS, tripId, dayRowKey);
  if (existingDay) {
    return existingDay;
  }

  // Parse date to create label
  const dateObj = new Date(date + 'T12:00:00Z');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayOfWeek = dayNames[dateObj.getUTCDay()];
  const month = monthNames[dateObj.getUTCMonth()];
  const dayNum = dateObj.getUTCDate();

  // Calculate day number by counting existing days + 1
  const existingDays = await queryByPartition(TABLES.DAYS, tripId);
  const dayNumber = existingDays.length + 1;

  // Create day record
  const day = {
    partitionKey: tripId,
    rowKey: dayRowKey,
    date,
    dayNum: dayNumber,
    label: `${dayOfWeek}, ${month} ${dayNum}`,
    location: eventData.location || null,
    destination: eventData.location || null,
    theme: `Day ${dayNumber}`,
    createdAt: new Date().toISOString()
  };

  await upsertEntity(TABLES.DAYS, day);
  console.log(`[AI] Auto-created day for ${date}`);

  return day;
}
