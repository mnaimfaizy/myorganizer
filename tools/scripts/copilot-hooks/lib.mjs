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
