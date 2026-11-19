'use strict';

/**
 * Returns row[key] if defined, otherwise row[key.toLowerCase()].
 * Safe for PostgreSQL (which folds unquoted identifiers to lowercase)
 * and SQLite (which preserves casing).
 */
function pick(row, key, fallback = undefined) {
  if (!row) return fallback;
  if (row[key] !== undefined) return row[key];
  const lower = key.toLowerCase();
  if (row[lower] !== undefined) return row[lower];
  return fallback;
}

module.exports = { pick };
