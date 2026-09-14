/**
 * Sub-agent tool grants, derived from canonical roles.
 *
 * Canonical bodies (.github/agents/*.agent.md) declare capabilities by role —
 * `tools: [read, search, execute]`. tools/config/agent-tool-map.json translates
 * each role into a harness's grant. This module is the translation and nothing
 * else: it never reads the filesystem, so sync-subagents.mjs owns I/O and the
 * rules here stay testable. See ADR 0081.
 *
 * A grant is one of two shapes, chosen by the harness's `grant` key in the map:
 *   { tools: string[] }     Claude Code, Gemini CLI — an allowlist
 *   { readonly: boolean }   Cursor — it has no per-agent tool list
 *
 * Every gap is a hard error. A role that silently renders to nothing would
 * under-grant an agent with no signal, which is the defect this replaces.
 */

/**
 * Label used when a file had no grant at all. Claude Code and Gemini CLI both
 * give an agent without a `tools` key every tool, so writing one narrows.
 */
export const INHERIT_ALL = '<inherited: all tools>';

/**
 * How each harness writes a grant in its frontmatter. This is a file-format
 * fact about the harness, not policy; validateToolMap asserts the map's
 * `grant` key agrees with it.
 */
const FRONTMATTER_FORMAT = {
  claude: { grant: 'tools', style: 'inline' },
  gemini: { grant: 'tools', style: 'block' },
  cursor: { grant: 'readonly' },
};

function formatFor(harness) {
  const format = FRONTMATTER_FORMAT[harness];
  if (!format) {
    throw new Error(`No frontmatter grant format for harness "${harness}"`);
  }
  return format;
}

// `tools: [a, 'b', "c"]` → ['a', 'b', 'c'], or null when there is no inline list.
function parseInlineTools(frontmatter) {
  const match = frontmatter.match(/^tools:[ \t]*\[(.*)\][ \t]*$/m);
  if (!match) return null;
  return match[1]
    .split(',')
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

export function parseCanonicalRoles(frontmatter, slug) {
  const roles = parseInlineTools(frontmatter);
  if (!roles) {
    throw new Error(
      `Canonical agent "${slug}" has no inline tools: [...] role list. Roles are required; see tools/config/agent-tool-map.json.`,
    );
  }
  return roles;
}

export function validateToolMap(map) {
  const vocabulary = Object.keys(map.roles ?? {});
  if (!vocabulary.length) {
    throw new Error('agent-tool-map: `roles` vocabulary is empty');
  }

  for (const [harness, cfg] of Object.entries(map.harnesses ?? {})) {
    const format = FRONTMATTER_FORMAT[harness];
    if (!format || format.grant !== cfg.grant) {
      throw new Error(
        `agent-tool-map: harness "${harness}" declares grant "${cfg.grant}", but its frontmatter format is ${format ? `"${format.grant}"` : 'unknown'}`,
      );
    }
    if (cfg.grant === 'tools') {
      for (const role of vocabulary) {
        const tools = cfg.tools?.[role];
        if (!Array.isArray(tools) || !tools.length) {
          throw new Error(
            `agent-tool-map: harness "${harness}" has no tools for role "${role}". Resolve the cell; do not omit it.`,
          );
        }
      }
      for (const role of Object.keys(cfg.tools ?? {})) {
        if (!vocabulary.includes(role)) {
          throw new Error(
            `agent-tool-map: harness "${harness}" maps role "${role}", which is not in the roles vocabulary`,
          );
        }
      }
    } else {
      for (const role of cfg.writableRoles ?? []) {
        if (!vocabulary.includes(role)) {
          throw new Error(
            `agent-tool-map: harness "${harness}" writableRoles names "${role}", which is not in the roles vocabulary`,
          );
        }
      }
    }
  }

  for (const [slug, byHarness] of Object.entries(map.overrides ?? {})) {
    for (const [harness, override] of Object.entries(byHarness)) {
      const cfg = map.harnesses?.[harness];
      if (!cfg) {
        throw new Error(
          `agent-tool-map: override for "${slug}" names unknown harness "${harness}"`,
        );
      }
      if (typeof override.reason !== 'string' || !override.reason.trim()) {
        throw new Error(
          `agent-tool-map: override for "${slug}" on "${harness}" needs a non-empty reason`,
        );
      }
      const valid =
        cfg.grant === 'tools'
          ? Array.isArray(override.tools) && override.readonly === undefined
          : typeof override.readonly === 'boolean' &&
            override.tools === undefined;
      if (!valid) {
        throw new Error(
          `agent-tool-map: override for "${slug}" on "${harness}" must set ${cfg.grant === 'tools' ? '`tools` (array)' : '`readonly` (boolean)'} and nothing else`,
        );
      }
    }
  }
}

export function renderGrant(roles, harness, slug, map) {
  const vocabulary = Object.keys(map.roles);
  for (const role of roles) {
    if (!vocabulary.includes(role)) {
      throw new Error(
        `Agent "${slug}" declares unknown role "${role}". Known roles: ${vocabulary.join(', ')}`,
      );
    }
  }

  const cfg = map.harnesses[harness];
  if (!cfg) {
    throw new Error(`agent-tool-map has no entry for harness "${harness}"`);
  }

  const override = map.overrides?.[slug]?.[harness];
  if (override) {
    return cfg.grant === 'tools'
      ? { tools: [...override.tools] }
      : { readonly: override.readonly };
  }

  if (cfg.grant === 'readonly') {
    const writable = cfg.writableRoles ?? [];
    return { readonly: !roles.some((role) => writable.includes(role)) };
  }

  // Vocabulary order, not declaration order, so `[read, edit, search]` and
  // `[read, search, edit]` render identically and never read as drift.
  const tools = [];
  for (const role of vocabulary) {
    if (!roles.includes(role)) continue;
    for (const tool of cfg.tools[role]) {
      if (!tools.includes(tool)) tools.push(tool);
    }
  }
  return { tools };
}

export function readGrant(frontmatter, harness) {
  if (formatFor(harness).grant === 'readonly') {
    const match = frontmatter.match(/^readonly:[ \t]*(true|false)[ \t]*$/m);
    return { readonly: match?.[1] === 'true' };
  }

  const inline = parseInlineTools(frontmatter);
  if (inline) {
    return { tools: inline };
  }

  const block = frontmatter.match(/^tools:[ \t]*\n((?:[ \t]+-[^\n]*\n)*)/m);
  if (block) {
    return {
      tools: block[1]
        .split('\n')
        .map((line) =>
          line
            .replace(/^\s*-\s*/, '')
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        )
        .filter(Boolean),
    };
  }

  return null;
}

/**
 * The grant as frontmatter lines, newline-terminated. The one formatter for
 * both new files (buildFrontmatter) and rewrites (writeGrant), so a created
 * file never reads back as drift. A false Cursor readonly renders as nothing.
 */
export function formatGrant(harness, grant) {
  if (formatFor(harness).grant === 'readonly') {
    return grant.readonly ? 'readonly: true\n' : '';
  }
  if (formatFor(harness).style === 'block') {
    return `tools:\n${grant.tools.map((tool) => `  - ${tool}`).join('\n')}\n`;
  }
  return `tools: [${grant.tools.join(', ')}]\n`;
}

/**
 * Returns `frontmatter` with only its grant replaced. Every other key keeps
 * its exact text and position, so a hand-written description or a model pin
 * owned by sync-agent-models.mjs is never touched.
 */
export function writeGrant(frontmatter, harness, grant) {
  if (formatFor(harness).grant === 'readonly') {
    const without = frontmatter.replace(/^readonly:[^\n]*\n/m, '');
    if (!grant.readonly) return without;
    return insertAfterModel(without, formatGrant(harness, grant));
  }

  const formatted = formatGrant(harness, grant);
  const existing =
    frontmatter.match(/^tools:[ \t]*\[.*\][ \t]*\n/m) ??
    frontmatter.match(/^tools:[ \t]*\n(?:[ \t]+-[^\n]*\n)*/m);
  if (existing) {
    return frontmatter.replace(existing[0], formatted);
  }

  // Match what buildFrontmatter emits: Claude puts tools before model,
  // Gemini appends the block after it.
  if (formatFor(harness).style === 'block') {
    return frontmatter.replace(/\n---\n$/, `\n${formatted}---\n`);
  }
  const model = frontmatter.match(/^model:[^\n]*\n/m);
  if (model) {
    return frontmatter.replace(model[0], `${formatted}${model[0]}`);
  }
  return frontmatter.replace(/\n---\n$/, `\n${formatted}---\n`);
}

function insertAfterModel(frontmatter, line) {
  const model = frontmatter.match(/^model:[^\n]*\n/m);
  if (model) {
    return frontmatter.replace(model[0], `${model[0]}${line}`);
  }
  return frontmatter.replace(/\n---\n$/, `\n${line}---\n`);
}

export function grantsEqual(a, b) {
  if (!a || !b) return a === b;
  if ('readonly' in a || 'readonly' in b) return a.readonly === b.readonly;
  return (
    a.tools.length === b.tools.length &&
    a.tools.every((tool, index) => tool === b.tools[index])
  );
}

/**
 * Classifies a grant change so --apply can print capability increases apart
 * from decreases. Cursor's `readonly` is a restriction: gaining it narrows.
 */
export function describeGrantChange(before, after) {
  if ('readonly' in after) {
    const was = before?.readonly ?? false;
    if (was === after.readonly) {
      return { widened: [], narrowed: [], reordered: false };
    }
    return after.readonly
      ? { widened: [], narrowed: ['readonly'], reordered: false }
      : { widened: ['readonly'], narrowed: [], reordered: false };
  }

  if (!before) {
    return { widened: [], narrowed: [INHERIT_ALL], reordered: false };
  }

  const widened = after.tools.filter((tool) => !before.tools.includes(tool));
  const narrowed = before.tools.filter((tool) => !after.tools.includes(tool));
  const reordered =
    !widened.length && !narrowed.length && !grantsEqual(before, after);
  return { widened, narrowed, reordered };
}
