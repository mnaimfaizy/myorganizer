#!/usr/bin/env node
// Asserts that docs/sandcastle/dispatch-map.html still describes the dispatch pipeline it claims to.
//
//   node tools/scripts/check-sandcastle-map.mjs
//
// The page is a hand-designed diagram, so its prose cannot be generated. What can be checked
// is its numbers. The page carries one embedded manifest, split into two groups because they
// have different assertion strengths:
//
//   assertedFromExports          Every key maps to a real `export` in
//                                tools/scripts/lib/sandcastle-resume.mjs, or to a JSON path in
//                                tools/config/agent-model-policy.json / package.json. This group
//                                is verified by IMPORTING and READING, the way
//                                tools/scripts/check-agent-map.mjs does.
//
//   assertedFromOrchestratorSource
//                                Those values are module-local literals inside .sandcastle/main.mts
//                                and .sandcastle/dispatch-waves.mts with no export to import, so
//                                they are verified by ANCHORED regex against the source text.
//                                Anchored — `^…$` on the whole statement — and never a bare
//                                substring search: ADR 0043 records a gate that passed because
//                                `yarn openapi:artifacts` matched `openapi:artifacts:test`. A
//                                substring match here would reproduce that defect exactly.
//
// One value gets special handling. The literal 'lint test build' appears TWICE in main.mts as a
// bare constant — once as what the gate actually runs, and once as what the GitHub failure
// comment tells the maintainer it ran. There is no single fact to assert until they share one
// constant, so this check asserts that BOTH occurrences exist and that they agree with each
// other and with the manifest. That turns a latent duplicate-constant defect into a gate.
//
// Finally, a number that is correct in the manifest but absent from the page body is a fact the
// reader cannot see, so the load-bearing ones are also asserted against the rendered prose.
//
// Exit 0 = in sync. Exit 1 = drift (fix the page, or the source moved). Exit 2 = could not run.
import { readFileSync, existsSync } from 'node:fs';

const PAGE = 'docs/sandcastle/dispatch-map.html';
const RESUME = 'tools/scripts/lib/sandcastle-resume.mjs';
const POLICY = 'tools/config/agent-model-policy.json';
const PKG = 'package.json';
const MAIN = '.sandcastle/main.mts';
const WAVES = '.sandcastle/dispatch-waves.mts';

const fail = (msg) => {
  console.error(`sandcastle-map: ${msg}`);
  process.exit(2);
};

for (const f of [PAGE, RESUME, POLICY, PKG, MAIN, WAVES]) {
  if (!existsSync(f)) fail(`${f} not found`);
}

const page = readFileSync(PAGE, 'utf8');
const mainSrc = readFileSync(MAIN, 'utf8');
const wavesSrc = readFileSync(WAVES, 'utf8');
const policy = JSON.parse(readFileSync(POLICY, 'utf8'));
const pkg = JSON.parse(readFileSync(PKG, 'utf8'));

const manifestRaw = page.match(
  /<script type="application\/json" id="sandcastle-dispatch-manifest">([\s\S]*?)<\/script>/,
);
if (!manifestRaw)
  fail(
    `no #sandcastle-dispatch-manifest block in ${PAGE} — the page cannot be checked`,
  );

let manifest;
try {
  manifest = JSON.parse(manifestRaw[1]);
} catch (err) {
  fail(`#sandcastle-dispatch-manifest is not valid JSON: ${err.message}`);
}

const resume = await import(`../../${RESUME}`).catch((err) =>
  fail(`could not import ${RESUME}: ${err.message}`),
);

const findings = [];
const eq = (key, claimed, actual, where) => {
  const a = JSON.stringify(actual);
  const c = JSON.stringify(claimed);
  if (a !== c) findings.push(`${key}: page says ${c}, ${where} says ${a}`);
};

// ── Group 1: importable / readable ────────────────────────────────────────────
const exported = manifest.assertedFromExports ?? {};
const sandcastlePolicy = policy?.orchestrators?.sandcastle;
if (!sandcastlePolicy) fail(`${POLICY} has no orchestrators.sandcastle block`);

const fromExports = {
  resumeQuotaMaxWaitsPerRun: resume.MAX_QUOTA_WAITS,
  resumeQuotaMaxWaitMs: resume.MAX_WAIT_MS,
  resumeDiscardFlag: resume.DISCARD_FLAG,
  resumeMaintainerNoteMarker: resume.MAINTAINER_NOTE_MARKER,
  resumeSliceLogRunStartMarker: resume.RUN_START_MARKER,
  resumeGuardrailCount: resume.RESUME_GUARDRAILS?.length,
  resumeSliceDispositions: Object.values(resume.SLICE_DISPOSITIONS ?? {}),
  resumeLimitClassifications: Object.values(resume.LIMIT_CLASSIFICATIONS ?? {}),
  resumeLimitMatcherCountClaude: resume.LIMIT_MATCHERS?.claude?.length,
  resumeLimitMatcherCountCursor: resume.LIMIT_MATCHERS?.cursor?.length,
  resumeLimitMatcherCountCopilot: resume.LIMIT_MATCHERS?.copilot?.length,
  policySandcastleClaudeModelLow: sandcastlePolicy.claudeByComplexity?.low,
  policySandcastleClaudeModelMedium:
    sandcastlePolicy.claudeByComplexity?.medium,
  policySandcastleClaudeModelHigh: sandcastlePolicy.claudeByComplexity?.high,
  policySandcastleCursorDefault: sandcastlePolicy.cursorDefault,
  policySandcastleCopilotDefault: sandcastlePolicy.copilotDefault,
  packageSandcastleVersion:
    pkg.dependencies?.['@ai-hero/sandcastle'] ??
    pkg.devDependencies?.['@ai-hero/sandcastle'],
};

for (const [key, actual] of Object.entries(fromExports)) {
  if (actual === undefined) {
    findings.push(
      `${key}: no longer resolvable from ${RESUME} / ${POLICY} / ${PKG}`,
    );
    continue;
  }
  if (!(key in exported)) {
    findings.push(`${key}: missing from assertedFromExports`);
    continue;
  }
  eq(key, exported[key], actual, 'the source');
}
for (const key of Object.keys(exported)) {
  if (!(key in fromExports))
    findings.push(
      `assertedFromExports claims ${key}, which this check does not know how to verify`,
    );
}

// ── Group 2: anchored regex against the orchestrator sources ─────────────────
//
// Every pattern is anchored on both ends of a whole statement line (or block of lines).
// Leading indentation is `\s*` so a reformat does not fail the gate, but nothing else is
// loose — a pattern that matches a longer identifier or a different call site is the bug
// this design exists to prevent.
const claimedSrc = manifest.assertedFromOrchestratorSource ?? {};

/** Match exactly once, anchored. Returns the capture groups, or records a finding. */
const once = (key, file, src, pattern) => {
  const matches = [...src.matchAll(pattern)];
  if (matches.length === 0) {
    findings.push(
      `${key}: the anchored pattern no longer matches anything in ${file} — the source changed shape, so this value is unverifiable`,
    );
    return null;
  }
  if (matches.length > 1) {
    findings.push(
      `${key}: the anchored pattern matches ${matches.length} places in ${file} — it no longer identifies one fact`,
    );
    return null;
  }
  return matches[0];
};

const assertSrc = (key, file, src, pattern, transform = (m) => m[1]) => {
  if (!(key in claimedSrc)) {
    findings.push(`${key}: missing from assertedFromOrchestratorSource`);
    return;
  }
  const m = once(key, file, src, pattern);
  if (!m) return;
  eq(key, claimedSrc[key], transform(m), file);
};

const num = (m) => Number(m[1]);

assertSrc(
  'orchestratorSandboxImage',
  MAIN,
  mainSrc,
  /^const SANDBOX_IMAGE = '([^']+)';$/gm,
);
assertSrc(
  'orchestratorMaxIterations',
  MAIN,
  mainSrc,
  /^\s*maxIterations: (\d+),$/gm,
  num,
);
assertSrc(
  'orchestratorIdleTimeoutSeconds',
  MAIN,
  mainSrc,
  /^\s*idleTimeoutSeconds: (\d+),$/gm,
  num,
);
assertSrc(
  'orchestratorInstallHookTimeoutMs',
  MAIN,
  mainSrc,
  /^\s*timeoutMs: (\d+),$/gm,
  num,
);
assertSrc(
  'orchestratorAffectedGraphTimeoutMs',
  MAIN,
  mainSrc,
  /^\s*\{ encoding: 'utf8', windowsHide: true, timeout: (\d+) \},$/gm,
  num,
);
assertSrc(
  'orchestratorSlugMaxChars',
  MAIN,
  mainSrc,
  /^\s*\.slice\(0, (\d+)\);$/gm,
  num,
);
assertSrc(
  'orchestratorPrdIssueListLimit',
  MAIN,
  mainSrc,
  /^\s*'--state',\n\s*'all',\n\s*'--json',\n\s*'number,title,state,labels,body',\n\s*'--limit',\n\s*'(\d+)',$/gm,
  num,
);
assertSrc(
  'orchestratorSweepIssueListLimit',
  MAIN,
  mainSrc,
  /^\s*'--state',\n\s*'open',\n\s*'--json',\n\s*'number,title,state,labels,body',\n\s*'--limit',\n\s*'(\d+)',$/gm,
  num,
);
assertSrc(
  'orchestratorCheckpointTagPattern',
  MAIN,
  mainSrc,
  /^\s*const tag = `wip\/\$\{issue\.number\}-checkpoint`;$/gm,
  // The source builds the tag by interpolation; the manifest states its shape.
  () => 'wip/<issue>-checkpoint',
);
assertSrc(
  'orchestratorQuotaWaitMarginMs',
  MAIN,
  mainSrc,
  /^\s*const sleepMs = Math\.max\(untilMs, 0\) \+ (\d+) \* (\d+) \* (\d+);$/gm,
  (m) => Number(m[1]) * Number(m[2]) * Number(m[3]),
);
assertSrc(
  'gateContainerTimeoutMs',
  MAIN,
  mainSrc,
  /^\s*timeout: (\d+),$/gm,
  num,
);
assertSrc(
  'wavesSliceListLimit',
  WAVES,
  wavesSrc,
  /^\s*'--json',\n\s*'number,title,labels,body,state',\n\s*'--limit',\n\s*'(\d+)',$/gm,
  num,
);

// gateDefaultTargets — the duplicate. Both occurrences must exist and agree.
{
  const key = 'gateDefaultTargets';
  if (!(key in claimedSrc)) {
    findings.push(`${key}: missing from assertedFromOrchestratorSource`);
  } else {
    const runs = once(
      `${key} (what the gate runs)`,
      MAIN,
      mainSrc,
      /^\s*const targets = \(process\.env\.SLICE_GATE_TARGETS \|\| '([^']*)'\)\.trim\(\);$/gm,
    );
    const named = once(
      `${key} (what the failure comment names)`,
      MAIN,
      mainSrc,
      /^\s*\? `the build gate \(\$\{process\.env\.SLICE_GATE_TARGETS \|\| '([^']*)'\}\) failed`$/gm,
    );
    if (runs && named) {
      if (runs[1] !== named[1]) {
        findings.push(
          `${key}: the two bare literals in ${MAIN} disagree — the gate runs '${runs[1]}' but the GitHub failure comment says '${named[1]}'. Hoist them into one constant.`,
        );
      }
      eq(key, claimedSrc[key], runs[1], MAIN);
    }
  }
}

for (const key of Object.keys(claimedSrc)) {
  const known = new Set([
    'orchestratorSandboxImage',
    'orchestratorMaxIterations',
    'orchestratorIdleTimeoutSeconds',
    'orchestratorInstallHookTimeoutMs',
    'orchestratorAffectedGraphTimeoutMs',
    'orchestratorSlugMaxChars',
    'orchestratorPrdIssueListLimit',
    'orchestratorSweepIssueListLimit',
    'orchestratorCheckpointTagPattern',
    'orchestratorQuotaWaitMarginMs',
    'gateDefaultTargets',
    'gateContainerTimeoutMs',
    'wavesSliceListLimit',
  ]);
  if (!known.has(key))
    findings.push(
      `assertedFromOrchestratorSource claims ${key}, which this check does not know how to verify`,
    );
}

// ── The page must actually say the load-bearing numbers ──────────────────────
// A manifest value the prose never repeats is a fact the reader cannot see. Only the values
// the page is built around are checked here; the rest live in the manifest alone.
const body = page.replace(/<script[\s\S]*?<\/script>/g, '');
const mustAppear = [
  ['gateDefaultTargets', 'lint test build'],
  ['gateContainerTimeoutMs', '3,600,000'],
  ['orchestratorInstallHookTimeoutMs', '1,200,000'],
  ['orchestratorMaxIterations', 'maxIterations 2'],
  ['orchestratorIdleTimeoutSeconds', '1,800'],
  ['orchestratorCheckpointTagPattern', 'wip/&lt;issue&gt;-checkpoint'],
  ['policySandcastleClaudeModelHigh', 'claude-opus-5'],
  ['policySandcastleClaudeModelLow', 'claude-haiku-4-5'],
  ['policySandcastleCursorDefault', 'composer-2.5'],
  ['packageSandcastleVersion', '0.12.0'],
  ['resumeMaintainerNoteMarker', '## Maintainer Review'],
  ['resumeSliceLogRunStartMarker', '--- Run started:'],
  ['orchestratorPrdIssueListLimit', 'PRD 100'],
  ['orchestratorSweepIssueListLimit', 'sweep 200'],
];
for (const [key, needle] of mustAppear) {
  if (!body.includes(needle))
    findings.push(
      `${key}: the manifest carries it but the page body never says "${needle}" — a number the reader cannot see`,
    );
}

if (findings.length > 0) {
  console.error(
    `sandcastle-map: ${findings.length} finding(s) — ${PAGE} is out of date\n`,
  );
  for (const f of findings) console.error(`  - ${f}`);
  console.error(
    `\nRead the constants out of ${MAIN}, ${WAVES}, and ${RESUME}, then update the page and its manifest.`,
  );
  process.exit(1);
}

console.log(
  `sandcastle-map: OK — ${Object.keys(exported).length} exported + ${Object.keys(claimedSrc).length} source-anchored value(s) match, and both 'lint test build' literals in ${MAIN} agree.`,
);
