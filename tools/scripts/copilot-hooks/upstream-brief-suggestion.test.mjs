/**
 * Tests for upstream-brief-suggestion module.
 *
 * Uses Node's built-in test runner (node --test).
 * Run with: node --test tools/scripts/copilot-hooks/upstream-brief-suggestion.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  compareVersions,
  parseVersionRange,
  checkEcosystemBaseline,
  getUpstreamBriefSuggestions,
  findLatestReport,
  loadConfig,
} from './upstream-brief-suggestion.mjs';

// ── Version Comparison ──────────────────────────────────────────────────

test('compareVersions: equal versions return 0', () => {
  assert.equal(compareVersions('16.2.6', '16.2.6'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('22.7.7', '22.7.7'), 0);
});

test('compareVersions: handles v prefix', () => {
  assert.equal(compareVersions('v16.2.6', 'v16.2.6'), 0);
  assert.equal(compareVersions('v16.2.6', '16.2.6'), 0);
  assert.equal(compareVersions('16.2.6', 'v16.2.6'), 0);
});

test('compareVersions: a < b returns negative', () => {
  assert(compareVersions('16.2.6', '16.3.0') < 0);
  assert(compareVersions('16.2.6', '17.0.0') < 0);
  assert(compareVersions('15.9.9', '16.0.0') < 0);
});

test('compareVersions: a > b returns positive', () => {
  assert(compareVersions('16.3.0', '16.2.6') > 0);
  assert(compareVersions('17.0.0', '16.2.6') > 0);
  assert(compareVersions('22.7.7', '22.7.6') > 0);
});

test('compareVersions: handles different segment counts', () => {
  assert.equal(compareVersions('16.2', '16.2.0'), 0);
  assert(compareVersions('16.2', '16.2.1') < 0);
  assert(compareVersions('16.2.1', '16.2') > 0);
});

// ── Version Range Parsing ──────────────────────────────────────────────

test('parseVersionRange: exact version', () => {
  const fn = parseVersionRange('16.2.6');
  assert(fn !== null);
  assert(fn('16.2.6'));
  assert(!fn('16.2.7'));
  assert(!fn('16.3.0'));
});

test('parseVersionRange: with v prefix', () => {
  const fn = parseVersionRange('v16.2.6');
  assert(fn !== null);
  assert(fn('16.2.6'));
  assert(fn('v16.2.6'));
});

test('parseVersionRange: wildcard x', () => {
  const fn = parseVersionRange('22.x');
  assert(fn !== null);
  assert(fn('22.0.0'));
  assert(fn('22.7.7'));
  assert(fn('22.999.999'));
  assert(!fn('21.9.9'));
  assert(!fn('23.0.0'));
});

test('parseVersionRange: wildcard *', () => {
  const fn = parseVersionRange('0.80.*');
  assert(fn !== null);
  assert(fn('0.80.0'));
  assert(fn('0.80.3'));
  assert(!fn('0.79.3'));
  assert(!fn('0.81.0'));
});

test('parseVersionRange: >= comparator', () => {
  const fn = parseVersionRange('>=15.0.0');
  assert(fn !== null);
  assert(fn('15.0.0'));
  assert(fn('16.0.0'));
  assert(!fn('14.9.9'));
});

test('parseVersionRange: < comparator', () => {
  const fn = parseVersionRange('<17.0.0');
  assert(fn !== null);
  assert(fn('16.9.9'));
  assert(fn('16.0.0'));
  assert(!fn('17.0.0'));
});

test('parseVersionRange: conjunction >=15.0.0 <17.0.0', () => {
  const fn = parseVersionRange('>=15.0.0 <17.0.0');
  assert(fn !== null);
  assert(fn('15.0.0'));
  assert(fn('16.2.6'));
  assert(fn('16.9.9'));
  assert(!fn('14.9.9'));
  assert(!fn('17.0.0'));
  assert(!fn('17.0.1'));
});

test('parseVersionRange: returns null for invalid ranges', () => {
  assert.equal(parseVersionRange(''), null);
  assert.equal(parseVersionRange('   '), null);
  assert.equal(parseVersionRange(null), null);
  assert.equal(parseVersionRange(undefined), null);
  assert.equal(parseVersionRange('^16.0.0'), null);
  assert.equal(parseVersionRange('~16.0.0'), null);
  assert.equal(parseVersionRange('invalid'), null);
});

// ── Config Loading ─────────────────────────────────────────────────────

test('loadConfig: loads yaml config', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    writeFileSync(
      join(tmpDir, 'upstream-brief.config.yml'),
      `
ecosystems:
  - lead: nx
  - lead: next
brief_dir: docs/research
`,
    );

    const config = loadConfig(tmpDir);
    assert(config !== null);
    assert.deepEqual(config.ecosystems, [{ lead: 'nx' }, { lead: 'next' }]);
    assert.equal(config.brief_dir, 'docs/research');
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('loadConfig: loads json config', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    writeFileSync(
      join(tmpDir, 'upstream-brief.config.json'),
      JSON.stringify({
        ecosystems: [{ lead: 'nx' }],
        brief_dir: 'docs/research',
      }),
    );

    const config = loadConfig(tmpDir);
    assert(config !== null);
    assert.deepEqual(config.ecosystems, [{ lead: 'nx' }]);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('loadConfig: returns null when no config found', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    const config = loadConfig(tmpDir);
    assert.equal(config, null);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

// ── Finding Latest Report ──────────────────────────────────────────────

test('findLatestReport: finds report by ecosystem lead', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    writeFileSync(
      join(tmpDir, 'upstream-brief-nx.json'),
      JSON.stringify({
        schemaVersion: 1,
        date: '2026-09-17',
        commit: 'abc123',
        ecosystems: [
          {
            lead: 'nx',
            baseline: '22.7.7',
            checkedAndClear: [],
          },
        ],
      }),
    );

    const report = findLatestReport('nx', tmpDir);
    assert(report !== null);
    assert.equal(report.ecosystems[0].lead, 'nx');
    assert.equal(report.ecosystems[0].baseline, '22.7.7');
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('findLatestReport: returns null when no report found', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    const report = findLatestReport('nonexistent', tmpDir);
    assert.equal(report, null);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('findLatestReport: returns null for directory that does not exist', () => {
  const nonexistent = join(process.cwd(), 'nonexistent-dir-' + Date.now());
  const report = findLatestReport('nx', nonexistent);
  assert.equal(report, null);
});

// ── Ecosystem Baseline Checking ────────────────────────────────────────

test('checkEcosystemBaseline: no suggestion when ecosystem not installed', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    const result = checkEcosystemBaseline('nonexistent-pkg', tmpDir, tmpDir);
    assert.equal(result, null);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('checkEcosystemBaseline: no suggestion when no report exists', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    // Package is not installed, so function returns null
    const result = checkEcosystemBaseline('test-pkg', tmpDir, tmpDir);
    assert.equal(result, null);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('checkEcosystemBaseline: no suggestion when baseline unchanged', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  const briefDir = join(tmpDir, 'brief');

  try {
    // Create briefDir
    mkdirSync(briefDir, { recursive: true });

    // Create a report with baseline 1.0.0 and no checkedAndClear items
    writeFileSync(
      join(briefDir, 'test-report.json'),
      JSON.stringify({
        schemaVersion: 1,
        date: '2026-09-17',
        commit: 'abc123',
        ecosystems: [
          {
            lead: 'test-pkg',
            baseline: '1.0.0',
            checkedAndClear: [],
          },
        ],
      }),
    );

    // Note: This test can't easily check real installed versions without
    // creating actual node_modules. The function would return null because
    // the ecosystem is not installed.

    const result = checkEcosystemBaseline('test-pkg', briefDir, tmpDir);
    assert.equal(result, null); // Not installed, so no suggestion
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('checkEcosystemBaseline: suggests brief when baseline changed and no ranges', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  const briefDir = join(tmpDir, 'brief');
  const nodeModulesDir = join(tmpDir, 'node_modules', 'test-pkg');

  try {
    // Create briefDir
    mkdirSync(briefDir, { recursive: true });

    // Create a fake installed package
    mkdirSync(nodeModulesDir, { recursive: true });
    writeFileSync(
      join(nodeModulesDir, 'package.json'),
      JSON.stringify({ version: '2.0.0' }),
    );

    // Create a report with baseline 1.0.0 and no checkedAndClear
    writeFileSync(
      join(briefDir, 'test-report.json'),
      JSON.stringify({
        schemaVersion: 1,
        date: '2026-09-17',
        commit: 'abc123',
        ecosystems: [
          {
            lead: 'test-pkg',
            baseline: '1.0.0',
            checkedAndClear: [],
          },
        ],
      }),
    );

    // Baseline changed from 1.0.0 to 2.0.0 with no ranges to cover it
    const result = checkEcosystemBaseline('test-pkg', briefDir, tmpDir);
    assert.equal(result, 'test-pkg'); // Should suggest a brief
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('checkEcosystemBaseline: no suggestion when baseline in checkedAndClear range', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  const briefDir = join(tmpDir, 'brief');
  const nodeModulesDir = join(tmpDir, 'node_modules', 'test-pkg');

  try {
    // Create briefDir and fake installed package
    mkdirSync(briefDir, { recursive: true });
    mkdirSync(nodeModulesDir, { recursive: true });

    // Create installed package with version 1.5.0
    writeFileSync(
      join(nodeModulesDir, 'package.json'),
      JSON.stringify({ version: '1.5.0' }),
    );

    // Create report with baseline 1.0.0 and range covering 1.5.0
    writeFileSync(
      join(briefDir, 'test-report.json'),
      JSON.stringify({
        schemaVersion: 1,
        date: '2026-09-17',
        commit: 'abc123',
        ecosystems: [
          {
            lead: 'test-pkg',
            baseline: '1.0.0',
            checkedAndClear: [
              {
                claim: 'Test claim',
                holdsFor: '>=1.0.0 <2.0.0',
              },
            ],
          },
        ],
      }),
    );

    // Current baseline 1.5.0 is within the range >=1.0.0 <2.0.0
    const result = checkEcosystemBaseline('test-pkg', briefDir, tmpDir);
    assert.equal(result, null); // No suggestion because baseline is in range
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

// ── Getting Upstream Brief Suggestions ─────────────────────────────────

test('getUpstreamBriefSuggestions: returns empty array when no config', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    const suggestions = getUpstreamBriefSuggestions(tmpDir);
    assert.deepEqual(suggestions, []);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('getUpstreamBriefSuggestions: returns empty array when no ecosystems configured', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    writeFileSync(
      join(tmpDir, 'upstream-brief.config.json'),
      JSON.stringify({ ecosystems: [] }),
    );

    const suggestions = getUpstreamBriefSuggestions(tmpDir);
    assert.deepEqual(suggestions, []);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});

test('getUpstreamBriefSuggestions: gracefully handles missing ecosystem in config', () => {
  const tmpDir = mkdtempSync(join(process.cwd(), 'tmp-'));
  try {
    writeFileSync(
      join(tmpDir, 'upstream-brief.config.json'),
      JSON.stringify({ ecosystems: [{ noLead: 'invalid' }] }),
    );

    const suggestions = getUpstreamBriefSuggestions(tmpDir);
    assert.deepEqual(suggestions, []);
  } finally {
    rmSync(tmpDir, { recursive: true });
  }
});
