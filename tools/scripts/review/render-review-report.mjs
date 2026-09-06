#!/usr/bin/env node
// Renders a normalized `/code-review` report as the two-section Markdown a
// human reads, in the terminal or on the Pull Request (ADR 0070 item 8).
//
//   node tools/scripts/review/render-review-report.mjs <normalized.json> [--previous <normalized.json>] [--out <report.md>]
//
// The reviewer never writes prose; this is the only source of it. Two
// sections, Standards and Spec, each sorted by severity within itself and
// never across (ADR 0017). Nits are folded. With --previous, a strip of new,
// persisting, and resolved findings is derived from ids.
//
// Exit 0 = rendered. Exit 2 = the script could not run.
import { readFileSync, writeFileSync } from 'node:fs';

import { FINDING_AXES, bySeverity } from './schema.mjs';

const AXIS_TITLE = { standards: 'Standards', spec: 'Spec' };
const VERDICT_TITLE = {
  'request-changes': 'Request changes',
  comment: 'Comment',
  approve: 'Approve',
};

const cannotRun = (msg) => {
  console.error(`review-render: ${msg}`);
  process.exit(2);
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    cannotRun(`cannot read ${path}: ${err.message}`);
  }
};

const locationText = (f) =>
  f.location
    ? `\`${f.location.file}:${f.location.startLine}${f.location.endLine ? `-${f.location.endLine}` : ''}\``
    : null;

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

const renderFinding = (f) => {
  const head = [`**${f.severity}**`, f.summary, locationText(f)]
    .filter(Boolean)
    .join(' · ');
  const lines = [
    `- ${head}`,
    `  - source: \`${f.source}\` — ${f.rule}`,
    `  - ${evidenceText(f)}`,
  ];
  if (f.evidence.kind === 'executed' && f.evidence.outputExcerpt) {
    lines.push(
      '  ```',
      ...f.evidence.outputExcerpt.split('\n').map((l) => `  ${l}`),
      '  ```',
    );
  }
  if (f.wouldBlock) lines.push('  - would block with evidence');
  if (f.confidence) lines.push(`  - confidence: ${f.confidence}`);
  if (f.remedy) lines.push(`  - remedy: ${f.remedy}`);
  lines.push(`  - id: \`${f.id}\``);
  return lines.join('\n');
};

const renderAxis = (axis, findings) => {
  const sorted = [...findings].sort(bySeverity);
  const main = sorted.filter((f) => f.severity !== 'nit');
  const nits = sorted.filter((f) => f.severity === 'nit');
  const out = [`## ${AXIS_TITLE[axis]}`, ''];
  if (sorted.length === 0) {
    out.push('No findings.', '');
    return out.join('\n');
  }
  if (main.length) out.push(main.map(renderFinding).join('\n'), '');
  if (nits.length) {
    out.push(
      '<details>',
      `<summary>${nits.length} nit${nits.length === 1 ? '' : 's'}</summary>`,
      '',
      nits.map(renderFinding).join('\n'),
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

export const renderReport = (report, previous = null) => {
  const specText =
    report.spec.kind === 'none'
      ? 'none (tightened to review:human)'
      : `${report.spec.kind} ${report.spec.ref} (found by ${report.spec.foundBy})`;
  const tierText = report.effectiveTier ?? 'interactive';
  const parts = [
    `# Code review — ${VERDICT_TITLE[report.verdict]}`,
    '',
    `- range: \`${report.base.slice(0, 7)}...${report.head.slice(0, 7)}\``,
    `- tier: ${tierText}`,
    `- spec: ${specText}`,
    `- model: ${report.model} · ${report.durationMs} ms`,
    `- suppressed as redundant with deterministic checks: ${report.suppressed.redundant}`,
    '',
  ];
  if (previous) parts.push(renderDelta(report, previous));
  const byAxis = Object.fromEntries(
    FINDING_AXES.map((axis) => [
      axis,
      report.findings.filter((f) => f.axis === axis),
    ]),
  );
  for (const axis of FINDING_AXES) parts.push(renderAxis(axis, byAxis[axis]));
  parts.push(
    '---',
    FINDING_AXES.map(
      (axis) =>
        `${AXIS_TITLE[axis]}: ${byAxis[axis].length} finding(s), worst ${worst(byAxis[axis])}`,
    ).join(' · '),
    '',
  );
  return parts.join('\n');
};

const isMain =
  process.argv[1] &&
  import.meta.url ===
    new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;

if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? null : args[i + 1];
  };
  const inputPath = args.find(
    (a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'),
  );
  if (!inputPath)
    cannotRun(
      'usage: render-review-report.mjs <normalized.json> [--previous <path>] [--out <path>]',
    );
  const report = readJson(inputPath);
  const previousPath = flag('--previous');
  const previous = previousPath ? readJson(previousPath) : null;
  const markdown = renderReport(report, previous);
  const outPath = flag('--out');
  if (outPath) writeFileSync(outPath, markdown);
  else process.stdout.write(markdown);
}
