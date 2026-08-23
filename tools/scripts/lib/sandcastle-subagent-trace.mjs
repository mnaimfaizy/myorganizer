/**
 * Pure parsing/formatting for `--trace-subagents`.
 *
 * Sandcastle 0.12.0's Claude Code provider captures every sub-agent transcript to the
 * host automatically, unconditionally, as part of ordinary session capture — see
 * `captureToHost` in `@ai-hero/sandcastle`, which enumerates
 * `<sessionId>/subagents/agent-*.jsonl` inside the sandbox and copies each file to
 * `<hostProjectsDir>/<encodedCwd>/<sessionId>/subagents/` on the host. The copy is not
 * byte-for-byte: it goes through `copyClaudeSessionFile` → `transferClaudeSession` →
 * `rewriteSessionCwd`, which rewrites `cwd` (and `session_meta.payload.cwd`) from the
 * sandbox path to the host path on every record. Nothing else in the record changes, and
 * a failed copy is logged to stderr and skipped rather than failing the run — so a missing
 * transcript is possible and is not an error anyone is shown twice.
 * Nothing here reads a stream or infers a boundary the way ADR 0036 rejected: each
 * captured file already IS one sub-agent's isolated transcript, and every assistant
 * turn in it carries `attributionAgent` / `attributionSkill`, set by the harness
 * itself — confirmed by inspecting a real captured transcript (issue #411).
 *
 * Kept pure — no fs, no docker — so it is testable with `node --test` on string
 * fixtures. `.sandcastle/main.mts` owns locating and copying the files this module
 * reads.
 *
 * Run the tests with: yarn sandcastle:subagent-trace:test
 *
 * See docs/adr/0036-sub-agent-work-is-auditable-and-gate-commands-are-derived.md.
 */

/**
 * @typedef {object} SubagentToolCallSummary
 * @property {string} name
 * @property {number} count
 */

/**
 * @typedef {object} SubagentUsageTotals
 * @property {number} inputTokens
 * @property {number} cacheCreationInputTokens
 * @property {number} cacheReadInputTokens
 * @property {number} outputTokens
 */

/**
 * @typedef {object} SubagentSummary
 * @property {string} agentId
 * @property {string|undefined} agentType       From `attributionAgent`. Every real
 *                                               transcript observed carries this on
 *                                               each assistant turn; undefined only
 *                                               for a transcript with no assistant
 *                                               turns at all (e.g. truncated mid-write).
 * @property {string|undefined} skill           From `attributionSkill`.
 * @property {string|undefined} model           From `message.model` on an assistant turn.
 *                                               Sub-agents are routed per-agent, so this
 *                                               is not necessarily the orchestrator's model.
 * @property {string[]} mcpServers              MCP server names derived from `mcp__<server>__<tool>`
 *                                               tool calls, sorted. Empty means no MCP tool was
 *                                               invoked — which may mean the server never started.
 * @property {number} turnCount                 Assistant turns in the transcript.
 * @property {SubagentToolCallSummary[]} toolCalls  Sorted by count, then name.
 * @property {SubagentUsageTotals} usage        Summed across every assistant turn —
 *                                               NOT a true peak; each turn's `usage`
 *                                               is itself a snapshot of that turn only.
 * @property {number} peakContextTokens         The largest single-turn
 *                                               (input + cache-write + cache-read)
 *                                               total observed — a proxy for how close
 *                                               the sub-agent got to a context limit.
 */

/**
 * Render a token count compactly: 1000 -> `1k`, 1_500_000 -> `1.5m`.
 *
 * Token counts here run from tens to millions in the same table — a sub-agent's
 * cache-read was 1702754 on one line and its input 3466 on the next. Raw digits at
 * that spread are unreadable and, worse, hard to compare at a glance, which is the
 * one thing this index exists for.
 *
 * A fraction is shown only below 10 units, so `1.7m` keeps its meaning while `205k`
 * is not padded to a false `204.8k` precision nobody acts on.
 *
 * @param {number} value
 * @returns {string}
 */
export function formatTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  const units = [
    { limit: 1_000_000_000, suffix: 'b' },
    { limit: 1_000_000, suffix: 'm' },
    { limit: 1_000, suffix: 'k' },
  ];

  for (const { limit, suffix } of units) {
    if (abs >= limit) {
      const scaled = abs / limit;
      // One decimal below 10 (1.7m stays meaningful); whole units above it.
      const text =
        scaled < 10
          ? scaled.toFixed(1).replace(/\.0$/, '')
          : String(Math.round(scaled));
      return `${sign}${text}${suffix}`;
    }
  }

  return `${sign}${abs}`;
}

const EMPTY_USAGE = Object.freeze({
  inputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  outputTokens: 0,
});

/**
 * Parse one captured sub-agent session JSONL into a summary. Malformed or empty lines
 * are skipped rather than thrown on — a transcript captured mid-write (the sandbox was
 * killed before the agent finished) should still yield whatever it can, not crash the
 * trace step over a truncated last line.
 *
 * @param {string} jsonl  Raw contents of a captured `agent-<id>.jsonl` file.
 * @returns {SubagentSummary}
 */
export function parseSubagentTranscript(jsonl) {
  let agentId;
  let agentType;
  let skill;
  let model;
  let turnCount = 0;
  let peakContextTokens = 0;
  const toolCallCounts = new Map();
  const usage = { ...EMPTY_USAGE };

  for (const line of jsonl.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (typeof record.agentId === 'string') agentId ??= record.agentId;
    if (record.type !== 'assistant') continue;

    turnCount += 1;
    if (typeof record.attributionAgent === 'string') {
      agentType ??= record.attributionAgent;
    }
    if (typeof record.attributionSkill === 'string') {
      skill ??= record.attributionSkill;
    }
    if (typeof record.message?.model === 'string') {
      model ??= record.message.model;
    }

    const content = record.message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'tool_use' && typeof block.name === 'string') {
          toolCallCounts.set(
            block.name,
            (toolCallCounts.get(block.name) ?? 0) + 1,
          );
        }
      }
    }

    const turnUsage = record.message?.usage;
    if (turnUsage) {
      const input = turnUsage.input_tokens ?? 0;
      const cacheWrite = turnUsage.cache_creation_input_tokens ?? 0;
      const cacheRead = turnUsage.cache_read_input_tokens ?? 0;
      usage.inputTokens += input;
      usage.cacheCreationInputTokens += cacheWrite;
      usage.cacheReadInputTokens += cacheRead;
      usage.outputTokens += turnUsage.output_tokens ?? 0;
      peakContextTokens = Math.max(
        peakContextTokens,
        input + cacheWrite + cacheRead,
      );
    }
  }

  const toolCalls = [...toolCallCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // Claude Code names MCP tools `mcp__<server>__<tool>`, so the server set is derivable
  // from the calls themselves — no separate manifest to read, and no way for the list to
  // claim a server that was configured but never actually reached.
  const mcpServers = [
    ...new Set(
      toolCalls
        .map(({ name }) => /^mcp__([^_]+(?:_[^_]+)*?)__/.exec(name)?.[1])
        .filter((server) => typeof server === 'string'),
    ),
  ].sort();

  return {
    agentId: agentId ?? 'unknown',
    agentType,
    skill,
    model,
    mcpServers,
    turnCount,
    toolCalls,
    usage,
    peakContextTokens,
  };
}

/**
 * Render a per-slice index of every captured sub-agent, in the order given. Markdown
 * so it opens readably next to the raw transcripts without any special tooling.
 *
 * @param {ReadonlyArray<SubagentSummary & { fileName: string }>} summaries
 * @param {object} context
 * @param {number} context.issueNumber
 * @param {string} context.sliceBranch
 * @returns {string}
 */
export function formatSubagentIndex(summaries, { issueNumber, sliceBranch }) {
  const lines = [
    `# Sub-agent trace — #${issueNumber} (${sliceBranch})`,
    '',
    summaries.length === 0
      ? '_No sub-agent invocations were captured for this slice._'
      : `${summaries.length} sub-agent invocation(s) captured.`,
    '',
  ];

  for (const summary of summaries) {
    const label = summary.agentType ?? `agent ${summary.agentId}`;
    lines.push(`## ${label}${summary.skill ? ` — ${summary.skill}` : ''}`);
    lines.push('');
    lines.push(`- Transcript: \`${summary.fileName}\``);
    lines.push(`- Model: ${summary.model ?? 'unknown'}`);
    lines.push(`- Turns: ${summary.turnCount}`);
    lines.push(
      `- Peak context: ${formatTokens(summary.peakContextTokens)} tokens`,
    );
    lines.push(
      `- Token usage (summed per-turn snapshots, not a single total): ` +
        `input ${formatTokens(summary.usage.inputTokens)}, ` +
        `cache-write ${formatTokens(summary.usage.cacheCreationInputTokens)}, ` +
        `cache-read ${formatTokens(summary.usage.cacheReadInputTokens)}, ` +
        `output ${formatTokens(summary.usage.outputTokens)}`,
    );
    lines.push(
      summary.toolCalls.length === 0
        ? '- Tool calls: none'
        : `- Tool calls: ${summary.toolCalls.map((t) => `${t.name} (${t.count})`).join(', ')}`,
    );
    // Stated even when empty. A silent absence reads as "no MCP was needed"; the more
    // common cause is that a configured server never started in the sandbox, and that
    // is only visible if the line is always there.
    lines.push(
      summary.mcpServers.length === 0
        ? '- MCP servers: none invoked'
        : `- MCP servers: ${summary.mcpServers.join(', ')}`,
    );
    lines.push('');
  }

  return lines.join('\n');
}
