const { TableClient, TableServiceClient } = require("@azure/data-tables");

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

// Table names as constants
const TABLES = {
  // Core identity tables
  USERS: "Users",
  TRIP_MEMBERS: "TripMembers",
  SHARE_LINKS: "ShareLinks",

  // Trip content tables
  TRIPS: "Trips",
  TRAVELERS: "Travelers",  // Legacy - migrate to TripMembers
  DAYS: "Days",
  EVENTS: "Events",
  DESTINATIONS: "Destinations",
  HOTELS: "Hotels",
  LOCATION_MARKERS: "LocationMarkers",
  PHOTOS: "Photos",

  // Feature tables
  TRIVIA_QUESTIONS: "TriviaQuestions",
  TRIVIA_ROUNDS: "TriviaRounds",
  TRIVIA_LEADERBOARD: "TriviaLeaderboard",
  TRIVIA_POKES: "TriviaPokes",
  TRAVELER_LOCATIONS: "TravelerLocations",
  NEWS_CACHE: "NewsCache",
  DINNER_POLLS: "DinnerPolls",
  SAW_IT_GAMES: "SawItGames",
  SAW_IT_LISTS: "SawItLists",
  SCAVENGER_HUNTS: "ScavengerHunts",
  SCAVENGER_HUNT_ITEMS: "ScavengerHuntItems",
  NOTIFICATIONS: "Notifications",

  // System tables
  RATE_LIMITS: "RateLimits",
  DEBUG: "Debug",
  LOGS: "Logs",
  IMAGE_CACHE: "ImageCache"
};

// Create a TableClient for a specific table
function getTableClient(tableName) {
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING not configured");
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

// Create table if it doesn't exist
async function ensureTable(tableName) {
  const client = getTableClient(tableName);
  try {
    await client.createTable();
  } catch (err) {
    // Ignore if table already exists (409 Conflict)
    if (err.statusCode !== 409) {
      throw err;
    }
  }
  return client;
}

// Get single entity
async function getEntity(tableName, partitionKey, rowKey) {
  const client = getTableClient(tableName);
  try {
    return await client.getEntity(partitionKey, rowKey);
  } catch (err) {
    if (err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

// Query entities with filter
async function queryEntities(tableName, filter, options = {}) {
  const client = getTableClient(tableName);
  const entities = [];
  const queryOptions = { ...options };
  if (filter) {
    queryOptions.filter = filter;
  }

  for await (const entity of client.listEntities(queryOptions)) {
    entities.push(entity);
  }
  return entities;
}

// Query by partition key only
async function queryByPartition(tableName, partitionKey, options = {}) {
  return queryEntities(tableName, `PartitionKey eq '${partitionKey}'`, options);
}

// Upsert entity (create or update)
async function upsertEntity(tableName, entity) {
  const client = getTableClient(tableName);
  await client.upsertEntity(entity, "Replace");
  return entity;
}

// Delete entity
async function deleteEntity(tableName, partitionKey, rowKey) {
  const client = getTableClient(tableName);
  try {
    await client.deleteEntity(partitionKey, rowKey);
    return true;
  } catch (err) {
    if (err.statusCode === 404) {
      return false;
    }
    throw err;
  }
}

// Batch operations for bulk inserts
async function batchUpsert(tableName, entities) {
  const client = getTableClient(tableName);
  const results = [];

  // Azure Table Storage batches must be <= 100 entities and same partition key
  // Group by partition key first
  const byPartition = {};
  for (const entity of entities) {
    const pk = entity.partitionKey;
    if (!byPartition[pk]) {
      byPartition[pk] = [];
    }
    byPartition[pk].push(entity);
  }

  // Process each partition's entities in batches of 100
  for (const [partitionKey, partitionEntities] of Object.entries(byPartition)) {
    for (let i = 0; i < partitionEntities.length; i += 100) {
      const batch = partitionEntities.slice(i, i + 100);
      const transaction = batch.map(entity => ["upsert", entity, "Replace"]);

      try {
        const response = await client.submitTransaction(transaction);
        results.push(...response.subResponses);
      } catch (err) {
        // If batch fails, try individual upserts
        for (const entity of batch) {
          try {
            await client.upsertEntity(entity, "Replace");
            results.push({ status: 204 });
          } catch (innerErr) {
            results.push({ status: innerErr.statusCode || 500, error: innerErr.message });
          }
        }
      }
    }
  }

  return results;
}

// Helper to generate sortable timestamp-based row keys
function generateRowKey(prefix = "") {
  const timestamp = Date.now().toString().padStart(15, "0");
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

// Parse ISO date to date-only string (YYYY-MM-DD)
function toDateKey(isoDate) {
  return isoDate.split("T")[0];
}

module.exports = {
  TABLES,
  getTableClient,
  ensureTable,
  getEntity,
  queryEntities,
  queryByPartition,
  upsertEntity,
  deleteEntity,
  batchUpsert,
  generateRowKey,
  toDateKey
};
