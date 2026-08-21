/**
 * Run with: yarn sandcastle:subagent-trace:test  (node --test, matching the other libs here)
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSubagentTranscript,
  formatSubagentIndex,
} from './sandcastle-subagent-trace.mjs';

function line(record) {
  return JSON.stringify(record);
}

function assistantTurn({
  agentId = 'abc123',
  attributionAgent,
  attributionSkill,
  content = [],
  usage,
}) {
  return line({
    parentUuid: 'x',
    isSidechain: true,
    agentId,
    type: 'assistant',
    ...(attributionAgent ? { attributionAgent } : {}),
    ...(attributionSkill ? { attributionSkill } : {}),
    message: { role: 'assistant', content, ...(usage ? { usage } : {}) },
  });
}

test('parses agent type, skill, tool calls, and usage from a real-shaped transcript', () => {
  const jsonl = [
    line({
      parentUuid: null,
      isSidechain: true,
      agentId: 'abc123',
      type: 'user',
      message: { role: 'user', content: 'do the thing' },
    }),
    assistantTurn({
      attributionAgent: 'TestReviewer',
      attributionSkill: 'unit-test-delegation-workflow',
      content: [
        { type: 'tool_use', name: 'Read', input: {} },
        { type: 'tool_use', name: 'Bash', input: {} },
      ],
      usage: {
        input_tokens: 10,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 200,
        output_tokens: 50,
      },
    }),
    assistantTurn({
      content: [{ type: 'tool_use', name: 'Bash', input: {} }],
      usage: {
        input_tokens: 5,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 400,
        output_tokens: 20,
      },
    }),
  ].join('\n');

  const summary = parseSubagentTranscript(jsonl);

  assert.equal(summary.agentId, 'abc123');
  assert.equal(summary.agentType, 'TestReviewer');
  assert.equal(summary.skill, 'unit-test-delegation-workflow');
  assert.equal(summary.turnCount, 2);
  assert.deepEqual(summary.toolCalls, [
    { name: 'Bash', count: 2 },
    { name: 'Read', count: 1 },
  ]);
  assert.deepEqual(summary.usage, {
    inputTokens: 15,
    cacheCreationInputTokens: 100,
    cacheReadInputTokens: 600,
    outputTokens: 70,
  });
  // Peak is the largest SINGLE turn's context, not the sum: turn 1 is 10+100+200=310,
  // turn 2 is 5+0+400=405 — the peak is 405, not 715.
  assert.equal(summary.peakContextTokens, 405);
});

test('ignores blank and malformed lines rather than throwing', () => {
  const jsonl = [
    '',
    '   ',
    'not json at all {{{',
    assistantTurn({ attributionAgent: 'ComponentBuilder' }),
  ].join('\n');

  const summary = parseSubagentTranscript(jsonl);

  assert.equal(summary.agentType, 'ComponentBuilder');
  assert.equal(summary.turnCount, 1);
});

test('a transcript truncated before any assistant turn yields an unknown-but-safe summary', () => {
  const jsonl = line({
    parentUuid: null,
    isSidechain: true,
    agentId: 'zzz',
    type: 'user',
    message: { role: 'user', content: 'do the thing' },
  });

  const summary = parseSubagentTranscript(jsonl);

  assert.equal(summary.agentId, 'zzz');
  assert.equal(summary.agentType, undefined);
  assert.equal(summary.turnCount, 0);
  assert.deepEqual(summary.toolCalls, []);
  assert.deepEqual(summary.usage, {
    inputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    outputTokens: 0,
  });
  assert.equal(summary.peakContextTokens, 0);
});

test('an empty file yields the unknown placeholder, not a throw', () => {
  const summary = parseSubagentTranscript('');
  assert.equal(summary.agentId, 'unknown');
  assert.equal(summary.turnCount, 0);
});

test('a turn with tool calls but no usage block does not crash totals', () => {
  const jsonl = assistantTurn({
    attributionAgent: 'Docs',
    content: [{ type: 'tool_use', name: 'Write', input: {} }],
  });

  const summary = parseSubagentTranscript(jsonl);

  assert.equal(summary.turnCount, 1);
  assert.deepEqual(summary.toolCalls, [{ name: 'Write', count: 1 }]);
  assert.deepEqual(summary.usage, {
    inputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    outputTokens: 0,
  });
});

test('formatSubagentIndex reports no invocations without listing anything', () => {
  const rendered = formatSubagentIndex([], {
    issueNumber: 411,
    sliceBranch: 'slice/411-trace-subagents',
  });

  assert.match(
    rendered,
    /# Sub-agent trace — #411 \(slice\/411-trace-subagents\)/,
  );
  assert.match(rendered, /No sub-agent invocations were captured/);
});

test('formatSubagentIndex labels an agent by type when known, and by id when not', () => {
  const summaries = [
    {
      ...parseSubagentTranscript(
        assistantTurn({ attributionAgent: 'TestReviewer' }),
      ),
      fileName: 'agent-aaa.jsonl',
    },
    {
      ...parseSubagentTranscript(''),
      agentId: 'bbb999',
      fileName: 'agent-bbb999.jsonl',
    },
  ];

  const rendered = formatSubagentIndex(summaries, {
    issueNumber: 411,
    sliceBranch: 'slice/411-trace-subagents',
  });

  assert.match(rendered, /## TestReviewer/);
  assert.match(rendered, /## agent bbb999/);
  assert.match(rendered, /`agent-aaa\.jsonl`/);
  assert.match(rendered, /`agent-bbb999\.jsonl`/);
});
