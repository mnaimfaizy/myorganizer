/**
 * Review obligations: the selected half of the review checklist
 * (docs/review/REVIEW_CHECKLIST.md).
 *
 * An obligation is not an instruction in the brief. The record says twice over
 * that an instruction written at the site of a miss does not produce a catch
 * (docs/research/2026-09-07-golden-replay-baseline.md,
 * docs/research/2026-09-09-wired-gate-qualifier-replay.md). What an obligation
 * changes is not what the reviewer is told but whether the check fires at all:
 * the trigger is matched HERE, outside the model, against the diff, and the
 * reviewer receives a worklist of concrete sites with a question it must answer
 * in writing. Noticing stops being the reviewer's job.
 *
 * The answers live BESIDE the finding contract, never inside it. ReportInputSchema
 * is a strict object and a report is accepted or rejected whole (ADR 0071), so a
 * malformed answer sheet folded into the report would reject the findings with it.
 * An unanswered obligation is a fact about the review's thoroughness, which is
 * neither a fact about the pipeline nor a judgment about the diff (ADR 0073), so
 * it is reported separately and fails nothing.
 *
 * Everything here is pure. `select-obligations.mjs` reads git and writes files.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { globToRegExp } from '../lib/glob.mjs';

// Re-exported: callers and tests of this module treat glob matching as
// part of the selector's surface. The implementation is shared with the
// Review Tier classifier, which is why it is not defined here.
export { globToRegExp };

export const OBLIGATION_CATALOGUE_SCHEMA_VERSION = 1;
export const OBLIGATIONS_PATH = join(
  'tools',
  'config',
  'review-obligations.json',
);

/** A worklist entry never carries more sites than this; the rest are counted. */
export const MAX_SITES_PER_OBLIGATION = 12;

const ID = /^[a-z0-9][a-z0-9-]*$/;

export class ObligationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ObligationError';
  }
}

const compile = (pattern, where) => {
  try {
    return new RegExp(pattern);
  } catch (err) {
    throw new ObligationError(
      `${where}: bad pattern ${pattern}: ${err.message}`,
    );
  }
};

export function assertObligationCatalogue(cat, source = 'obligations') {
  const fail = (msg) => {
    throw new ObligationError(`${source}: ${msg}`);
  };
  if (cat?.schemaVersion !== OBLIGATION_CATALOGUE_SCHEMA_VERSION)
    fail(`unsupported schemaVersion ${cat?.schemaVersion}`);
  if (!Array.isArray(cat.obligations) || cat.obligations.length === 0)
    fail('obligations must be a non-empty array');
  const ids = new Set();
  for (const o of cat.obligations) {
    const where = `obligation ${o.id ?? '(no id)'}`;
    if (typeof o.id !== 'string' || !ID.test(o.id))
      fail(`${where}: id must be a lowercase slug`);
    if (ids.has(o.id)) fail(`duplicate obligation id ${o.id}`);
    ids.add(o.id);
    for (const field of ['title', 'question', 'defect']) {
      if (typeof o[field] !== 'string' || !o[field])
        fail(`${where}: ${field} must be a non-empty string`);
    }
    if (!Array.isArray(o.answerFields) || o.answerFields.length === 0)
      fail(`${where}: answerFields must name at least one field`);
    if (new Set(o.answerFields).size !== o.answerFields.length)
      fail(`${where}: duplicate answerFields`);
    // Every entry is bought by an incident. A catalogue grown from prudence is
    // the brief that did not work; this is what keeps it evidence.
    if (typeof o.seededFrom !== 'string' || !o.seededFrom)
      fail(
        `${where}: seededFrom must cite the incident that bought this entry`,
      );
    if (typeof o.goldenCase !== 'string' || !ID.test(o.goldenCase))
      fail(`${where}: goldenCase must name the case that scores this entry`);
    const t = o.trigger;
    if (!t || typeof t !== 'object') fail(`${where}: trigger missing`);
    if (!Array.isArray(t.paths) || t.paths.length === 0)
      fail(`${where}: trigger.paths must name at least one glob`);
    for (const g of t.paths) {
      // A path is a bare glob, or a glob with its own addedPattern. One entry
      // often spans places that need different evidence: a version line in
      // package.json is a trigger, a whole generated directory is a trigger,
      // and the same regex cannot mean both.
      if (typeof g === 'string') {
        if (!g) fail(`${where}: bad trigger path`);
        continue;
      }
      if (!g || typeof g !== 'object') fail(`${where}: bad trigger path`);
      if (typeof g.glob !== 'string' || !g.glob)
        fail(`${where}: a trigger path object needs a glob`);
      if (g.addedPattern !== undefined) {
        if (typeof g.addedPattern !== 'string')
          fail(`${where}: ${g.glob}: addedPattern must be a string`);
        compile(g.addedPattern, `${where} (${g.glob})`);
      }
    }
    if (t.addedPattern !== undefined) {
      if (typeof t.addedPattern !== 'string')
        fail(`${where}: trigger.addedPattern must be a string`);
      compile(t.addedPattern, where);
    }
  }
  return cat;
}

export const loadObligationCatalogue = (path = OBLIGATIONS_PATH) =>
  assertObligationCatalogue(JSON.parse(readFileSync(path, 'utf8')), path);

/**
 * Added lines only, with their line numbers in the head file. A removal cannot
 * carry a site the reviewer is asked to inspect at `<head>`, and context lines
 * would fire an obligation on code the diff never touched.
 */
export const parseAddedLines = (diffText) => {
  const byFile = new Map();
  let file = null;
  let lineNo = 0;
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      file = raw.slice(6);
      if (file === '/dev/null') file = null;
      else if (!byFile.has(file)) byFile.set(file, []);
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = /@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
      lineNo = m ? Number(m[1]) : 0;
      continue;
    }
    if (!file) continue;
    if (raw.startsWith('+')) {
      byFile.get(file).push({ line: lineNo, text: raw.slice(1) });
      lineNo += 1;
    } else if (raw.startsWith('-') || raw.startsWith('\\')) {
      // a removal or "\ No newline"; neither advances the head line number
    } else {
      lineNo += 1;
    }
  }
  return byFile;
};

/**
 * Match the catalogue against one diff. Returns the worklist the reviewer is
 * handed: only obligations that fired, each with the sites that fired it.
 */
export const selectObligations = ({
  catalogue,
  addedLines,
  head,
  maxSites = MAX_SITES_PER_OBLIGATION,
}) => {
  const selected = [];
  for (const o of catalogue.obligations) {
    const entryPattern = o.trigger.addedPattern
      ? compile(o.trigger.addedPattern, o.id)
      : null;
    const rules = o.trigger.paths.map((p) =>
      typeof p === 'string'
        ? { glob: globToRegExp(p), pattern: entryPattern }
        : {
            glob: globToRegExp(p.glob),
            pattern:
              p.addedPattern === undefined
                ? entryPattern
                : compile(p.addedPattern, `${o.id} (${p.glob})`),
          },
    );
    const sites = [];
    for (const [file, lines] of addedLines) {
      const rule = rules.find((r) => r.glob.test(file));
      if (!rule) continue;
      if (!rule.pattern) {
        // A path-only trigger fires on the file, at its first changed line.
        sites.push({ file, line: lines[0]?.line ?? 1 });
        continue;
      }
      for (const { line, text } of lines) {
        if (rule.pattern.test(text)) sites.push({ file, line });
      }
    }
    if (sites.length === 0) continue;
    selected.push({
      id: o.id,
      title: o.title,
      question: o.question,
      answerFields: o.answerFields,
      defect: o.defect,
      sites: sites.slice(0, maxSites),
      truncated: Math.max(0, sites.length - maxSites),
    });
  }
  return { head, selected };
};

/** One answer per site the worklist named. */
export const AnswerSchema = z.strictObject({
  id: z.string().regex(ID),
  site: z.strictObject({ file: z.string().min(1), line: z.number().int() }),
  answer: z.record(z.string(), z.unknown()),
  raisedFindingIds: z.array(z.string()).optional(),
});

export const AnswerSheetSchema = z.strictObject({
  head: z.string().min(1),
  answers: z.array(AnswerSchema),
});

const siteKey = (id, site) => `${id}@${site.file}:${site.line}`;

/**
 * Completeness, never a verdict. Every fact here is reported and none of it
 * fails a check: an unanswered obligation says the review was thin, which is
 * worth knowing and is not grounds to reject a report that met its contract.
 */
export const checkAnswers = (worklist, sheet) => {
  const expected = new Map();
  for (const o of worklist.selected) {
    for (const site of o.sites)
      expected.set(siteKey(o.id, site), {
        id: o.id,
        site,
        fields: o.answerFields,
      });
  }
  const seen = new Set();
  const unanswered = [];
  const unexpected = [];
  const incomplete = [];
  for (const a of sheet.answers) {
    const key = siteKey(a.id, a.site);
    const want = expected.get(key);
    if (!want) {
      unexpected.push(key);
      continue;
    }
    seen.add(key);
    // A field is answered when it carries a value. An empty or whitespace-only
    // string is the shape that slips through: it satisfies a presence test
    // while telling a reader nothing, and every obligation's defect rule is a
    // comparison over what was actually written.
    const missing = want.fields.filter((f) => {
      const v = a.answer[f];
      return v === undefined || v === null || String(v).trim() === '';
    });
    if (missing.length) incomplete.push({ key, missing });
  }
  for (const [key, want] of expected) {
    if (!seen.has(key)) unanswered.push({ key, id: want.id, site: want.site });
  }
  return {
    head: worklist.head,
    expected: expected.size,
    answered: seen.size,
    unanswered,
    incomplete,
    unexpected,
    complete:
      unanswered.length === 0 && incomplete.length === 0 && expected.size > 0,
  };
};
