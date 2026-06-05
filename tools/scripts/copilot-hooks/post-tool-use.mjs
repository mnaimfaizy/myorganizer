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

const CONTRACT_TARGETS = [
  {
    pattern: /(^|[^a-z0-9])apps\/backend\/src\/controllers(?:\/|$)/i,
    additionalContext:
      'You changed backend contract sources.\n- Run `yarn openapi:sync`\n- Run `yarn api:generate`\n- Run the relevant backend tests',
  },
  {
    pattern: /(^|[^a-z0-9])apps\/backend\/src\/prisma\/schema(?:\/|$)/i,
    additionalContext:
      'You changed Prisma schema files.\n- Run `yarn nx run backend:generate-types`\n- Run `yarn nx run backend:migrate`\n- Run the relevant backend tests',
  },
];

function normalizeText(value) {
  return value.replace(/\\/g, '/').toLowerCase();
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

function getAdditionalContext(strings) {
  const matches = new Set();

  for (const text of strings) {
    const normalized = normalizeText(text);

    for (const target of CONTRACT_TARGETS) {
      if (target.pattern.test(normalized)) {
        matches.add(target.additionalContext);
      }
    }
  }

  if (matches.size === 0) {
    return null;
  }

  return Array.from(matches).join('\n\n');
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
      console.error('[copilot-hooks] Unable to parse postToolUse payload.');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
      return;
    }

    const toolName = getToolName(payload);
    if (!MUTATING_TOOL_NAMES.has(toolName)) {
      process.exit(0);
      return;
    }

    const additionalContext = getAdditionalContext(
      collectStrings(getToolInput(payload)),
    );

    if (!additionalContext) {
      process.exit(0);
      return;
    }

    process.stdout.write(JSON.stringify({ additionalContext }));
  });
}

main();
