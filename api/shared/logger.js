/**
 * Simple logger that writes to Azure Table Storage
 */

const { TABLES, upsertEntity } = require("./tableStorage");

// In-memory buffer for batch writing
let logBuffer = [];
let flushTimeout = null;

/**
 * Log a message to the Logs table
 * @param {string} source - e.g., "eventcards", "backgrounds"
 * @param {string} level - "info", "warn", "error"
 * @param {string} message - log message
 * @param {object} data - optional extra data
 */
async function log(source, level, message, data = null) {
  const entry = {
    partitionKey: source,
    rowKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message: message.slice(0, 1000),
    data: data ? JSON.stringify(data).slice(0, 10000) : null,
    timestamp: new Date().toISOString()
  };

  logBuffer.push(entry);

  // Flush after short delay (batch writes)
  if (!flushTimeout) {
    flushTimeout = setTimeout(flushLogs, 500);
  }
}

/**
 * Flush buffered logs to table storage
 */
async function flushLogs() {
  flushTimeout = null;
  if (logBuffer.length === 0) return;

  const toWrite = logBuffer;
  logBuffer = [];

  for (const entry of toWrite) {
    try {
      await upsertEntity(TABLES.LOGS, entry);
    } catch (err) {
      console.error("[Logger] Failed to write log:", err.message);
    }
  }
}

/**
 * Force flush all pending logs (call at end of function)
 */
async function flush() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  await flushLogs();
}

// Convenience methods
const info = (source, message, data) => log(source, "info", message, data);
const warn = (source, message, data) => log(source, "warn", message, data);
const error = (source, message, data) => log(source, "error", message, data);

module.exports = { log, info, warn, error, flush };
