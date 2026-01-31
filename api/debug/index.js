/**
 * Debug API - Read latest AI responses and logs for debugging
 */

const { TABLES, queryByPartition } = require("../shared/tableStorage");

module.exports = async function (context, req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    // Check if requesting logs
    const type = req.query.type || "debug";

    if (type === "logs") {
      const source = req.query.source || "eventcards";
      const logs = await queryByPartition(TABLES.LOGS, source);
      logs.sort((a, b) => b.rowKey.localeCompare(a.rowKey));

      context.res = {
        status: 200,
        headers,
        body: JSON.stringify({
          source,
          count: logs.length,
          logs: logs.slice(0, 100).map(l => ({
            timestamp: l.timestamp,
            level: l.level,
            message: l.message,
            data: l.data ? JSON.parse(l.data) : null
          }))
        }, null, 2)
      };
      return;
    }

    // Get partition from query param, default to "backgrounds"
    const partition = req.query.partition || "backgrounds";

    // Get all debug entries for this partition
    const entries = await queryByPartition(TABLES.DEBUG, partition);

    // Sort by rowKey (timestamp) descending
    entries.sort((a, b) => b.rowKey.localeCompare(a.rowKey));

    // Get the latest entry
    const latest = entries[0];

    if (!latest) {
      context.res = {
        status: 404,
        headers,
        body: JSON.stringify({ error: `No debug entries found for partition: ${partition}` })
      };
      return;
    }

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        partition,
        timestamp: latest.timestamp,
        contentLength: latest.contentLength,
        systemPrompt: latest.systemPrompt || null,
        userPrompt: latest.userPrompt || null,
        content: latest.content,
        // Also return recent entries list
        recentEntries: entries.slice(0, 5).map(e => ({
          rowKey: e.rowKey,
          partition: e.partitionKey,
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
