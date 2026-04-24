const { CronExpressionParser } = require('cron-parser');

/**
 * node-cron uses 5 fields: minute hour day-of-month month day-of-week.
 * cron-parser v5 expects 6 fields: second minute hour day-of-month month day-of-week.
 */
function nodeCronToParserExpression(fiveField) {
  const parts = String(fiveField || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 5) {
    return `0 ${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} ${parts[4]}`;
  }
  return fiveField;
}

/**
 * @param {string} nodeCronExpression e.g. "0 8 * * 1"
 * @param {string} timeZone IANA, e.g. America/New_York
 * @returns {string | null} ISO 8601 UTC, or null if disabled / parse error
 */
function getNextRunIsoUtc(nodeCronExpression, timeZone) {
  try {
    const expr = nodeCronToParserExpression(nodeCronExpression);
    const iterator = CronExpressionParser.parse(expr, {
      tz: timeZone,
      currentDate: new Date()
    });
    const next = iterator.next();
    const d = next.toDate ? next.toDate() : next;
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch (_) {
    return null;
  }
}

module.exports = { getNextRunIsoUtc, nodeCronToParserExpression };
