/**
 * Detect when an Ecosystem's Baseline has left the range recorded in its
 * latest committed Upstream Brief report (ADR 0084 item 14).
 *
 * After a dependency mutation, checks each Ecosystem declared in the
 * upstream-brief adapter config. For each one with a committed report:
 *   1. Resolves the current installed Baseline
 *   2. Reads the latest committed report
 *   3. Checks if any checkedAndClear item's holdsFor range no longer covers
 *      the current Baseline
 *   4. If so, the Ecosystem is outside its recorded range and needs a new brief
 *
 * Falls back gracefully: missing config, missing reports, uninstalled
 * ecosystems, or unreadable ranges all result in no suggestion.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Version comparison: negative if a < b, positive if a > b, zero if equal.
 * Both versions must be semver-like (digits.digits.digits...).
 */
export function compareVersions(a, b) {
  const aParts = String(a).replace(/^v/, '').split('.');
  const bParts = String(b).replace(/^v/, '').split('.');
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const aNum = parseInt(aParts[i] ?? '0', 10);
    const bNum = parseInt(bParts[i] ?? '0', 10);
    if (aNum !== bNum) return aNum - bNum;
  }

  return 0;
}

/**
 * Parse a version range string into a predicate function.
 * Accepts: exact version (16.2.6), wildcard (22.x), comparators (>=15.0.0 <17.0.0).
 *
 * @returns {(version: string) => boolean | null} returns null if range is unreadable
 */
export function parseVersionRange(rangeStr) {
  if (typeof rangeStr !== 'string' || !rangeStr.trim()) return null;

  const source = rangeStr.trim();

  // Wildcard: 22.x or 22.*
  const wildcardMatch = source.match(/^v?(\d+(?:\.\d+)*)\.(?:x|\*)$/i);
  if (wildcardMatch) {
    const prefix = wildcardMatch[1].split('.').map(Number);
    return (version) => {
      const parts = String(version).replace(/^v/, '').split('.').map(Number);
      return prefix.every((seg, idx) => parts[idx] === seg);
    };
  }

  // Exact version: 16.2.6
  const versionRegex = /^v?\d+(?:\.\d+)*$/;
  if (versionRegex.test(source)) {
    return (version) =>
      compareVersions(
        String(version).replace(/^v/, ''),
        source.replace(/^v/, ''),
      ) === 0;
  }

  // Comparators: >=15.0.0 <17.0.0
  const comparators = ['>=', '<=', '>', '<', '='];
  const terms = [];

  for (const token of source.split(/\s+/)) {
    const comparator = comparators.find((c) => token.startsWith(c));
    if (!comparator) return null; // Unreadable

    const version = token.slice(comparator.length);
    if (!versionRegex.test(version)) return null; // Unreadable

    terms.push({ comparator, version });
  }

  if (terms.length === 0) return null;

  return (version) => {
    if (!versionRegex.test(String(version).replace(/^v/, ''))) return false;
    const vClean = String(version).replace(/^v/, '');

    return terms.every(({ comparator, version: bound }) => {
      const order = compareVersions(vClean, bound.replace(/^v/, ''));
      switch (comparator) {
        case '>=':
          return order >= 0;
        case '>':
          return order > 0;
        case '<=':
          return order <= 0;
        case '<':
          return order < 0;
        default:
          return order === 0;
      }
    });
  };
}

/**
 * Resolve the installed version of a package from node_modules/package.json
 * (the lead package only — not companions).
 */
export function resolveInstalledVersion(packageName, repoDir = process.cwd()) {
  const packageJsonPath = join(
    repoDir,
    'node_modules',
    packageName,
    'package.json',
  );
  if (!existsSync(packageJsonPath)) return null;

  try {
    const content = readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(content);
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

/**
 * Simple YAML parser for upstream-brief config.
 * Handles: key: value and ecosystems list with lead entries.
 */
function parseSimpleYaml(yaml) {
  const result = {};
  const lines = String(yaml).split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty and comment lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse key: value
    if (trimmed.includes(':') && !trimmed.startsWith('-')) {
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value) {
        result[key] = value;
      } else if (key === 'ecosystems') {
        // Parse ecosystems list
        const ecosystems = [];
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          const nextTrimmed = nextLine.trim();

          if (!nextTrimmed || nextTrimmed.startsWith('#')) {
            i++;
            continue;
          }

          // Check if it's indented (part of ecosystems)
          if (nextLine[0] === ' ' || nextLine[0] === '\t') {
            if (nextTrimmed.startsWith('- lead:')) {
              const leadMatch = nextTrimmed.match(/- lead:\s*(.+)/);
              if (leadMatch) {
                ecosystems.push({ lead: leadMatch[1].trim() });
              }
            } else if (nextTrimmed.startsWith('-')) {
              // Start of new item, but not with lead
              i++;
              continue;
            } else {
              // Not a list item, end of ecosystems
              break;
            }
            i++;
          } else {
            // Not indented, end of ecosystems
            break;
          }
        }
        i--; // Back up one since the outer loop will increment
        result.ecosystems = ecosystems;
      }
    }
  }

  return result;
}

/**
 * Load the upstream-brief.config.yml (or json/yaml) from repo root.
 */
export function loadConfig(repoDir = process.cwd()) {
  const configPaths = [
    'upstream-brief.config.yml',
    'upstream-brief.config.yaml',
    'upstream-brief.config.json',
  ];

  for (const configFile of configPaths) {
    const configPath = join(repoDir, configFile);
    if (!existsSync(configPath)) continue;

    try {
      const content = readFileSync(configPath, 'utf8');

      if (configFile.endsWith('.json')) {
        return JSON.parse(content);
      }

      return parseSimpleYaml(content) ?? {};
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Find the latest committed report file for an ecosystem in the brief directory.
 * Reports are named `*.json` in the brief directory (from ADR 0084).
 * Returns the parsed report object, or null if not found.
 */
export function findLatestReport(ecosystemLead, briefDir) {
  if (!existsSync(briefDir)) return null;

  const files = readdirSync(briefDir);
  // Look for files that might contain the ecosystem report
  // The exact naming convention isn't fully specified, so we search for *.json files
  const reportFiles = files.filter((f) => f.endsWith('.json'));

  if (reportFiles.length === 0) return null;

  // Try to read each report and find one that mentions this ecosystem
  for (const reportFile of reportFiles) {
    try {
      const reportPath = join(briefDir, reportFile);
      const content = readFileSync(reportPath, 'utf8');
      const report = JSON.parse(content);

      // Check if this report contains the ecosystem
      if (Array.isArray(report.ecosystems)) {
        const eco = report.ecosystems.find((e) => e?.lead === ecosystemLead);
        if (eco) {
          return { ...report, reportFile };
        }
      }
    } catch {
      // Skip unparseable files
    }
  }

  return null;
}

/**
 * Check if an ecosystem's current baseline is outside the range recorded
 * in its latest report. Returns the ecosystem lead name if it needs a new brief.
 *
 * @returns {string|null} the ecosystem lead name, or null if no suggestion
 */
export function checkEcosystemBaseline(
  ecosystemLead,
  briefDir,
  repoDir = process.cwd(),
) {
  const currentBaseline = resolveInstalledVersion(ecosystemLead, repoDir);

  // No current baseline = ecosystem not installed, no suggestion
  if (!currentBaseline) return null;

  const report = findLatestReport(ecosystemLead, briefDir);

  // No report = first run, no suggestion
  if (!report) return null;

  const ecosystem = report.ecosystems.find((e) => e?.lead === ecosystemLead);
  if (!ecosystem) return null;

  const reportedBaseline = ecosystem.baseline;

  // If baselines match exactly, check ranges in checkedAndClear
  if (reportedBaseline === currentBaseline) {
    return null;
  }

  // Baselines differ; check if current baseline is covered by any checkedAndClear range
  const checkedAndClear = Array.isArray(ecosystem.checkedAndClear)
    ? ecosystem.checkedAndClear
    : [];

  // If there are no checked items, any baseline change is significant
  if (checkedAndClear.length === 0) {
    return ecosystemLead;
  }

  // Check if any range covers the current baseline
  for (const item of checkedAndClear) {
    const holdsFor = item?.holdsFor;
    if (!holdsFor) continue;

    const rangeFn = parseVersionRange(holdsFor);
    if (rangeFn && rangeFn(currentBaseline)) {
      // Current baseline is covered by at least one range, no suggestion needed
      // (unless there are other changes, but the ledger logic will handle that)
      return null;
    }
  }

  // No range covers the current baseline
  return ecosystemLead;
}

/**
 * Main entry point: check all configured ecosystems and return those needing a new brief.
 *
 * @returns {string[]} array of ecosystem lead names that need a new brief
 */
export function getUpstreamBriefSuggestions(repoDir = process.cwd()) {
  const config = loadConfig(repoDir);
  if (!config) return [];

  const briefDir = config.brief_dir || 'docs/research';
  const briefDirPath = join(repoDir, briefDir);

  const ecosystems = Array.isArray(config.ecosystems) ? config.ecosystems : [];
  const suggestions = [];

  for (const ecoConfig of ecosystems) {
    const lead = ecoConfig?.lead;
    if (!lead) continue;

    const result = checkEcosystemBaseline(lead, briefDirPath, repoDir);
    if (result) {
      suggestions.push(result);
    }
  }

  return suggestions;
}
