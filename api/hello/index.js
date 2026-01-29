// Simplest possible Azure Function - no dependencies, no env vars
module.exports = function (context, req) {
  context.res = {
    body: "hello"
  };
  context.done();
};
