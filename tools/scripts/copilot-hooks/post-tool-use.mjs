import {
  collectStrings,
  emitAdditionalContext,
  getToolInput,
  getToolName,
  isMutatingTool,
  normalizeText,
  readPayloadOrExit,
} from './lib.mjs';

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

async function main() {
  const payload = await readPayloadOrExit();
  const toolName = getToolName(payload);

  if (!isMutatingTool(toolName)) {
    process.exit(0);
  }

  const additionalContext = getAdditionalContext(
    collectStrings(getToolInput(payload)),
  );

  if (!additionalContext) {
    process.exit(0);
  }

  emitAdditionalContext(additionalContext);
}

main();
