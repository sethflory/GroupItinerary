// Simplest possible Azure Function - no dependencies, no env vars
module.exports = async function (context, req) {
  return {
    status: 200,
    body: "hello"
  };
};
