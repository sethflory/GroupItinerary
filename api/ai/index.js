const { validateRequest } = require('../shared/tripAuth');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

module.exports = async function (context, req) {
  context.log('AI API called:', req.method);

  // CORS headers
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

  // Only allow POST
  if (req.method !== 'POST') {
    context.res = {
      status: 405,
      headers,
      body: { error: 'Method not allowed' }
    };
    return;
  }

  try {
    // Validate trip access
    const authResult = validateRequest(req);
    if (!authResult.valid) {
      const status = authResult.error === 'Trip not found' ? 404 :
                     authResult.error === 'Invalid access code' ? 403 : 401;
      context.res = {
        status,
        headers,
        body: { error: authResult.error }
      };
      return;
    }

    // Get Anthropic API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      context.log.error('ANTHROPIC_API_KEY not configured');
      context.res = {
        status: 500,
        headers,
        body: { error: 'AI service not configured' }
      };
      return;
    }

    // Extract request parameters
    const { system, messages, max_tokens = 1024 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      context.res = {
        status: 400,
        headers,
        body: { error: 'Missing or invalid messages array' }
      };
      return;
    }

    // Proxy request to Anthropic API
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
      context.res = {
        status: anthropicResponse.status,
        headers,
        body: { error: 'AI service error', details: responseText }
      };
      return;
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      context.log.error('Failed to parse Anthropic response:', responseText);
      context.res = {
        status: 500,
        headers,
        body: { error: 'Invalid response from AI service' }
      };
      return;
    }

    // Return response in expected format
    context.res = {
      status: 200,
      headers,
      body: {
        content: data.content
      }
    };

  } catch (error) {
    context.log.error('Error in AI API:', error);
    context.res = {
      status: 500,
      headers,
      body: { error: 'Internal server error', details: error.message }
    };
  }
};
