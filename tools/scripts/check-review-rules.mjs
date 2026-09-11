#!/usr/bin/env node
// Asserts that the bounded rule catalogue (tools/config/review-rules.json)
// still agrees with everything it is drawn from (issue #724).
//
//   node tools/scripts/check-review-rules.mjs [--print]
//
// A finding's identity hashes its rule id, and the validator rejects an id the
// catalogue does not carry. That makes three kinds of drift expensive:
//
//   1. The catalogue says a word the finding contract does not — an axis or a
//      severity cap that matches nothing. A cap nobody can compare against
//      passes everything, which is the silent no-op shape this repo keeps
//      finding. The same applies to a `cites` path that no longer exists: a
//      standards rule is only as good as the document behind it.
//   2. The obligation family stops mirroring tools/config/review-obligations.json.
//      An obligation whose answer exposes a defect is written up as an ordinary
//      finding, and it has nothing to write it up as if the id is missing.
//   3. The skill stops offering the catalogue the reviewer selects from. The
//      sub-agent sees only what the prompt carries, so an id that is in the
//      catalogue and not in the prompt cannot be chosen, and an id that is in
//      the prompt and not in the catalogue produces a report the validator
//      rejects whole — the worst outcome available, because a rejected report
//      is no report.
//
// Exit 0 = in sync. Exit 1 = drift. Exit 2 = the check could not run.
import { existsSync, readFileSync } from 'node:fs';

import {
  familyOf,
  loadRuleCatalogue,
  RULES_DISPLAY_PATH,
} from './review/rules.mjs';
import { isMain } from './review/cli.mjs';
import {
  FINDING_AXES,
  FINDING_SEVERITIES,
  SMELL_BASELINE_SOURCE,
} from './review/schema.mjs';

export const OBLIGATIONS = 'tools/config/review-obligations.json';
export const SKILL = '.agents/skills/code-review/SKILL.md';

/** The prefix an obligation's rule id carries, so the two lists line up. */
export const OBLIGATION_RULE_PREFIX = 'obligation-';

/**
 * An id-shaped code span. Backticks are required: the skill's prose never
 * writes a bare id, and matching bare words would make a sentence *about*
 * rules look like a rule.
 */
const ID_IN_PROSE = /`([a-z][a-z0-9-]*)`/g;

/**
 * The ids a document offers the reviewer. `smell-baseline` is excluded by
 * name: it is the `source` string a smell finding carries, not a rule id, and
 * it is shaped like one.
 *
 * @param {string} text the document, verbatim
 * @returns {Set<string>} every id-shaped code span in it
 */
export const idsOfferedBy = (text) =>
  new Set(
    [...text.matchAll(ID_IN_PROSE)]
      .map((m) => m[1])
      .filter((word) => word !== SMELL_BASELINE_SOURCE),
  );

/**
 * Every disagreement, as one line each. Pure: the caller supplies the three
 * documents and the predicate that decides whether a cited path exists, so a
 * test can exercise the comparison without a tree to break.
 *
 * @param {{ catalogue: object, obligations: object[], skill: string, exists?: (p: string) => boolean }} input
 * @returns {string[]} findings, empty when the catalogue is in step
 */
export const compareRuleCatalogue = ({
  catalogue,
  obligations,
  skill,
  exists = existsSync,
}) => {
  const findings = [];
  const ids = catalogue.rules.map((r) => r.id);

  // 1. The finding contract's own vocabulary.
  for (const rule of catalogue.rules) {
    for (const axis of rule.axes) {
      if (!FINDING_AXES.includes(axis))
        findings.push(`${rule.id}: axis "${axis}" is not a finding axis`);
    }
    if (rule.maxSeverity && !FINDING_SEVERITIES.includes(rule.maxSeverity))
      findings.push(
        `${rule.id}: maxSeverity "${rule.maxSeverity}" is not a severity, so the cap can never fire`,
      );
    if (rule.cites && !exists(rule.cites))
      findings.push(`${rule.id}: cites ${rule.cites}, which does not exist`);
  }

  // 2. The obligation family, in both directions.
  const unclaimed = new Set(
    ids.filter((id) => id.startsWith(OBLIGATION_RULE_PREFIX)),
  );
  for (const o of obligations) {
    const want = `${OBLIGATION_RULE_PREFIX}${o.id}`;
    if (!unclaimed.delete(want))
      findings.push(
        `${OBLIGATIONS} has obligation "${o.id}" with no "${want}" rule in ${RULES_DISPLAY_PATH}`,
      );
  }
  for (const orphan of unclaimed)
    findings.push(
      `${RULES_DISPLAY_PATH} has "${orphan}", which is no longer an obligation in ${OBLIGATIONS}`,
    );

  // 3. The prompt the reviewer actually receives, in both directions.
  const offered = idsOfferedBy(skill);
  for (const id of ids) {
    if (!offered.has(id))
      findings.push(
        `${id}: in ${RULES_DISPLAY_PATH} but nowhere in ${SKILL}, so the reviewer is never offered it`,
      );
  }
  const known = new Set(ids);
  for (const word of offered) {
    // Only words shaped like a catalogue id are judged. Anything else in the
    // skill is ordinary prose in backticks — a field name, a path, a command.
    // `familyOf` is that shape test, and reaching it rather than re-spelling
    // the families here is what stops a sixth family from being silently
    // unjudged (AGENTS.md, fan-out over a domain enum).
    if (familyOf(word) && !known.has(word))
      findings.push(
        `${SKILL} offers "${word}", which is not in ${RULES_DISPLAY_PATH} — a report naming it is rejected whole`,
      );
  }

  return findings;
};

export const main = (argv = process.argv.slice(2)) => {
  const bail = (msg) => {
    console.error(`review-rules: ${msg}`);
    process.exit(2);
  };

  for (const path of [OBLIGATIONS, SKILL])
    if (!existsSync(path)) bail(`${path} not found`);

  let catalogue;
  try {
    catalogue = loadRuleCatalogue();
  } catch (err) {
    bail(err.message);
  }
  const obligations = JSON.parse(readFileSync(OBLIGATIONS, 'utf8')).obligations;
  const skill = readFileSync(SKILL, 'utf8');

  if (argv.includes('--print')) {
    for (const rule of catalogue.rules) {
      const cap = rule.maxSeverity ? ` ≤${rule.maxSeverity}` : '';
      const fallback = rule.fallback ? ' (fallback)' : '';
      console.log(
        `  ${rule.id}  [${rule.axes.join('|')}]${cap}${fallback} — ${rule.title}`,
      );
    }
  }

  const findings = compareRuleCatalogue({ catalogue, obligations, skill });
  if (findings.length) {
    console.error(
      `review-rules: ${findings.length} finding(s) — the rule catalogue is out of step`,
    );
    for (const f of findings) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `review-rules: OK — ${catalogue.rules.length} rule ids, ${obligations.length} mirrored obligations, all offered by ${SKILL}`,
  );
};

// Behind an isMain guard because the contract tests import the comparison from
// this file. Run at load, `main` exits the process the moment the catalogue and
// its sources disagree — so the tests would die before the first one ran, and
// precisely while the gate was doing its job.
if (isMain(import.meta.url)) main();
