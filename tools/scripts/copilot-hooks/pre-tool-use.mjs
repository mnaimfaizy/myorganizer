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

const COMMAND_KEYS = new Set(['cmd', 'command', 'script', 'shell']);
const PATH_KEYS = new Set([
  'dest',
  'destination',
  'dir',
  'directory',
  'file',
  'files',
  'filename',
  'filenames',
  'filepath',
  'filePath',
  'folder',
  'glob',
  'path',
  'paths',
  'pattern',
  'source',
  'sources',
  'target',
  'targets',
]);

const PROTECTED_PATTERNS = [
  {
    pattern: /(^|[^a-z0-9])libs\/app-api-client(?:\/|$)/i,
    reason:
      'Direct edits to the generated API client are blocked. Regenerate it with `yarn api:generate` after syncing the API contract.',
  },
  {
    pattern: /(^|[^a-z0-9])libs\/api-specs(?:\/|$)/i,
    reason:
      'Direct edits to the synced OpenAPI spec are blocked. Update backend controllers/DTOs and run `yarn openapi:sync`.',
  },
  {
    pattern: /(^|[^a-z0-9])apps\/backend\/src\/swagger(?:\/|$)/i,
    reason:
      'Direct edits to generated Swagger output are blocked. Update backend controllers/DTOs and regenerate API docs.',
  },
  {
    pattern: /(^|[^a-z0-9])libs\/design-tokens\/src\/generated(?:\/|$)/i,
    reason:
      'Direct edits to generated design token files are blocked. Edit `libs/design-tokens/src/tokens.json` and rebuild tokens.',
  },
  {
    pattern: /(^|[^a-z0-9])apps\/backend\/src\/prisma\/migrations(?:\/|$)/i,
    reason:
      'Direct edits to Prisma migrations are blocked. Update the schema and use the migration workflow instead.',
  },
  {
    pattern: /(^|[^a-z0-9])(?:\.env(?:\.[^\/]+)?|[^\/]+\.env)(?:$|[^a-z0-9])/i,
    exclude: (normalized) => /\.env\.example(?:$|[^a-z0-9])/.test(normalized),
    reason:
      'Direct edits to environment files are blocked. Keep secrets in local env files or managed secret storage.',
  },
  {
    pattern:
      /(^|[^a-z0-9])(?:\.npmrc|\.yarnrc(?:\.yml)?|credentials|secrets)(?:\/|$)/i,
    reason:
      'Direct edits to secret or credentials files are blocked. Keep secrets out of the repository.',
  },
  {
    pattern: /\.(?:pem|key|p8|p12|pfx|der|crt|cer)$/i,
    reason:
      'Direct edits to key or certificate files are blocked. Keep secret material out of the repository.',
  },
];

function normalizeText(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

function looksLikePath(text) {
  const normalized = normalizeText(text);

  return (
    normalized.includes('/') ||
    normalized.startsWith('.') ||
    /\.[a-z0-9]{1,5}(?:[?*].*)?$/i.test(normalized)
  );
}

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

function isLikelyWriteCommand(command) {
  const normalized = normalizeText(command);

  return (
    />/.test(normalized) ||
    /\btee\b/.test(normalized) ||
    /\b(?:cp|mv|rm|touch|truncate)\b/.test(normalized) ||
    /\bgit\s+(?:restore|checkout|reset)\b/.test(normalized) ||
    /\bsed\b[^\n]*\s-i\b/.test(normalized) ||
    /\bperl\b[^\n]*\s-i\b/.test(normalized)
  );
}

function getProtectedPathReason(text) {
  const normalized = normalizeText(text);

  for (const rule of PROTECTED_PATTERNS) {
    if (typeof rule.exclude === 'function' && rule.exclude(normalized)) {
      continue;
    }

    if (rule.pattern.test(normalized)) {
      return rule.reason;
    }
  }

  return null;
}

function inspectPatchText(text) {
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const match =
      line.match(/^\*\*\*\s+(?:add|update|delete)\s+file:\s+(.+)$/i) ??
      line.match(/^\*\*\*\s+move\s+to:\s+(.+)$/i);

    if (!match) {
      continue;
    }

    const reason = getProtectedPathReason(match[1] ?? match[2] ?? '');
    if (reason) {
      return reason;
    }
  }

  return null;
}

function inspectNode(node, key = '') {
  if (node === null || node === undefined) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const reason = inspectNode(item, key);
      if (reason) {
        return reason;
      }
    }

    return null;
  }

  if (typeof node === 'object') {
    for (const [childKey, childValue] of Object.entries(node)) {
      const reason = inspectNode(childValue, childKey);
      if (reason) {
        return reason;
      }
    }

    return null;
  }

  if (typeof node !== 'string') {
    return null;
  }

  if (COMMAND_KEYS.has(key)) {
    if (!isLikelyWriteCommand(node)) {
      return null;
    }

    return getProtectedPathReason(node);
  }

  if (PATH_KEYS.has(key)) {
    return getProtectedPathReason(node);
  }

  return null;
}

function inspectToolInput(toolName, toolInput) {
  if (!toolName) {
    return null;
  }

  if (
    toolName === 'apply_patch' ||
    toolName === 'applypatch' ||
    toolName === 'patch'
  ) {
    if (typeof toolInput === 'string') {
      return inspectPatchText(toolInput);
    }

    return getProtectedPathReason(JSON.stringify(toolInput ?? {}));
  }

  if (typeof toolInput === 'string') {
    if (toolName === 'bash' || toolName === 'command' || toolName === 'shell') {
      if (!isLikelyWriteCommand(toolInput)) {
        return null;
      }

      return getProtectedPathReason(toolInput);
    }

    if (!looksLikePath(toolInput)) {
      return null;
    }

    return getProtectedPathReason(toolInput);
  }

  return inspectNode(toolInput);
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

    const reason = inspectToolInput(toolName, getToolInput(payload));
    if (!reason) {
      process.exit(0);
      return;
    }

    process.stdout.write(
      JSON.stringify({
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      }),
    );
  });
}

main();
