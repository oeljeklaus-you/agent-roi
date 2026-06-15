import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTodayOutput } from '../commands/today.js';

test('Today output explains its capture scope', () => {
  const output = buildTodayOutput({
    codexSessions: 1,
    codexTokens: 100,
    codexCostUsd: 1,
    claudeSnapshots: 1,
    claudeTokens: 200,
    claudeCostUsd: 2,
    totalTokens: 300,
    totalCostUsd: 3,
  });

  assert.match(output, /Scope: Codex sessions started today plus Claude latest snapshots captured today\./);
  assert.match(output, /This is not an official billing-day view\./);
});
