module.exports = async function (context, req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Environment Variables' })
    };
    return;
  }

  // Parse request body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    context.res = {
      status: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    };
    return;
  }

  if (!body || !body.messages || !Array.isArray(body.messages)) {
    context.res = {
      status: 400,
      headers,
      body: JSON.stringify({ error: 'Missing messages array in request' })
    };
    return;
  }

  // Call Anthropic API using fetch (built into Node.js 18+)
  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: body.max_tokens || 1024,
        system: body.system,
        messages: body.messages
      })
    });

    const result = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      context.res = {
        status: 500,
        headers,
        body: JSON.stringify({
          error: 'Anthropic API error',
          details: result.error?.message || JSON.stringify(result)
        })
      };
      return;
    }

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: 'Request failed', details: err.message })
    };
  }
};
