import {
  emitAdditionalContext,
  getToolInput,
  getToolName,
  readPayloadOrExit,
} from './lib.mjs';
import { getUpstreamBriefSuggestions } from './upstream-brief-suggestion.mjs';

const PACKAGE_MUTATION =
  /\b(?:yarn|npm|pnpm)\s+(?:add|remove|up|upgrade|install|uninstall|update)\b/i;

const SHELL_TOOL_NAMES = new Set([
  'bash',
  'command',
  'execute',
  'powershell',
  'run',
  'runterminalcommand',
  'shell',
]);

function extractCommand(toolInput) {
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
}

async function main() {
  const payload = await readPayloadOrExit();
  const toolName = getToolName(payload);

  if (toolName && !SHELL_TOOL_NAMES.has(toolName)) {
    process.exit(0);
  }

  const command = extractCommand(getToolInput(payload));
  if (!PACKAGE_MUTATION.test(command)) {
    process.exit(0);
  }

  const messages = [
    'package.json may have changed — run /dep-sync to update TECH_STACK.md.',
  ];

  // Check for upstream brief suggestions (ADR 0084 item 14)
  try {
    const suggestions = getUpstreamBriefSuggestions();
    if (suggestions.length > 0) {
      for (const ecosystem of suggestions) {
        messages.push(
          `Run /upstream-brief ${ecosystem} — its Baseline has moved.`,
        );
      }
    }
  } catch {
    // Fail open: if checking fails, just emit the dep-sync message
  }

  emitAdditionalContext(messages.join('\n'));
}

main();
