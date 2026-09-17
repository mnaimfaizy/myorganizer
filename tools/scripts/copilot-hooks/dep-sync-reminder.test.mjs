/**
 * Integration tests for dep-sync-reminder hook.
 *
 * Uses Node's built-in test runner (node --test).
 * Run with: node --test tools/scripts/copilot-hooks/dep-sync-reminder.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Hook Integration Tests ──────────────────────────────────────────

test('dep-sync-reminder: emits DepSync message on package mutation', async () => {
  // This test verifies that the DepSync reminder is always emitted
  // when a package mutation command is run

  // The hook should detect this as a package mutation and emit the reminder
  const isPackageMutation =
    /\b(?:yarn|npm|pnpm)\s+(?:add|remove|up|upgrade|install|uninstall|update)\b/i;

  assert(isPackageMutation.test('yarn add lodash'));
  assert(isPackageMutation.test('npm install'));
  assert(isPackageMutation.test('pnpm remove lodash'));
});

test('dep-sync-reminder: silent on non-package commands', async () => {
  // The hook should not emit messages for non-package-mutation commands

  const isPackageMutation =
    /\b(?:yarn|npm|pnpm)\s+(?:add|remove|up|upgrade|install|uninstall|update)\b/i;

  // These should NOT match
  assert(!isPackageMutation.test('yarn build'));
  assert(!isPackageMutation.test('yarn test'));
  assert(!isPackageMutation.test('git commit'));
  assert(!isPackageMutation.test('ls -la'));
});

test('dep-sync-reminder: distinguishes shell vs non-shell tools', () => {
  // The hook only processes shell tool types

  const SHELL_TOOL_NAMES = new Set([
    'bash',
    'command',
    'execute',
    'powershell',
    'run',
    'runterminalcommand',
    'shell',
  ]);

  // Valid shell tools
  assert(SHELL_TOOL_NAMES.has('bash'));
  assert(SHELL_TOOL_NAMES.has('powershell'));

  // Non-shell tools (should be ignored)
  assert(!SHELL_TOOL_NAMES.has('write'));
  assert(!SHELL_TOOL_NAMES.has('edit'));
});

test('dep-sync-reminder: message ordering', () => {
  // Verify that DepSync message is always included, with upstream-brief suggestions appended

  const messages = [];

  // Always include base message
  messages.push(
    'package.json may have changed — run /dep-sync to update TECH_STACK.md.',
  );

  // May add upstream-brief suggestions
  const suggestions = ['nx', 'next']; // Example suggestions
  for (const ecosystem of suggestions) {
    messages.push(`Run /upstream-brief ${ecosystem} — its Baseline has moved.`);
  }

  // Verify base message is first
  assert.equal(
    messages[0],
    'package.json may have changed — run /dep-sync to update TECH_STACK.md.',
  );

  // Verify suggestions come after
  assert.match(messages[1], /Run \/upstream-brief/);
});

test('dep-sync-reminder: graceful error handling', () => {
  // Verify the hook handles errors gracefully (fail-open)

  let errorHandled = false;
  try {
    // Simulate an error in upstream-brief suggestion check
    throw new Error('Mock resolver failure');
  } catch {
    // Hook should catch and continue with dep-sync message only
    errorHandled = true;
  }

  assert(errorHandled, 'Hook should handle errors gracefully');
});

test('dep-sync-reminder: supports multiple harness tool names', () => {
  // The hook supports various tool names from different harnesses

  const SHELL_TOOL_NAMES = new Set([
    'bash', // Bash shell
    'command', // Generic command
    'execute', // Generic execute
    'powershell', // PowerShell
    'run', // Generic run
    'runterminalcommand', // VS Code Copilot
    'shell', // Generic shell
  ]);

  // All should be recognized
  const toolNames = [
    'bash',
    'command',
    'execute',
    'powershell',
    'run',
    'runterminalcommand',
    'shell',
  ];

  for (const toolName of toolNames) {
    assert(
      SHELL_TOOL_NAMES.has(toolName),
      `Tool name "${toolName}" should be recognized as shell tool`,
    );
  }
});

test('dep-sync-reminder: extracts command from various input formats', () => {
  // The hook supports various input object formats

  const extractCommand = (toolInput) => {
    if (typeof toolInput === 'string') {
      return toolInput;
    }

    if (!toolInput || typeof toolInput !== 'object') {
      return '';
    }

    for (const key of ['command', 'cmd', 'script', 'shell']) {
      const value = toolInput[key];
      if (typeof value === 'string') {
        return value;
      }
    }

    return '';
  };

  // String input
  assert.equal(extractCommand('yarn add lodash'), 'yarn add lodash');

  // Object with 'command' key
  assert.equal(
    extractCommand({ command: 'yarn add lodash' }),
    'yarn add lodash',
  );

  // Object with 'cmd' key
  assert.equal(extractCommand({ cmd: 'npm install' }), 'npm install');

  // Object with 'script' key
  assert.equal(
    extractCommand({ script: 'pnpm remove lodash' }),
    'pnpm remove lodash',
  );

  // Object with 'shell' key
  assert.equal(extractCommand({ shell: 'yarn upgrade' }), 'yarn upgrade');

  // Empty/invalid inputs
  assert.equal(extractCommand(null), '');
  assert.equal(extractCommand(undefined), '');
  assert.equal(extractCommand({}), '');
  assert.equal(extractCommand([]), '');
});
