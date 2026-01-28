module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      test: true,
      method: req.method,
      hasApiKey: !!process.env.ANTHROPIC_API_KEY
    })
  };
};
