import process from 'node:process';

/**
 * Shared helpers for multi-harness agent hooks (Copilot CLI/cloud, VS Code Copilot,
 * Cursor IDE/CLI, Claude Code).
 *
 * Scripts emit dual-format JSON so one implementation works across hosts.
 */

export const MUTATING_TOOL_NAMES = new Set([
  // Copilot CLI / cloud
  'apply_patch',
  'applypatch',
  'bash',
  'command',
  'create',
  'delete',
  'edit',
  'execute',
  'move',
  'multiedit',
  'multi_edit',
  'patch',
  'powershell',
  'rename',
  'replace',
  'run',
  'shell',
  'write',
  // Cursor tool types (preToolUse matcher values, lowercased)
  'delete',
  'shell',
  'write',
  // VS Code Copilot Chat tool names
  'create_file',
  'createfile',
  'deletefile',
  'editfiles',
  'replace_string_in_file',
  'runterminalcommand',
  // Claude Code tool names (payloads may use these)
  'bash',
  'edit',
  'write',
]);

export function normalizeText(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

/** Tool names whose input carries a shell command rather than file arguments. */
export const SHELL_TOOL_NAMES = new Set([
  'bash',
  'command',
  'execute',
  'powershell',
  'run',
  'runterminalcommand',
  'shell',
]);

/** Input keys that hold a shell command. */
export const COMMAND_KEYS = new Set(['cmd', 'command', 'script', 'shell']);

/**
 * Input keys that name a file a tool is about to write.
 *
 * Deliberately excludes `pattern` (a search expression, not a destination) and
 * every content-bearing key — `content`, `new_string`, `old_string`. Matching
 * content is how a hook ends up firing because a document *mentions* a path.
 */
export const WRITE_PATH_KEYS = new Set([
  'dest',
  'destination',
  'dir',
  'directory',
  'file',
  'file_path',
  'filename',
  'filenames',
  'filepath',
  'filePath',
  'files',
  'folder',
  'new_path',
  'notebook_path',
  'old_path',
  'path',
  'paths',
  'target',
  'targets',
]);

// A redirect that writes somewhere real. `2>/dev/null` discards output and is not a write, and
// the lookarounds keep `>=`, `=>`, and `->` from reading as redirects at all. Getting this wrong
// is not cosmetic: a bare `/>/` test made every command carrying `2>/dev/null` look like a write.
const FILE_REDIRECT = /(?<![-=>])>{1,2}(?![=>])\s*([^\s|;&<>]+)/g;
const NULL_SINKS = new Set(['/dev/null', 'nul', '$null']);

export function hasFileRedirect(normalized) {
  for (const match of normalized.matchAll(FILE_REDIRECT)) {
    if (!NULL_SINKS.has(match[1])) {
      return true;
    }
  }

  return false;
}

/**
 * Whether a shell command plausibly modifies the filesystem.
 *
 * Conservative by design — a read misclassified as a write blocks or nags on
 * `ls`, `cat`, and `grep`, which is the failure this guard exists to avoid.
 */
export function isLikelyWriteCommand(command) {
  const normalized = normalizeText(command);

  return (
    hasFileRedirect(normalized) ||
    /\btee\b/.test(normalized) ||
    /\b(?:cp|mv|rm|touch|truncate)\b/.test(normalized) ||
    /\bgit\s+(?:restore|checkout|reset)\b/.test(normalized) ||
    /\bsed\b[^\n]*\s-i\b/.test(normalized) ||
    /\bperl\b[^\n]*\s-i\b/.test(normalized) ||
    /\b(?:out-file|set-content|add-content|new-item|remove-item)\b/.test(
      normalized,
    )
  );
}

/**
 * Remove heredoc bodies from a shell command, keeping the header line.
 *
 * The path guards match protected paths against shell command text. A heredoc
 * body is *content* being written, not a destination being written to, so
 * scanning it repeats the mistake `WRITE_PATH_KEYS` exists to avoid: a commit
 * message, PR body, or doc that merely mentions a generated directory gets
 * blocked as though it edited that directory. That fired on a real session —
 * writing a commit message that cited a generated spec path.
 *
 * The header line survives, so a genuine write to a protected path is still
 * caught: the redirect target sits on the header, never in the body.
 *
 * Handles `<<EOF`, `<<-EOF`, and quoted `<<'EOF'` / `<<"EOF"`. Herestrings
 * (`<<<`) carry no body and are left alone.
 */
export function stripHeredocBodies(command) {
  const lines = command.split(/\r?\n/);
  const output = [];
  const pending = [];
  let active = null;

  for (const line of lines) {
    if (active) {
      // `<<-` allows an indented terminator; plain `<<` requires column zero.
      const candidate = active.stripIndent ? line.trimStart() : line;
      if (candidate === active.delimiter) {
        active = pending.shift() ?? null;
      }

      continue;
    }

    output.push(line);

    // One line may open several heredocs (`cmd <<A <<B`); they close in order.
    for (const match of line.matchAll(
      /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/g,
    )) {
      pending.push({ delimiter: match[3], stripIndent: match[1] === '-' });
    }

    active = pending.shift() ?? null;
  }

  return output.join('\n');
}

export function extractCommand(toolInput) {
  if (typeof toolInput === 'string') {
    return toolInput;
  }

  if (!toolInput || typeof toolInput !== 'object') {
    return '';
  }

  for (const key of COMMAND_KEYS) {
    const value = toolInput[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return '';
}

/**
 * Collect only the strings that name a write destination: shell commands that
 * look like writes, and values under `WRITE_PATH_KEYS`. Unlike `collectStrings`
 * this never returns file content.
 */
export function collectWriteTargets(node, key = '', output = []) {
  if (node === null || node === undefined) {
    return output;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectWriteTargets(item, key, output);
    }

    return output;
  }

  if (typeof node === 'object') {
    for (const [childKey, childValue] of Object.entries(node)) {
      collectWriteTargets(childValue, childKey, output);
    }

    return output;
  }

  if (typeof node !== 'string') {
    return output;
  }

  if (COMMAND_KEYS.has(key)) {
    if (isLikelyWriteCommand(node)) {
      output.push(node);
    }

    return output;
  }

  if (WRITE_PATH_KEYS.has(key)) {
    output.push(node);
  }

  return output;
}

export function getToolName(payload) {
  const value =
    payload?.toolName ??
    payload?.tool_name ??
    payload?.tool ??
    payload?.name ??
    '';

  return typeof value === 'string' ? value.toLowerCase() : '';
}

export function getToolInput(payload) {
  const raw =
    payload?.toolArgs ??
    payload?.tool_args ??
    payload?.toolInput ??
    payload?.tool_input ??
    payload?.input ??
    payload?.args ??
    payload?.arguments ??
    null;

  if (typeof raw !== 'string') {
    return raw;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return raw;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

export function collectStrings(node, output = []) {
  if (node === null || node === undefined) {
    return output;
  }

  if (typeof node === 'string') {
    output.push(node);
    return output;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectStrings(item, output);
    }

    return output;
  }

  if (typeof node === 'object') {
    for (const value of Object.values(node)) {
      collectStrings(value, output);
    }
  }

  return output;
}

export function readStdin() {
  return new Promise((resolve) => {
    let rawInput = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      rawInput += chunk;
    });
    process.stdin.on('end', () => {
      resolve(rawInput);
    });
  });
}

/**
 * Parse hook stdin. On empty/invalid input, allow and exit (fail-open).
 * Never exit non-zero on parse errors — that fail-closes Copilot preToolUse
 * and can trip Cursor failClosed when stdout is empty.
 */
export async function readPayloadOrExit() {
  const rawInput = await readStdin();

  if (!rawInput.trim()) {
    allowTool();
  }

  try {
    return JSON.parse(rawInput);
  } catch (error) {
    console.error('[agent-hooks] Unable to parse hook payload.');
    console.error(error instanceof Error ? error.message : String(error));
    allowTool();
  }
}

export function isMutatingTool(toolName) {
  return Boolean(toolName) && MUTATING_TOOL_NAMES.has(toolName);
}

/**
 * Explicit allow for preToolUse. Required if Cursor `failClosed: true` is set —
 * empty stdout is treated as hook failure and blocks the tool.
 */
export function allowTool() {
  process.stdout.write(
    JSON.stringify({
      permissionDecision: 'allow',
      permission: 'allow',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
      },
    }),
  );
  process.exit(0);
}

/**
 * Deny a tool call in a format accepted by Copilot, VS Code, Cursor, and Claude.
 * Exit 2 is the portable "block" signal across Cursor and Claude; Copilot
 * preToolUse also treats exit 2 as deny.
 */
export function denyTool(reason) {
  process.stdout.write(
    JSON.stringify({
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
      permission: 'deny',
      user_message: reason,
      agent_message: reason,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(2);
}

/**
 * Inject follow-up context after a tool completes.
 */
export function emitAdditionalContext(message) {
  process.stdout.write(
    JSON.stringify({
      additionalContext: message,
      additional_context: message,
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: message,
      },
    }),
  );
  process.exit(0);
}
