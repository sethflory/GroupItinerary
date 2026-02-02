const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require("@azure/storage-blob");
const { validateTravelerAccess } = require("../shared/validation");

// Parse connection string to get account name and key for SAS generation
function parseConnectionString(connStr) {
  const parts = {};
  connStr.split(";").forEach(part => {
    const [key, ...valueParts] = part.split("=");
    if (key && valueParts.length) {
      parts[key] = valueParts.join("=");
    }
  });
  return {
    accountName: parts.AccountName,
    accountKey: parts.AccountKey
  };
}

// Generate a SAS URL for a blob (valid for 24 hours)
function generateSasUrl(containerClient, blobName, accountName, accountKey) {
  const blobClient = containerClient.getBlobClient(blobName);
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

  const sasToken = generateBlobSASQueryParameters({
    containerName: containerClient.containerName,
    blobName: blobName,
    permissions: BlobSASPermissions.parse("r"), // Read only
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }, sharedKeyCredential).toString();

  return `${blobClient.url}?${sasToken}`;
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

  // Validate access (supports both trip-level and traveler-specific codes)
  const auth = await validateTravelerAccess(req);
  if (!auth.valid) {
    context.res = { status: auth.status || 403, headers, body: { error: auth.error } };
    return;
  }

  try {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const { accountName, accountKey } = parseConnectionString(connStr);
    const blobService = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobService.getContainerClient("trip-photos");
    await containerClient.createIfNotExists();

    const prefix = req.query.prefix || req.body?.prefix || "";

    if (req.method === "GET") {
      const photos = [];
      const listOptions = { includeMetadata: true };
      if (prefix) listOptions.prefix = prefix;

      for await (const blob of containerClient.listBlobsFlat(listOptions)) {
        photos.push({
          name: blob.name,
          url: generateSasUrl(containerClient, blob.name, accountName, accountKey),
          metadata: blob.metadata || {},
          uploadedAt: blob.properties?.createdOn || blob.properties?.lastModified || new Date().toISOString()
        });
      }

      // Sort by upload date, newest first
      photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

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

      // Return SAS URL for immediate display
      const sasUrl = generateSasUrl(containerClient, blobName, accountName, accountKey);
      context.res = { status: 201, headers, body: { success: true, url: sasUrl } };

    } else if (req.method === "DELETE") {
      const blobName = req.query.name || req.body?.name;
      const deleteAll = req.query.deleteAll === 'true' || req.body?.deleteAll === true;
      
      if (deleteAll) {
        // Delete all photos for this trip
        const blobsToDelete = [];
        const listOptions = { includeMetadata: true };
        if (prefix) listOptions.prefix = prefix;
        
        // First, collect all blob names
        for await (const blob of containerClient.listBlobsFlat(listOptions)) {
          blobsToDelete.push(blob.name);
        }
        
        // Delete all blobs in parallel for better performance
        await Promise.all(
          blobsToDelete.map(blobName => 
            containerClient.getBlobClient(blobName).deleteIfExists()
          )
        );
        
        context.res = { 
          status: 200, 
          headers, 
          body: { success: true, deletedCount: blobsToDelete.length, deleted: blobsToDelete } 
        };
      } else {
        // Delete a single photo
        if (!blobName) {
          context.res = { status: 400, headers, body: { error: "Missing blob name" } };
          return;
        }

        const blobClient = containerClient.getBlobClient(blobName);
        await blobClient.deleteIfExists();
        context.res = { status: 200, headers, body: { success: true, deleted: blobName } };
      }

    } else {
      context.res = { status: 405, headers, body: { error: "Method not allowed" } };
    }

  } catch (err) {
    context.res = { status: 500, headers, body: { error: err.message } };
  }
};
