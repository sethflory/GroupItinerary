// Layer 3: Test reading environment variable
module.exports = function (context, req) {
  const tripCodes = process.env.TRIP_ACCESS_CODES || "NOT_SET";
  context.res = {
    headers: { "Content-Type": "application/json" },
    body: {
      message: "hello",
      envTest: tripCodes !== "NOT_SET" ? "TRIP_ACCESS_CODES is set" : "TRIP_ACCESS_CODES not found"
    }
  };
  context.done();
};
