const https = require('https');

module.exports = async function (context, req) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    context.log('AI API called:', req.method);

    // Handle preflight
    if (req.method === 'OPTIONS') {
      context.res = { status: 204, headers };
      return;
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      context.log.error('ANTHROPIC_API_KEY not configured');
      context.res = {
        status: 500,
        headers,
        body: JSON.stringify({ error: 'AI service not configured. Please set ANTHROPIC_API_KEY in Environment Variables.' })
      };
      return;
    }

    // Parse body - handle both string and object
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const { messages, system, max_tokens = 1024 } = body || {};

    if (!messages || !Array.isArray(messages)) {
      context.res = {
        status: 400,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid messages array' })
      };
      return;
    }

    // Build the request to Anthropic
    const anthropicRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens,
      messages
    };

    if (system) {
      anthropicRequest.system = system;
    }

    // Make request to Anthropic API
    const response = await callAnthropic(anthropicRequest, apiKey);

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    context.log.error('Error in AI API:', error.message, error.stack);
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({
        error: 'AI request failed',
        details: error.message
      })
    };
  }
};

function callAnthropic(requestBody, apiKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(requestBody);

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || `Anthropic API error: ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}
