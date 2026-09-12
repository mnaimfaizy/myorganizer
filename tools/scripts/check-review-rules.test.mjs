// Covers the comparison the rule-catalogue gate performs.
//
// The comparison carries the risk. It decides whether the bounded vocabulary
// the validator enforces is the same vocabulary the reviewer is offered, and
// every way it can be wrong is a way this gate passes while a real report is
// rejected whole: a scan that matches nothing reports OK for an empty prompt,
// and a one-directional obligation check leaves an id in the catalogue that no
// obligation backs.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OBLIGATION_RULE_PREFIX,
  compareRuleCatalogue,
  idsOfferedBy,
} from './check-review-rules.mjs';
import { RULE_CATALOGUE_SCHEMA_VERSION } from './review/rules.mjs';

const rule = (over = {}) => ({
  id: 'standard-example',
  family: 'standard',
  title: 'An example rule',
  axes: ['standards'],
  cites: 'AGENTS.md',
  ...over,
});

/** Every rule id offered, so a case only has to state what it leaves out. */
const skillOffering = (ids) =>
  `prose about \`ruleId\`\n${ids.map((id) => `- \`${id}\` — a rule`).join('\n')}\n`;

const compare = ({
  rules = [rule()],
  obligations = [],
  skill,
  exists = () => true,
} = {}) =>
  compareRuleCatalogue({
    catalogue: { schemaVersion: RULE_CATALOGUE_SCHEMA_VERSION, rules },
    obligations,
    skill: skill ?? skillOffering(rules.map((r) => r.id)),
    exists,
  });

test('a catalogue in step with all three sources reports nothing', () => {
  assert.deepEqual(compare(), []);
});

test('an axis or a severity cap the finding contract does not know is named', () => {
  assert.match(
    compare({ rules: [rule({ axes: ['vibes'] })] })[0],
    /axis "vibes" is not a finding axis/,
  );
  // The silent no-op: a cap nothing can compare against passes every severity.
  assert.match(
    compare({ rules: [rule({ maxSeverity: 'smallish' })] })[0],
    /maxSeverity "smallish" is not a severity, so the cap can never fire/,
  );
});

test('a cited document that is gone is a finding, not a shrug', () => {
  assert.match(
    compare({ exists: () => false })[0],
    /cites AGENTS\.md, which does not exist/,
  );
});

test('the obligation family is compared in both directions', () => {
  const mirrored = rule({
    id: `${OBLIGATION_RULE_PREFIX}check-the-thing`,
    family: 'obligation',
    cites: 'docs/review/REVIEW_CHECKLIST.md',
  });
  assert.deepEqual(
    compare({ rules: [mirrored], obligations: [{ id: 'check-the-thing' }] }),
    [],
  );
  // An obligation with no rule: its answer exposes a defect the reviewer then
  // has no id to file under.
  assert.match(
    compare({ rules: [rule()], obligations: [{ id: 'check-the-thing' }] })[0],
    /has obligation "check-the-thing" with no "obligation-check-the-thing" rule/,
  );
  // A rule with no obligation: the reviewer is offered an id for a question
  // nobody is asked any more.
  assert.match(
    compare({ rules: [mirrored], obligations: [] })[0],
    /has "obligation-check-the-thing", which is no longer an obligation/,
  );
});

test('the skill is compared in both directions', () => {
  // In the catalogue, never offered: unreachable, because the sub-agent sees
  // only what the prompt carries.
  assert.match(
    compare({ skill: 'a prompt that offers nothing' })[0],
    /in tools\/config\/review-rules\.json but nowhere in .*SKILL\.md/,
  );
  // Offered, not in the catalogue: a report naming it is rejected whole.
  assert.match(
    compare({
      skill: skillOffering(['standard-example', 'smell-invented']),
    })[0],
    /offers "smell-invented", which is not in tools\/config\/review-rules\.json/,
  );
});

test('the id scan reads backticked ids and leaves ordinary prose alone', () => {
  const offered = idsOfferedBy(
    'pick `standard-other`, write `source`, run `yarn review:test`, and note ' +
      'that standard-other unquoted is prose. The `smell-baseline` source is ' +
      'not a rule id.',
  );
  assert.ok(offered.has('standard-other'));
  assert.ok(offered.has('source'));
  // `smell-baseline` is shaped like an id and is a source string, so scanning
  // it would report a catalogue entry that must never exist.
  assert.ok(!offered.has('smell-baseline'));
  assert.ok(!offered.has('yarn review:test'));
});

test('a word shaped like a rule id is judged; anything else is not', () => {
  // `source` is offered prose, not a rule id, so it is not reported missing
  // from the catalogue — that is what keeps this scan usable on a real skill.
  const findings = compare({
    skill: skillOffering(['standard-example']) + '\nalso `source` and `rule`.',
  });
  assert.deepEqual(findings, []);
});
