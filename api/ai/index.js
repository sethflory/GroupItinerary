const {
  getHeaders,
  handleOptions,
  requireTravelerAuth,
  sendError,
  sendSuccess
} = require("../shared/validation");

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

  const { system, messages, max_tokens = 1024 } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    sendError(context, "Missing messages array", 400, headers);
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      sendError(context, "AI error: " + (data.error?.message || "Unknown"), response.status, headers);
      return;
    }

    sendSuccess(context, { content: data.content }, 200, headers);

  } catch (err) {
    sendError(context, err.message, 500, headers);
  }
};
