/**
 * Debug API - Read latest AI responses for debugging
 */

const { TABLES, queryByPartition } = require("../shared/tableStorage");

module.exports = async function (context, req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    // Get all debug entries, sorted by timestamp (newest first)
    const entries = await queryByPartition(TABLES.DEBUG, "narrative");

    // Sort by rowKey (timestamp) descending
    entries.sort((a, b) => b.rowKey.localeCompare(a.rowKey));

    // Get the latest entry
    const latest = entries[0];

    if (!latest) {
      context.res = {
        status: 404,
        headers,
        body: JSON.stringify({ error: "No debug entries found" })
      };
      return;
    }

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        timestamp: latest.timestamp,
        contentLength: latest.contentLength,
        content: latest.content,
        // Also return recent entries list
        recentEntries: entries.slice(0, 5).map(e => ({
          rowKey: e.rowKey,
          timestamp: e.timestamp,
          contentLength: e.contentLength
        }))
      }, null, 2)
    };

  } catch (err) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
