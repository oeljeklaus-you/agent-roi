import Database from 'better-sqlite3';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabase } from '../database/db.js';
import { parseCodexSessionContent } from '../parsers/codex.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  initializeDatabase(db);
  return db;
}

test('Codex JSONL parses into a normalized session record', () => {
  const db = createTestDb();
  const content = [
    JSON.stringify({
      timestamp: '2026-06-15T04:36:20.624Z',
      type: 'session_meta',
      payload: {
        id: 'session-1',
        timestamp: '2026-06-15T04:36:20.286Z',
        cwd: 'D:\\agent-roi',
      },
    }),
    JSON.stringify({
      timestamp: '2026-06-15T04:37:30.221Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: 1000000,
            cached_input_tokens: 1000000,
            output_tokens: 1000000,
            reasoning_output_tokens: 0,
            total_tokens: 3000000,
          },
        },
      },
    }),
  ].join('\n');

  const record = parseCodexSessionContent(
    db,
    'C:\\Users\\test\\.codex\\sessions\\rollout-foo-session-1.jsonl',
    content,
    new Map([
      [
        'session-1',
        {
          model: 'gpt-5.4',
          cwd: 'd:\\agent-roi',
          createdAt: '2026-06-15T04:36:20.286Z',
        },
      ],
    ]),
  );

  assert.ok(record);
  assert.equal(record.source, 'codex');
  assert.equal(record.sessionId, 'session-1');
  assert.equal(record.projectPath, 'd:\\agent-roi');
  assert.equal(record.costSource, 'estimated');
  assert.equal(record.costUsd, 17.75);
  assert.equal(record.totalTokens, 3000000);

  db.close();
});

test('Codex JSONL with missing token usage returns null instead of crashing', () => {
  const db = createTestDb();
  const content = JSON.stringify({
    timestamp: '2026-06-15T04:36:20.624Z',
    type: 'session_meta',
    payload: {
      id: 'session-2',
      timestamp: '2026-06-15T04:36:20.286Z',
      cwd: 'D:\\agent-roi',
    },
  });

  const record = parseCodexSessionContent(db, 'test.jsonl', content, new Map());
  assert.equal(record, null);

  db.close();
});

test('Codex unknown model produces unknown_model cost source', () => {
  const db = createTestDb();
  const content = [
    JSON.stringify({
      timestamp: '2026-06-15T04:36:20.624Z',
      type: 'session_meta',
      payload: {
        id: 'session-3',
        timestamp: '2026-06-15T04:36:20.286Z',
        cwd: 'D:\\agent-roi',
      },
    }),
    JSON.stringify({
      timestamp: '2026-06-15T04:37:30.221Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: 1000,
            cached_input_tokens: 0,
            output_tokens: 1000,
            reasoning_output_tokens: 0,
            total_tokens: 2000,
          },
        },
      },
    }),
  ].join('\n');

  const record = parseCodexSessionContent(
    db,
    'test.jsonl',
    content,
    new Map([
      [
        'session-3',
        {
          model: 'unknown-model',
          cwd: 'd:\\agent-roi',
          createdAt: '2026-06-15T04:36:20.286Z',
        },
      ],
    ]),
  );

  assert.ok(record);
  assert.equal(record.costSource, 'unknown_model');
  assert.equal(record.costUsd, null);

  db.close();
});
