/**
 * What a reviewer transcript says about the run that produced a report
 * (issue #1031, ADR 0123).
 *
 * A report used to state these facts about itself: which standards documents
 * the review was held to, which commands it ran, how long it took, which
 * model ran it. Each was written by the model being described, and CI run
 * 37576528356 listed four standards sources having opened none. They are
 * read here instead, from the transcript `anthropics/claude-code-action`
 * leaves behind, after the reviewer has exited.
 *
 * This module reads and reports. It fails nothing and tightens nothing: what
 * a fact costs is decided by whoever consumes the facts file.
 *
 * The transcript's shape belongs to the Claude Code CLI, which this
 * repository does not version. So "cannot tell" is its own answer: a
 * transcript that does not look the way this reader expects is `unknown`,
 * never an empty list. Read naively, a CLI release that renamed one field
 * would report "no sub-agent read its brief" on every pull request.
 */
import { tokenize } from '../lib/shell-command.mjs';
import { BRIEFS, axisNamedBy, isOnTemplate } from './briefs.mjs';

export const RUN_FACTS_SCHEMA_VERSION = 1;

/** The index every standards document is reached from. */
export const STANDARDS_INDEX = 'CODING_STANDARDS.md';

/**
 * Linked from the index and deliberately not a standards source: its entries
 * reach the review as an obligation worklist (the Standards brief says so).
 */
export const NOT_A_STANDARDS_SOURCE = Object.freeze([
  'docs/review/REVIEW_CHECKLIST.md',
]);

/** The tool names a sub-agent dispatch has gone by across CLI versions. */
const DISPATCH_TOOLS = new Set(['Agent', 'Task']);

const isObject = (v) => typeof v === 'object' && v !== null;

/**
 * A path as the repository spells it, or `null` when it is not inside the
 * workspace. `cwd` is the workspace root the transcript's init event names.
 */
export const toRepoPath = (path, cwd) => {
  if (typeof path !== 'string' || !path) return null;
  let p = path.replaceAll('\\', '/');
  const root = (cwd ?? '').replaceAll('\\', '/').replace(/\/+$/, '');
  if (p.startsWith('/')) {
    if (!root || !p.startsWith(`${root}/`)) return null;
    p = p.slice(root.length + 1);
  }
  const parts = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length ? parts.join('/') : null;
};

/**
 * Split a Bash call into its simple commands. Quoted text is kept whole, so
 * a `;` inside a quoted pattern does not start a command.
 */
const simpleCommands = (command) => {
  const commands = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    const two = command.slice(i, i + 2);
    if (two === '&&' || two === '||') {
      commands.push(current);
      current = '';
      i += 1;
      continue;
    }
    if (ch === ';' || ch === '|' || ch === '\n') {
      commands.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  commands.push(current);
  return commands.map((c) => c.trim()).filter(Boolean);
};

/**
 * The files one tool call returned the content of, by path.
 *
 * Opened means the call returns a file's content: the Read tool at any range,
 * `cat`, or `git show <rev>:<path>`. A search, a listing, a count, or the
 * first lines of a file is not an open — a grep hit proves a line matched,
 * not that a rule was read, and crediting it would credit `AGENTS.md` to
 * every run that searched the tree. A partial Read does count: nothing here
 * can judge how much was enough, and it does not pretend to.
 *
 * @param {{ name: string, input: object }} call a tool_use block
 * @param {string} cwd the workspace root
 * @returns {string[]} repo-relative paths, in order
 */
export const filesOpenedBy = (call, cwd) => {
  const input = isObject(call?.input) ? call.input : {};
  if (call?.name === 'Read') {
    const path = toRepoPath(input.file_path, cwd);
    return path ? [path] : [];
  }
  if (call?.name !== 'Bash' || typeof input.command !== 'string') return [];
  const opened = [];
  for (const simple of simpleCommands(input.command)) {
    const [program, ...args] = tokenize(simple);
    if (program === 'cat') {
      for (const arg of args) {
        if (arg.startsWith('-')) continue;
        const path = toRepoPath(arg, cwd);
        if (path) opened.push(path);
      }
    } else if (program === 'git' && args[0] === 'show') {
      for (const arg of args.slice(1)) {
        if (arg.startsWith('-')) continue;
        const colon = arg.indexOf(':');
        if (colon <= 0) continue;
        // `HEAD:"a b.md"` reaches here with its quotes: the tokenizer keeps
        // a quote that does not open the token.
        const path = toRepoPath(
          arg.slice(colon + 1).replace(/^(["'])(.*)\1$/, '$2'),
          cwd,
        );
        if (path) opened.push(path);
      }
    }
  }
  return opened;
};

/**
 * A test for "is this path a standards document", built from the index's own
 * text. A standards document is the index, a path the index links to — a
 * directory link covers everything under it — or an `AGENTS.md` at any depth.
 *
 * Built from the index rather than from a list here, so a document the index
 * does not name is never credited: that is the claim the index makes about
 * itself. With no index to read, only the index and Agent Guides qualify.
 *
 * @param {string | null} indexText `CODING_STANDARDS.md`, verbatim, or null
 * @returns {(path: string) => boolean}
 */
export const standardsDocumentTest = (indexText) => {
  const files = new Set([STANDARDS_INDEX]);
  const directories = [];
  if (typeof indexText === 'string') {
    for (const match of indexText.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const path = toRepoPath(target, '');
      if (!path) continue;
      if (target.endsWith('/')) directories.push(`${path}/`);
      else files.add(path);
    }
  }
  const excluded = new Set(NOT_A_STANDARDS_SOURCE);
  return (path) => {
    if (typeof path !== 'string' || excluded.has(path)) return false;
    if (files.has(path)) return true;
    if (path === 'AGENTS.md' || path.endsWith('/AGENTS.md')) return true;
    return directories.some((dir) => path.startsWith(dir));
  };
};

const unknownFacts = (reason, known = {}) => ({
  schemaVersion: RUN_FACTS_SCHEMA_VERSION,
  shape: 'unknown',
  shapeReason: reason,
  cliVersion: known.cliVersion ?? null,
  models: known.models ?? null,
  durationMs: known.durationMs ?? null,
  dispatches: null,
  axes: null,
  standardsSources: null,
  indexOpened: null,
  executed: null,
});

const emptyAxis = () => ({
  dispatched: false,
  briefRead: false,
  onTemplate: null,
  toolCalls: 0,
});

/**
 * Read a transcript.
 *
 * @param {string} text the execution file's contents
 * @param {{ index?: string | null }} [options] `CODING_STANDARDS.md` at the
 *   reviewed head, verbatim
 * @returns {object} the run facts; see `RunFactsSchema` in schema.mjs
 */
export const readTranscriptFacts = (text, { index = null } = {}) => {
  let events;
  try {
    events = JSON.parse(text);
  } catch {
    events = null;
  }
  if (!Array.isArray(events))
    return unknownFacts('the transcript is not a JSON array of events');

  const objects = events.filter(isObject);
  const init = objects.find((e) => e.type === 'system' && e.subtype === 'init');
  const result = objects.findLast((e) => e.type === 'result');
  const known = {
    cliVersion:
      typeof init?.claude_code_version === 'string'
        ? init.claude_code_version
        : null,
    models: isObject(result?.modelUsage)
      ? Object.keys(result.modelUsage).sort()
      : null,
    durationMs:
      typeof result?.duration_ms === 'number' &&
      Number.isFinite(result.duration_ms)
        ? Math.round(result.duration_ms)
        : null,
  };
  if (!init || typeof init.cwd !== 'string')
    return unknownFacts(
      'the transcript has no init event naming a workspace',
      known,
    );
  if (!result) return unknownFacts('the transcript has no result event', known);
  if (known.durationMs === null || !known.models?.length)
    return unknownFacts(
      'the result event carries no duration or no model usage',
      known,
    );

  // Every tool call, under the dispatch that made it (or under null, for the
  // main agent's own).
  const dispatches = new Map();
  const childCalls = new Map();
  for (const event of objects) {
    if (event.type !== 'assistant') continue;
    const parent = event.parent_tool_use_id ?? null;
    const blocks = Array.isArray(event.message?.content)
      ? event.message.content
      : [];
    for (const block of blocks) {
      if (!isObject(block) || block.type !== 'tool_use') continue;
      if (parent === null) {
        if (DISPATCH_TOOLS.has(block.name) && typeof block.id === 'string')
          dispatches.set(block.id, {
            prompt: isObject(block.input) ? block.input.prompt : undefined,
          });
        continue;
      }
      if (!childCalls.has(parent)) childCalls.set(parent, []);
      childCalls.get(parent).push(block);
    }
  }

  const attributed = [...dispatches.keys()].filter((id) => childCalls.has(id));
  if (dispatches.size > 0 && attributed.length === 0)
    return unknownFacts(
      `the transcript has ${dispatches.size} sub-agent dispatch(es) and no sub-agent event is attributed to any of them`,
      known,
    );

  const axes = Object.fromEntries(
    Object.keys(BRIEFS).map((axis) => [axis, emptyAxis()]),
  );
  const standardsOpened = [];
  const executed = [];
  const seenCommands = new Set();

  for (const [id, dispatch] of dispatches) {
    const calls = childCalls.get(id) ?? [];
    for (const call of calls) {
      const command = call.name === 'Bash' ? call.input?.command : undefined;
      if (typeof command === 'string' && !seenCommands.has(command)) {
        seenCommands.add(command);
        executed.push(command);
      }
    }
    const openedHere = calls.flatMap((call) => filesOpenedBy(call, init.cwd));
    // An axis is the one whose brief the sub-agent read first: a Spec
    // sub-agent reviewing a change to the skill opens the Standards brief too
    // (run 37707518833), and that does not make it the Standards axis.
    // Failing any brief, it is the one the dispatch named — which is how an
    // axis whose sub-agent never read its brief is still an axis that was
    // dispatched.
    const firstBrief = openedHere.find((path) =>
      Object.values(BRIEFS).includes(path),
    );
    const read = Object.keys(BRIEFS).find(
      (axis) => BRIEFS[axis] === firstBrief,
    );
    const axis = read ?? axisNamedBy(dispatch.prompt);
    if (!axis) continue;
    const entry = axes[axis];
    entry.dispatched = true;
    entry.briefRead = entry.briefRead || Boolean(read);
    // Every dispatch of an axis must be on template: a retry is a second one.
    const onTemplate = isOnTemplate(axis, dispatch.prompt);
    entry.onTemplate =
      entry.onTemplate === null ? onTemplate : entry.onTemplate && onTemplate;
    entry.toolCalls += calls.length;
    if (axis === 'standards') standardsOpened.push(...openedHere);
  }

  const isStandard = standardsDocumentTest(index);
  const standardsSources = [...new Set(standardsOpened.filter(isStandard))];

  return {
    schemaVersion: RUN_FACTS_SCHEMA_VERSION,
    shape: 'readable',
    shapeReason: null,
    ...known,
    dispatches: dispatches.size,
    axes,
    standardsSources,
    indexOpened: standardsOpened.includes(STANDARDS_INDEX),
    executed,
  };
};
