// Layer 4: Test Azure Storage connection
const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
  const results = {
    message: "hello",
    envTest: process.env.TRIP_ACCESS_CODES ? "TRIP_ACCESS_CODES set" : "NOT_SET",
    storageTest: "not tested"
  };

  try {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connStr) {
      results.storageTest = "AZURE_STORAGE_CONNECTION_STRING not set";
    } else {
      const blobService = BlobServiceClient.fromConnectionString(connStr);
      const containerClient = blobService.getContainerClient("trip-photos");
      await containerClient.createIfNotExists({ access: "blob" });
      results.storageTest = "Connected - container ready";
    }
  } catch (err) {
    results.storageTest = "Error: " + err.message;
  }

  context.res = {
    headers: { "Content-Type": "application/json" },
    body: results
  };
};
