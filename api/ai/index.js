const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Inline trip validation (shared modules can have issues in Azure managed functions)
function validateRequest(req) {
  const tripId = req.body?.tripId || req.query?.tripId;
  const accessCode = req.body?.accessCode || req.query?.accessCode;

  if (!tripId) return { valid: false, error: 'Missing tripId' };
  if (!accessCode) return { valid: false, error: 'Missing accessCode' };

  const codesJson = process.env.TRIP_ACCESS_CODES || '{}';
  let codes;
  try {
    codes = JSON.parse(codesJson);
  } catch (e) {
    return { valid: false, error: 'Server configuration error' };
  }

  const expectedCode = codes[tripId];
  if (!expectedCode) return { valid: false, error: 'Trip not found' };
  if (accessCode.toLowerCase() !== expectedCode.toLowerCase()) {
    return { valid: false, error: 'Invalid access code' };
  }

  return { valid: true, tripId, accessCode };
}

module.exports = async function (context, req) {
  context.log('AI API called:', req.method);

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  if (req.method !== 'POST') {
    context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    return;
  }

  try {
    const authResult = validateRequest(req);
    if (!authResult.valid) {
      const status = authResult.error === 'Trip not found' ? 404 :
                     authResult.error === 'Invalid access code' ? 403 : 401;
      context.res = { status, headers, body: { error: authResult.error } };
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      context.log.error('ANTHROPIC_API_KEY not configured');
      context.res = { status: 500, headers, body: { error: 'AI service not configured' } };
      return;
    }

    const { system, messages, max_tokens = 1024 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      context.res = { status: 400, headers, body: { error: 'Missing or invalid messages array' } };
      return;
    }

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens,
        system: system || '',
        messages
      })
    });

    const responseText = await anthropicResponse.text();

    if (!anthropicResponse.ok) {
      context.log.error('Anthropic API error:', anthropicResponse.status, responseText);
      context.res = { status: anthropicResponse.status, headers, body: { error: 'AI service error', details: responseText } };
      return;
    }

    const data = JSON.parse(responseText);
    context.res = { status: 200, headers, body: { content: data.content } };

  } catch (error) {
    context.log.error('Error in AI API:', error);
    context.res = { status: 500, headers, body: { error: 'Internal server error', details: error.message } };
  }
};
