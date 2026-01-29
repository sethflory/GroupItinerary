const { BlobServiceClient } = require("@azure/storage-blob");

function validateRequest(req) {
  const tripId = req.body?.tripId || req.query?.tripId;
  const accessCode = req.body?.accessCode || req.query?.accessCode;

  if (!tripId) return { valid: false, error: "Missing tripId" };
  if (!accessCode) return { valid: false, error: "Missing accessCode" };

  const codesJson = process.env.TRIP_ACCESS_CODES || "{}";
  let codes;
  try {
    codes = JSON.parse(codesJson);
  } catch (e) {
    return { valid: false, error: "Server configuration error" };
  }

  const expectedCode = codes[tripId];
  if (!expectedCode) return { valid: false, error: "Trip not found" };
  if (accessCode.toLowerCase() !== expectedCode.toLowerCase()) {
    return { valid: false, error: "Invalid access code" };
  }

  return { valid: true, tripId };
}

module.exports = async function (context, req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers };
    return;
  }

  const auth = validateRequest(req);
  if (!auth.valid) {
    const status = auth.error === "Trip not found" ? 404 :
                   auth.error === "Invalid access code" ? 403 : 401;
    context.res = { status, headers, body: { error: auth.error } };
    return;
  }

  try {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const blobService = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobService.getContainerClient("trip-photos");
    await containerClient.createIfNotExists();

    const prefix = req.query.prefix || req.body?.prefix || "";

    if (req.method === "GET") {
      const photos = [];
      for await (const blob of containerClient.listBlobsFlat(prefix ? { prefix } : {})) {
        photos.push({
          name: blob.name,
          url: containerClient.getBlobClient(blob.name).url
        });
      }
      context.res = { status: 200, headers, body: { photos, count: photos.length } };

    } else if (req.method === "POST") {
      const { fileName, fileData, caption, uploadedBy } = req.body || {};
      if (!fileName || !fileData) {
        context.res = { status: 400, headers, body: { error: "Missing fileName or fileData" } };
        return;
      }

      const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches) {
        context.res = { status: 400, headers, body: { error: "Invalid base64 data" } };
        return;
      }

      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const blobName = `${prefix}${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: contentType },
        metadata: { caption: caption || "", uploadedBy: uploadedBy || "anonymous", tripId: auth.tripId }
      });

      context.res = { status: 201, headers, body: { success: true, url: blockBlobClient.url } };

    } else if (req.method === "DELETE") {
      const blobName = req.query.name || req.body?.name;
      if (!blobName) {
        context.res = { status: 400, headers, body: { error: "Missing blob name" } };
        return;
      }

      const blobClient = containerClient.getBlobClient(blobName);
      await blobClient.deleteIfExists();
      context.res = { status: 200, headers, body: { success: true, deleted: blobName } };

    } else {
      context.res = { status: 405, headers, body: { error: "Method not allowed" } };
    }

  } catch (err) {
    context.res = { status: 500, headers, body: { error: err.message } };
  }
};
