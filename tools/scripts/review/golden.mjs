/**
 * The golden set (ADR 0071, Consequences): incidents the repo already paid
 * for, written as the findings a reviewer should have raised, so a change to
 * the skill, the schema, the validator, the renderer, or the workflow can be
 * replayed against them before it reaches a Pull Request.
 *
 * A case names a real commit range from this repository's history and the
 * findings expected in a report about that range. An expected finding is
 * the same tuple a finding id is hashed from — axis, source, rule, file —
 * but source and rule are patterns and file is a set: the reviewer phrases
 * a rule in the source's words, and the same defect is fairly located at
 * more than one of the files involved. Recall is matched over expected. A
 * finding that matches an expected tuple also reports whether its id would
 * have matched exactly, so the strict ADR reading stays visible.
 *
 * Everything here is pure; `score-golden-case.mjs` reads files and exits.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CASE_TIERS, GOLDEN_SET_PATH } from './golden-tiers.mjs';
import { FINDING_AXES, FINDING_SEVERITIES, findingId } from './schema.mjs';

// The tier vocabulary and the set's location are declared once, in the
// dependency-free module the no-install replay job runs. This file may import
// that one; the reverse is not true, because this file reaches `zod` through
// schema.mjs and the replay's `cases` job installs nothing. A tier added to
// only one of two hand-typed lists would let the filter accept a case the
// validator rejects — the same disagreement the single filter removed.
export const REVIEW_GOLDEN_SET_PATH = join(...GOLDEN_SET_PATH.split('/'));
export const GOLDEN_SET_SCHEMA_VERSION = 3;

/**
 * A case's tier decides how often it is replayed (ADR 0072).
 *
 * `frontier` is a case the reviewer misses. It is the reason to run the
 * replay at all, so it runs whenever anything that produces a review
 * changes. `guard` is a case the reviewer catches reliably; it carries no
 * new information per run and exists only to catch a brief or contract
 * edit silently undoing something that works, so it runs on the narrower
 * set of paths that could do that.
 *
 * Promotion to `guard` takes three consecutive catches, recorded in the
 * case's `tierEvidence`. Demotion to `frontier` takes one miss. The
 * asymmetry is deliberate: a wrongly promoted case is a detector that
 * quietly stopped running.
 */
export const GOLDEN_CASE_TIERS = CASE_TIERS;

const SHA = /^[0-9a-f]{40}$/;
const ID = /^[a-z0-9][a-z0-9-]*$/;

export class GoldenSetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GoldenSetError';
  }
}

export const loadGoldenSet = (path = REVIEW_GOLDEN_SET_PATH) =>
  assertGoldenSet(JSON.parse(readFileSync(path, 'utf8')), path);

const compile = (pattern, where) => {
  try {
    return new RegExp(pattern, 'i');
  } catch (err) {
    throw new GoldenSetError(
      `${where}: bad pattern ${pattern}: ${err.message}`,
    );
  }
};

export function assertGoldenSet(set, source = 'golden set') {
  const fail = (msg) => {
    throw new GoldenSetError(`${source}: ${msg}`);
  };
  if (set?.schemaVersion !== GOLDEN_SET_SCHEMA_VERSION)
    fail(`unsupported schemaVersion ${set?.schemaVersion}`);
  if (!Array.isArray(set.cases) || set.cases.length === 0)
    fail('cases must be a non-empty array');
  const ids = new Set();
  for (const c of set.cases) {
    const where = `case ${c.id ?? '(no id)'}`;
    if (typeof c.id !== 'string' || !ID.test(c.id))
      fail(`${where}: id must be a lowercase slug`);
    if (ids.has(c.id)) fail(`duplicate case id ${c.id}`);
    ids.add(c.id);
    if (typeof c.title !== 'string' || !c.title) fail(`${where}: no title`);
    if (typeof c.incident !== 'string' || !c.incident)
      fail(`${where}: incident must cite the ADR or issue it comes from`);
    if (!GOLDEN_CASE_TIERS.includes(c.tier))
      fail(`${where}: tier must be one of ${GOLDEN_CASE_TIERS.join(', ')}`);
    // A guard runs on a narrower trigger than a frontier case, so the claim
    // that the reviewer catches it reliably has to be auditable from here.
    if (
      c.tier === 'guard' &&
      (typeof c.tierEvidence !== 'string' || !c.tierEvidence)
    )
      fail(`${where}: a guard must cite the runs that promoted it`);
    if (!SHA.test(c.base) || !SHA.test(c.head))
      fail(`${where}: base and head must be full 40-hex SHAs`);
    if (c.base === c.head) fail(`${where}: base equals head`);
    if (!Array.isArray(c.expected) || c.expected.length === 0)
      fail(`${where}: expected must be a non-empty array`);
    const expectedIds = new Set();
    for (const e of c.expected) {
      const w = `${where}, expected ${e.id ?? '(no id)'}`;
      if (typeof e.id !== 'string' || !ID.test(e.id))
        fail(`${w}: id must be a lowercase slug`);
      if (expectedIds.has(e.id)) fail(`${w}: duplicate expected id`);
      expectedIds.add(e.id);
      if (!FINDING_AXES.includes(e.axis)) fail(`${w}: axis ${e.axis}`);
      if (typeof e.source !== 'string') fail(`${w}: source pattern missing`);
      compile(e.source, w);
      if (typeof e.rule !== 'string') fail(`${w}: rule pattern missing`);
      compile(e.rule, w);
      if (!Array.isArray(e.files) || e.files.length === 0)
        fail(`${w}: files must name at least one path`);
      if (e.minSeverity && !FINDING_SEVERITIES.includes(e.minSeverity))
        fail(`${w}: minSeverity ${e.minSeverity}`);
      if (typeof e.why !== 'string' || !e.why)
        fail(`${w}: why must say what went wrong in the incident`);
    }
    if (typeof c.minRecall !== 'number' || c.minRecall < 0 || c.minRecall > 1)
      fail(`${where}: minRecall must be between 0 and 1`);
  }
  // Retired cases are kept, not deleted. A case leaves the replay when it turns
  // out to be unwinnable rather than hard — most often because the incident was
  // fixed by adding a gate, and the brief tells the reviewer that anything a
  // wired `*:check` gate — one a hook or a workflow invokes — would already
  // fail is not a finding but a suppressed count. A checker nothing runs is
  // not a gate, so it retires no case.
  // Deleting such a case loses the reason and invites the next person to add it
  // back; the id stays reserved and the reason stays readable.
  if (set.retired !== undefined) {
    if (!Array.isArray(set.retired)) fail('retired must be an array');
    for (const r of set.retired) {
      const where = `retired ${r.id ?? '(no id)'}`;
      if (typeof r.id !== 'string' || !ID.test(r.id))
        fail(`${where}: id must be a lowercase slug`);
      if (ids.has(r.id)) fail(`${r.id} is both a case and retired`);
      ids.add(r.id);
      if (typeof r.title !== 'string' || !r.title) fail(`${where}: no title`);
      if (typeof r.incident !== 'string' || !r.incident)
        fail(`${where}: incident must cite the ADR or issue it comes from`);
      if (typeof r.reason !== 'string' || !r.reason)
        fail(`${where}: reason must say why the case cannot be won`);
      if (r.base !== undefined && !SHA.test(r.base))
        fail(`${where}: base must be a full 40-hex SHA`);
      if (r.head !== undefined && !SHA.test(r.head))
        fail(`${where}: head must be a full 40-hex SHA`);
    }
  }
  return set;
}

const severityRank = (s) => FINDING_SEVERITIES.indexOf(s);
/** blocking (0) is the most severe, so "at least should-fix" means rank ≤ 1. */
const atLeast = (severity, min) =>
  !min || severityRank(severity) <= severityRank(min);

const matches = (expected, finding) =>
  finding.axis === expected.axis &&
  compile(expected.source).test(finding.source) &&
  compile(expected.rule).test(finding.rule) &&
  expected.files.includes(finding.location?.file ?? '') &&
  atLeast(finding.severity, expected.minSeverity);

/**
 * @param {object} goldenCase one entry of `cases`
 * @param {{ findings: object[] }} normalized the validator's output for that range
 */
export const scoreCase = (goldenCase, normalized) => {
  const findings = normalized.findings ?? [];
  const used = new Set();
  const matched = [];
  const missed = [];
  for (const expected of goldenCase.expected) {
    const hit = findings.find((f) => !used.has(f.id) && matches(expected, f));
    if (!hit) {
      missed.push(expected.id);
      continue;
    }
    used.add(hit.id);
    // Would the strict tuple hash have matched? Only when the expected
    // patterns are literal enough to be a tuple themselves.
    const strict =
      hit.id ===
      findingId({
        axis: expected.axis,
        source: expected.source,
        rule: expected.rule,
        location: { file: hit.location.file },
      });
    matched.push({ expected: expected.id, finding: hit.id, strict });
  }
  const recall = matched.length / goldenCase.expected.length;
  return {
    case: goldenCase.id,
    expected: goldenCase.expected.length,
    matched,
    missed,
    unexpected: findings.length - matched.length,
    recall,
    minRecall: goldenCase.minRecall,
    pass: recall >= goldenCase.minRecall,
  };
};

export const renderScore = (goldenCase, score) => {
  const lines = [
    `## Golden replay — ${goldenCase.id}: ${score.pass ? 'pass' : 'FAIL'}`,
    '',
    `${goldenCase.title} (${goldenCase.incident}). Range \`${goldenCase.base.slice(0, 7)}...${goldenCase.head.slice(0, 7)}\`.`,
    '',
    `Recall ${score.matched.length}/${score.expected} (minimum ${score.minRecall}); ${score.unexpected} other finding(s).`,
    '',
  ];
  for (const m of score.matched)
    lines.push(
      `- matched \`${m.expected}\` by finding \`${m.finding}\`${m.strict ? ' (exact tuple)' : ''}`,
    );
  for (const id of score.missed) {
    const e = goldenCase.expected.find((x) => x.id === id);
    lines.push(`- **missed** \`${id}\`: ${e.why}`);
  }
  return `${lines.join('\n')}\n`;
};
