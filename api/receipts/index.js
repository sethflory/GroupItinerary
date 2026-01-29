const {
  getHeaders,
  handleOptions,
  requireAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

module.exports = async function (context, req) {
  const headers = getHeaders("POST, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "POST, OPTIONS");
    return;
  }

  const action = context.bindingData.action || "parse";

  // Auth is optional for receipt parsing (can be done pre-trip)
  // But we'll still validate if credentials are provided
  const tripId = req.body?.tripId || req.query?.tripId;
  const accessCode = req.body?.accessCode || req.query?.accessCode;

  try {
    switch (action) {
      case "parse":
        return await parseReceipt(context, req.body, headers);
      default:
        sendError(context, "Unknown action", 404, headers);
    }
  } catch (err) {
    console.error("Receipts API error:", err);
    sendError(context, err.message, 500, headers);
  }
};

async function parseReceipt(context, body, headers) {
  const { image, imageType, text, tripContext } = body || {};

  // Require either image or text
  if (!image && !text) {
    sendError(context, "Missing image or text data", 400, headers);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    sendError(context, "AI service not configured", 500, headers);
    return;
  }

  // For image input, validate media type
  let mediaType = null;
  if (image) {
    mediaType = imageType || detectMediaType(image);
    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!supportedTypes.includes(mediaType)) {
      sendError(context, `Unsupported file type: ${mediaType}. Please upload a JPG, PNG, GIF, or WebP image.`, 400, headers);
      return;
    }
  }

  const isTextMode = !image && text;

  // Build the prompt for extracting event data
  const systemPrompt = `You are an expert at extracting travel itinerary information from receipts, confirmations, and booking documents.

Extract all relevant travel events from the provided ${isTextMode ? 'text' : 'image'}. For each event found, extract:
- type: "flight", "hotel", "activity", "meal", "transport", or "other"
- title: Brief description (e.g., "Flight to Athens", "Marriott Hotel Check-in")
- date: In YYYY-MM-DD format
- time: In HH:MM format (24-hour), or null if not specified
- endTime: End time if applicable (for hotels checkout, flight arrival)
- location: City or venue name
- details: Any additional relevant details

For FLIGHTS specifically, also extract:
- flightCode: Flight number (e.g., "UA 123")
- airline: Airline name
- from: Departure airport code or city
- to: Arrival airport code or city
- departureTime: Departure time
- arrivalTime: Arrival time

For HOTELS specifically, also extract:
- hotelName: Name of the hotel
- address: Full address if available
- checkIn: Check-in date
- checkOut: Check-out date
- confirmationNumber: Booking reference if visible

Return ONLY valid JSON in this exact format:
{
  "events": [
    {
      "type": "flight",
      "title": "Flight to Athens",
      "date": "2026-02-01",
      "time": "16:30",
      "endTime": "08:45",
      "location": "Columbus",
      "details": "Economy class, Window seat",
      "flightCode": "UA 123",
      "airline": "United Airlines",
      "from": "CMH",
      "to": "ATH",
      "departureTime": "16:30",
      "arrivalTime": "08:45+1"
    }
  ],
  "confidence": "high",
  "notes": "Any additional observations about the document"
}

If you cannot extract any events, return:
{
  "events": [],
  "confidence": "low",
  "notes": "Explanation of why no events could be extracted"
}`;

  let userMessage;
  if (isTextMode) {
    userMessage = tripContext
      ? `Extract travel events from this confirmation text. Trip context: ${tripContext}\n\nText to analyze:\n${text}`
      : `Extract all travel events from this confirmation text:\n\n${text}`;
  } else {
    userMessage = tripContext
      ? `Extract travel events from this receipt/confirmation. Trip context: ${tripContext}`
      : "Extract all travel events from this receipt or confirmation document.";
  }

  try {
    console.log(`[Receipts] Sending ${isTextMode ? 'text' : 'image'} to Claude for parsing...`);

    // Build message content based on input type
    const messageContent = isTextMode
      ? [{ type: "text", text: userMessage }]
      : [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: image.replace(/^data:image\/\w+;base64,/, "") // Strip data URL prefix if present
            }
          },
          { type: "text", text: userMessage }
        ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Receipts] Claude API error - status:", response.status);
      console.error("[Receipts] Claude API error - body:", JSON.stringify(data, null, 2));
      const errorMsg = data.error?.message || (typeof data.error === 'string' ? data.error : null) || data.message || JSON.stringify(data) || "AI processing failed";
      sendError(context, errorMsg, response.status, headers);
      return;
    }

    // Extract the JSON from Claude's response
    const content = data.content[0]?.text || "";
    console.log("[Receipts] Raw response:", content.substring(0, 200));

    // Try to parse the JSON response
    let result;
    try {
      // Find JSON in the response (might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseErr) {
      console.error("[Receipts] Failed to parse response:", parseErr);
      sendError(context, "Failed to parse AI response", 500, headers);
      return;
    }

    console.log("[Receipts] Extracted", result.events?.length || 0, "events");

    sendSuccess(context, {
      success: true,
      events: result.events || [],
      confidence: result.confidence || "medium",
      notes: result.notes || null
    }, 200, headers);

  } catch (err) {
    console.error("[Receipts] Processing error:", err);
    sendError(context, "Failed to process receipt: " + err.message, 500, headers);
  }
}

function detectMediaType(base64Data) {
  // Check for common image signatures in base64
  if (base64Data.startsWith("/9j/")) return "image/jpeg";
  if (base64Data.startsWith("iVBORw")) return "image/png";
  if (base64Data.startsWith("R0lGOD")) return "image/gif";
  if (base64Data.startsWith("UklGR")) return "image/webp";
  if (base64Data.startsWith("JVBERi")) return "application/pdf";

  // Default to JPEG
  return "image/jpeg";
}
