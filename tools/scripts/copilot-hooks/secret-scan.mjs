import process from 'node:process';

const MUTATING_TOOL_NAMES = new Set([
  'apply_patch',
  'applypatch',
  'bash',
  'command',
  'delete',
  'execute',
  'edit',
  'move',
  'patch',
  'run',
  'replace',
  'rename',
  'multiedit',
  'multi_edit',
  'shell',
  'write',
]);

const SECRET_PATTERNS = [
  {
    pattern: /-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----/i,
    reason:
      'Private key material was detected in the tool input. Keep private keys out of the repository and use a secret manager instead.',
  },
  {
    pattern: /\b(?:ghp|github_pat|gho|ghu|ghs)_[A-Za-z0-9_]{20,}\b/i,
    reason:
      'A GitHub token-like secret was detected in the tool input. Remove it and store it outside the repository.',
  },
  {
    pattern:
      /\b(?:sk-[A-Za-z0-9]{20,}|sk_(?:live|test)_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{35}|ya29\.[A-Za-z0-9\-_]+|xox[baprs]-[A-Za-z0-9-]{10,})\b/i,
    reason:
      'A secret-looking credential was detected in the tool input. Remove it and keep it in a secret manager or local env file instead.',
  },
  {
    pattern:
      /\b[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\b/,
    reason:
      'A JWT-like token was detected in the tool input. Remove it and avoid pasting credentials into the repository.',
  },
  {
    pattern:
      /(?:client[_-]?secret|refresh[_-]?token|access[_-]?token|api[_-]?key|password|passphrase)\s*[:=]\s*['"`][^'"`\n]{16,}['"`]/i,
    reason:
      'A literal credential-like value was detected in the tool input. Remove it and keep secrets out of source files and prompts.',
  },
];

function getToolName(payload) {
  const value =
    payload?.toolName ??
    payload?.tool_name ??
    payload?.tool ??
    payload?.name ??
    '';

  return typeof value === 'string' ? value.toLowerCase() : '';
}

function getToolInput(payload) {
  return (
    payload?.toolArgs ??
    payload?.tool_args ??
    payload?.toolInput ??
    payload?.tool_input ??
    payload?.input ??
    payload?.args ??
    payload?.arguments ??
    null
  );
}

function collectStrings(node, output = []) {
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

function getSecretReason(strings) {
  for (const text of strings) {
    for (const secretPattern of SECRET_PATTERNS) {
      if (secretPattern.pattern.test(text)) {
        return secretPattern.reason;
      }
    }
  }

  return null;
}

function main() {
  let rawInput = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    rawInput += chunk;
  });

  process.stdin.on('end', () => {
    if (!rawInput.trim()) {
      process.exit(0);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawInput);
    } catch (error) {
      console.error('[copilot-hooks] Unable to parse preToolUse payload.');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
      return;
    }

    const toolName = getToolName(payload);
    if (!MUTATING_TOOL_NAMES.has(toolName)) {
      process.exit(0);
      return;
    }

    const secretReason = getSecretReason(collectStrings(getToolInput(payload)));
    if (!secretReason) {
      process.exit(0);
      return;
    }

    process.stdout.write(
      JSON.stringify({
        permissionDecision: 'deny',
        permissionDecisionReason: secretReason,
      }),
    );
  });
}

main();
