const { BlobServiceClient } = require('@azure/storage-blob');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.PHOTOS_CONTAINER_NAME || 'trip-photos';

module.exports = async function (context, req) {
  context.log('Photos API called:', req.method, req.url);

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers };
    return;
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Ensure container exists
    await containerClient.createIfNotExists({ access: 'blob' });

    // Get trip prefix from query params (for multi-trip support)
    const prefix = req.query.prefix || '';
    const tripId = req.query.tripId || 'default';

    if (req.method === 'GET') {
      // List photos, optionally filtered by prefix
      const photos = [];

      // Use prefix to filter blobs if provided
      const listOptions = prefix ? { prefix } : {};

      for await (const blob of containerClient.listBlobsFlat(listOptions)) {
        const blobClient = containerClient.getBlobClient(blob.name);
        const properties = await blobClient.getProperties();

        photos.push({
          name: blob.name,
          url: blobClient.url,
          uploadedAt: properties.createdOn || properties.lastModified,
          size: properties.contentLength,
          contentType: properties.contentType,
          metadata: properties.metadata || {},
          tripId: properties.metadata?.tripId || 'default'
        });
      }

      // Sort by upload date, newest first
      photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      context.res = {
        status: 200,
        headers,
        body: { photos, count: photos.length, tripId, prefix }
      };

    } else if (req.method === 'POST') {
      // Upload a photo
      const body = req.body;

      if (!body || !body.fileName || !body.fileData) {
        context.res = {
          status: 400,
          headers,
          body: { error: 'Missing fileName or fileData in request body' }
        };
        return;
      }

      const { fileName, fileData, caption, uploadedBy } = body;
      // Get prefix from body (for uploads) or use empty string
      const uploadPrefix = body.prefix || '';
      const uploadTripId = body.tripId || 'default';

      // Decode base64 image data
      const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        context.res = {
          status: 400,
          headers,
          body: { error: 'Invalid base64 image data' }
        };
        return;
      }

      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      // Generate unique filename with prefix
      const timestamp = Date.now();
      const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const blobName = `${uploadPrefix}${timestamp}-${safeName}`;

      // Upload to blob storage
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: { blobContentType: contentType },
        metadata: {
          caption: caption || '',
          uploadedBy: uploadedBy || 'anonymous',
          originalName: fileName,
          tripId: uploadTripId
        }
      });

      context.res = {
        status: 201,
        headers,
        body: {
          success: true,
          photo: {
            name: blobName,
            url: blockBlobClient.url,
            caption,
            uploadedBy,
            tripId: uploadTripId
          }
        }
      };

    } else {
      context.res = {
        status: 405,
        headers,
        body: { error: 'Method not allowed' }
      };
    }

  } catch (error) {
    context.log.error('Error in photos API:', error);
    context.res = {
      status: 500,
      headers,
      body: { error: 'Internal server error', details: error.message }
    };
  }
};
