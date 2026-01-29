function validateRequest(req) {
  const tripId = req.body?.tripId || req.query?.tripId;
  const accessCode = req.body?.accessCode || req.query?.accessCode;

  if (!tripId) return { valid: false, error: "Missing tripId" };
  if (!accessCode) return { valid: false, error: "Missing accessCode" };

  const codesJson = process.env.TRIP_ACCESS_CODES || "{}";
  let codes;
  try {
    codes = JSON.parse(codesJson);
  } catch (e) {
    return { valid: false, error: "Server configuration error" };
  }

  const expectedCode = codes[tripId];
  if (!expectedCode) return { valid: false, error: "Trip not found" };
  if (accessCode.toLowerCase() !== expectedCode.toLowerCase()) {
    return { valid: false, error: "Invalid access code" };
  }

  return { valid: true, tripId };
}

module.exports = async function (context, req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers };
    return;
  }

  const auth = validateRequest(req);
  if (!auth.valid) {
    const status = auth.error === "Trip not found" ? 404 :
                   auth.error === "Invalid access code" ? 403 : 401;
    context.res = { status, headers, body: { error: auth.error } };
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, headers, body: { error: "AI service not configured" } };
    return;
  }

  const { system, messages, max_tokens = 1024 } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    context.res = { status: 400, headers, body: { error: "Missing messages array" } };
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
      context.res = { status: response.status, headers, body: { error: "AI error", details: data } };
      return;
    }

    context.res = { status: 200, headers, body: { content: data.content } };

  } catch (err) {
    context.res = { status: 500, headers, body: { error: err.message } };
  }
};
