module.exports = async function (context, req) {
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ test: true })
  };
};
