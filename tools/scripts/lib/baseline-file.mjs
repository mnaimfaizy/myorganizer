/**
 * The JSON-envelope shape every shrink-only baseline file shares: an
 * `existsSync` guard, a `JSON.parse` with a wrapped error, a strict
 * `schemaVersion` check, and an `Array.isArray("baseline")` check. Two
 * ratchet checkers — `nx-declared-targets.mjs` (ADR 0082) and
 * `checker-contract-coverage.mjs` (ADR 0085) — read a baseline file with
 * this exact envelope and differ only in what an individual entry looks
 * like (a composite `{ project, target, executor }` key versus a bare
 * checker path) and in what else the file carries alongside `baseline`
 * (`notDebt`, for the Declared Target ratchet). This module is only the
 * envelope; per-entry validation, deduplication, and any sibling arrays
 * stay with the caller, because forcing those into a shared shape would
 * fit neither ratchet well.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads and parses `path`, throwing on a missing file, invalid JSON, a
 * `schemaVersion` mismatch, or a `baseline` field that is not an array.
 * Returns the parsed object on success — the caller reads `baseline` and
 * any other fields itself.
 */
export function readBaselineEnvelope({
  cwd = process.cwd(),
  path,
  schemaVersion,
}) {
  const absolute = join(cwd, path);
  if (!existsSync(absolute)) {
    throw new Error(`${path} not found — the baseline is a required artifact`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
  if (parsed?.schemaVersion !== schemaVersion) {
    throw new Error(
      `${path}: expected "schemaVersion": ${schemaVersion}, found ${JSON.stringify(parsed?.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed?.baseline)) {
    throw new Error(`${path}: expected a "baseline" array`);
  }
  return parsed;
}
