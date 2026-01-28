const https = require('https');

module.exports = async function (context, req) {
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      context.res = { status: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
      return;
    }
  }

  if (!body || !body.messages) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: 'Missing messages' }) };
    return;
  }

  const postData = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: body.max_tokens || 1024,
    system: body.system,
    messages: body.messages
  });

  const options = {
    hostname: 'api.anthropic.com',
    port: 443,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        context.res = {
          status: response.statusCode >= 200 && response.statusCode < 300 ? 200 : 500,
          headers,
          body: data
        };
        resolve();
      });
    });

    request.on('error', (err) => {
      context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
      resolve();
    });

    request.write(postData);
    request.end();
  });
};
