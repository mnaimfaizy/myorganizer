/**
 * Pure parsing/formatting for `--trace-subagents`.
 *
 * Sandcastle 0.12.0's Claude Code provider captures every sub-agent transcript to the
 * host automatically, unconditionally, as part of ordinary session capture — see
 * `captureToHost` in `@ai-hero/sandcastle`, which enumerates
 * `<sessionId>/subagents/agent-*.jsonl` inside the sandbox and copies each file to
 * `<hostProjectsDir>/<encodedCwd>/<sessionId>/subagents/` on the host, verbatim.
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

  return {
    agentId: agentId ?? 'unknown',
    agentType,
    skill,
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
    lines.push(`- Turns: ${summary.turnCount}`);
    lines.push(`- Peak context: ${summary.peakContextTokens} tokens`);
    lines.push(
      `- Token usage (summed per-turn snapshots, not a single total): ` +
        `input ${summary.usage.inputTokens}, ` +
        `cache-write ${summary.usage.cacheCreationInputTokens}, ` +
        `cache-read ${summary.usage.cacheReadInputTokens}, ` +
        `output ${summary.usage.outputTokens}`,
    );
    lines.push(
      summary.toolCalls.length === 0
        ? '- Tool calls: none'
        : `- Tool calls: ${summary.toolCalls.map((t) => `${t.name} (${t.count})`).join(', ')}`,
    );
    lines.push('');
  }

  return lines.join('\n');
}
