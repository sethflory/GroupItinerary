module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { message: "Test function works!", timestamp: new Date().toISOString() }
  };
};
