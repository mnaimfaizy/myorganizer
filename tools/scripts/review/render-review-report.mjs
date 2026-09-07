#!/usr/bin/env node
// Renders a normalized `/code-review` report as the two-section Markdown a
// human reads, in the terminal or on the Pull Request (ADR 0071 item 8).
//
//   node tools/scripts/review/render-review-report.mjs <normalized.json> [--previous <normalized.json>] [--out <report.md>] [--no-hunks]
//
// The reviewer never writes prose; this is the only source of it. The input
// must be the validator's output — a raw report is refused, so the only path
// to prose runs through normalizeReport. Two sections, Standards and Spec,
// each sorted by severity within itself and never across (ADR 0017). Nits
// are folded. A located finding shows the addressed lines, read from the
// checkout at the head SHA (`git show`), so the reader sees the hunk without
// any diff text having passed through a model. With --previous, a strip of
// new, persisting, and resolved findings is derived from ids.
//
// Exit 0 = rendered. Exit 2 = the script could not run, or the input is not
// a normalized report.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { ZodError } from 'zod';

import { cannotRun, isMain, parseArgs, readJsonOr } from './cli.mjs';
import {
  AXIS_TITLES,
  FINDING_AXES,
  NormalizedReportSchema,
  VERDICT_TITLES,
  bySeverity,
  formatIssues,
} from './schema.mjs';

/** Most lines of a hunk shown inline; a finding is a pointer, not a file. */
export const HUNK_MAX_LINES = 30;

const locationText = (f) =>
  f.location
    ? `\`${f.location.file}:${f.location.startLine}${f.location.endLine ? `-${f.location.endLine}` : ''}\``
    : null;

/**
 * Read the addressed lines from the checkout at the finding's head SHA.
 * Returns null when git cannot serve them (not a repo, unknown SHA, file
 * absent at that commit); the renderer then says so instead of guessing.
 */
export const readHunk = (location, cwd = process.cwd()) => {
  const result = spawnSync(
    'git',
    ['show', `${location.headSha}:${location.file}`],
    { cwd, encoding: 'utf8' },
  );
  if (result.status !== 0) return null;
  const lines = result.stdout.split('\n');
  const start = location.startLine;
  const end = Math.min(
    location.endLine ?? location.startLine,
    start + HUNK_MAX_LINES - 1,
    lines.length,
  );
  if (start > lines.length) return null;
  const width = String(end).length;
  return lines
    .slice(start - 1, end)
    .map((l, i) => `${String(start + i).padStart(width)} | ${l}`)
    .join('\n');
};

const evidenceText = (f) => {
  const e = f.evidence;
  if (e.kind === 'executed') {
    return `executed \`${e.command}\` (exit ${e.exitCode}, in \`${e.cwd}\`)`;
  }
  if (e.kind === 'cited') {
    // Spec quotes are authored outside the repo: fenced, never interpolated.
    return e.sourceKind === 'spec'
      ? `cited spec (untrusted quote): \`${e.quote.replace(/`/g, "'")}\``
      : `cited standard: ${e.quote}`;
  }
  return `inferred: ${e.reasoning}`;
};

const fence = (text) => [
  '  ```',
  ...text.split('\n').map((l) => `  ${l}`),
  '  ```',
];

const renderFinding = (f, { hunks }) => {
  const head = [`**${f.severity}**`, f.summary, locationText(f)]
    .filter(Boolean)
    .join(' · ');
  const lines = [
    `- ${head}`,
    `  - source: \`${f.source}\` — ${f.rule}`,
    `  - ${evidenceText(f)}`,
  ];
  if (f.evidence.kind === 'executed' && f.evidence.outputExcerpt) {
    lines.push(...fence(f.evidence.outputExcerpt));
  }
  if (f.location && hunks) {
    const hunk = readHunk(f.location);
    lines.push(
      hunk === null
        ? `  - hunk unavailable at \`${f.location.headSha.slice(0, 7)}\``
        : `  - at \`${f.location.headSha.slice(0, 7)}\`:`,
    );
    if (hunk !== null) lines.push(...fence(hunk));
  }
  if (f.wouldBlock) lines.push('  - would block with evidence');
  if (f.confidence) lines.push(`  - confidence: ${f.confidence}`);
  if (f.remedy) lines.push(`  - remedy: ${f.remedy}`);
  lines.push(`  - id: \`${f.id}\``);
  return lines.join('\n');
};

const renderAxis = (axis, findings, opts) => {
  const sorted = [...findings].sort(bySeverity);
  const main = sorted.filter((f) => f.severity !== 'nit');
  const nits = sorted.filter((f) => f.severity === 'nit');
  const out = [`## ${AXIS_TITLES[axis]}`, ''];
  if (sorted.length === 0) {
    out.push('No findings.', '');
    return out.join('\n');
  }
  if (main.length)
    out.push(main.map((f) => renderFinding(f, opts)).join('\n'), '');
  if (nits.length) {
    out.push(
      '<details>',
      `<summary>${nits.length} nit${nits.length === 1 ? '' : 's'}</summary>`,
      '',
      nits.map((f) => renderFinding(f, opts)).join('\n'),
      '',
      '</details>',
      '',
    );
  }
  return out.join('\n');
};

const renderDelta = (current, previous) => {
  const now = new Map(current.findings.map((f) => [f.id, f]));
  const before = new Map(previous.findings.map((f) => [f.id, f]));
  const fresh = [...now.keys()].filter((id) => !before.has(id));
  const persisting = [...now.keys()].filter((id) => before.has(id));
  const resolved = [...before.keys()].filter((id) => !now.has(id));
  const item = (label, ids) =>
    `- ${label}: ${ids.length}${ids.length ? ` (${ids.map((id) => `\`${id}\``).join(', ')})` : ''}`;
  return [
    `Since \`${previous.head.slice(0, 7)}\`:`,
    item('new', fresh),
    item('persisting', persisting),
    item('resolved', resolved),
    '',
  ].join('\n');
};

const worst = (findings) =>
  [...findings].sort(bySeverity)[0]?.severity ?? 'none';

/**
 * Render a normalized report. Throws a ZodError when `report` is not the
 * validator's output; callers that read from disk turn that into exit 2.
 */
export const renderReport = (raw, previous = null, { hunks = true } = {}) => {
  const report = NormalizedReportSchema.parse(raw);
  const prior = previous ? NormalizedReportSchema.parse(previous) : null;
  const specText =
    report.spec.kind === 'none'
      ? 'none (tightened to review:human)'
      : `${report.spec.kind} ${report.spec.ref} (found by ${report.spec.foundBy})`;
  const tierText = report.effectiveTier ?? 'interactive';
  const costText = report.cost
    ? ` · ${report.cost.inputTokens} in / ${report.cost.outputTokens} out tokens`
    : '';
  const parts = [
    `# Code review — ${VERDICT_TITLES[report.verdict]}`,
    '',
    `- range: \`${report.base.slice(0, 7)}...${report.head.slice(0, 7)}\``,
    `- tier: ${tierText}`,
    `- spec: ${specText}`,
    `- model: ${report.model} · ${report.durationMs} ms${costText}`,
    `- suppressed as redundant with deterministic checks: ${report.suppressed.redundant}`,
    '',
  ];
  if (prior) parts.push(renderDelta(report, prior));
  const byAxis = Object.fromEntries(
    FINDING_AXES.map((axis) => [
      axis,
      report.findings.filter((f) => f.axis === axis),
    ]),
  );
  for (const axis of FINDING_AXES)
    parts.push(renderAxis(axis, byAxis[axis], { hunks }));
  parts.push(
    '---',
    FINDING_AXES.map(
      (axis) =>
        `${AXIS_TITLES[axis]}: ${byAxis[axis].length} finding(s), worst ${worst(byAxis[axis])}`,
    ).join(' · '),
    '',
  );
  return parts.join('\n');
};

const USAGE =
  'usage: render-review-report.mjs <normalized.json> [--previous <path>] [--out <path>] [--no-hunks]';

export const main = (argv) => {
  const bail = cannotRun('review-render');
  const { positional, flags } = parseArgs(argv);
  const [inputPath] = positional;
  if (!inputPath) bail(USAGE);
  const report = readJsonOr(inputPath, bail);
  const previous = flags.previous ? readJsonOr(flags.previous, bail) : null;
  let markdown;
  try {
    markdown = renderReport(report, previous, {
      hunks: !('no-hunks' in flags),
    });
  } catch (err) {
    if (!(err instanceof ZodError)) throw err;
    bail(
      `${inputPath} is not a normalized report — run review:validate first\n  ${formatIssues(err).join('\n  ')}`,
    );
  }
  if (flags.out) writeFileSync(flags.out, markdown);
  else process.stdout.write(markdown);
};

if (isMain(import.meta.url)) main(process.argv.slice(2));
