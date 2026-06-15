import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClaudeLatestSnapshotsFromPaths } from '../parsers/claude.js';

test('Claude latest snapshot parses successfully', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-roi-claude-'));
  const sessionsDir = path.join(rootDir, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const snapshotPath = path.join(rootDir, '.claude.json');
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify({
      projects: {
        'D:\\agent-roi': {
          lastSessionId: 'claude-session-1',
          lastCost: 3.14,
          lastTotalInputTokens: 100,
          lastTotalOutputTokens: 200,
          lastTotalCacheCreationInputTokens: 300,
          lastTotalCacheReadInputTokens: 400,
          lastModelUsage: {
            'claude-sonnet-4-6': {},
          },
        },
      },
    }),
  );

  fs.writeFileSync(
    path.join(sessionsDir, '1.json'),
    JSON.stringify({
      sessionId: 'claude-session-1',
      cwd: 'D:\\agent-roi',
      startedAt: 1781337590042,
    }),
  );

  const records = parseClaudeLatestSnapshotsFromPaths(snapshotPath, sessionsDir, '2026-06-15T00:00:00.000Z');

  assert.equal(records.length, 1);
  assert.equal(records[0]?.source, 'claude');
  assert.equal(records[0]?.sessionId, 'claude-session-1');
  assert.equal(records[0]?.projectPath, 'd:\\agent-roi');
  assert.equal(records[0]?.totalTokens, 1000);
  assert.equal(records[0]?.costSource, 'reported_snapshot');
  assert.equal(records[0]?.model, 'claude-sonnet-4-6');

  fs.rmSync(rootDir, { recursive: true, force: true });
});

test('Claude missing snapshot file returns empty records', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-roi-claude-missing-'));
  const records = parseClaudeLatestSnapshotsFromPaths(
    path.join(rootDir, '.claude.json'),
    path.join(rootDir, 'sessions'),
    '2026-06-15T00:00:00.000Z',
  );

  assert.deepEqual(records, []);

  fs.rmSync(rootDir, { recursive: true, force: true });
});
