import Database from 'better-sqlite3';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeTask,
  createTask,
  getActiveTaskForProject,
  initializeDatabase,
  listRecentTasks,
  upsertSessionRecords,
} from '../database/db.js';
import {
  buildDuplicateActiveTaskMessage,
  buildNoActiveTaskMessage,
  buildTaskReportLines,
  buildTaskStartOutput,
  buildTaskStopOutput,
  summarizeTaskWindow,
} from '../commands/task.js';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  initializeDatabase(db);
  return db;
}

test('task start creates active task', () => {
  const db = createTestDb();
  const task = createTask(db, {
    name: 'Ship report command',
    projectPath: 'd:\\agent-roi',
    startedAt: '2026-06-15T01:00:00.000Z',
  });

  const activeTask = getActiveTaskForProject(db, 'd:\\agent-roi');
  assert.ok(activeTask);
  assert.equal(activeTask?.status, 'active');
  assert.match(buildTaskStartOutput(task), /Task Started/);
  assert.match(buildTaskStartOutput(task), /Status: active/);

  db.close();
});

test('duplicate active task is rejected', () => {
  const db = createTestDb();
  createTask(db, {
    name: 'First task',
    projectPath: 'd:\\agent-roi',
    startedAt: '2026-06-15T01:00:00.000Z',
  });

  assert.throws(
    () =>
      createTask(db, {
        name: 'Second task',
        projectPath: 'd:\\agent-roi',
        startedAt: '2026-06-15T01:05:00.000Z',
      }),
    /UNIQUE constraint failed/,
  );
  assert.match(buildDuplicateActiveTaskMessage('First task'), /Run "agent-roi task stop" before starting a new task\./);

  db.close();
});

test('task stop completes active task', () => {
  const db = createTestDb();
  const task = createTask(db, {
    name: 'Implement task attribution',
    projectPath: 'd:\\agent-roi',
    startedAt: '2026-06-15T01:00:00.000Z',
  });

  upsertSessionRecords(db, [
    {
      source: 'codex',
      sessionId: 'codex-1',
      projectPath: 'd:\\agent-roi',
      model: 'gpt-5.4',
      startedAt: '2026-06-15T01:10:00.000Z',
      inputTokens: 1000,
      cachedInputTokens: 0,
      outputTokens: 500,
      reasoningOutputTokens: 0,
      totalTokens: 1500,
      costUsd: 1.25,
      costSource: 'estimated',
      rawPath: 'codex-1.jsonl',
    },
  ]);

  const completedTask = completeTask(db, task.id, '2026-06-15T02:00:00.000Z');
  const summary = summarizeTaskWindow(db, completedTask);
  const output = buildTaskStopOutput(completedTask, summary);

  assert.equal(completedTask.status, 'completed');
  assert.equal(completedTask.endedAt, '2026-06-15T02:00:00.000Z');
  assert.match(output, /Task Summary/);
  assert.match(output, /Tokens: 1,500/);
  assert.match(output, /Cost Source: Codex estimated/);

  db.close();
});

test('task stop with no active task shows friendly message', () => {
  assert.match(buildNoActiveTaskMessage(), /No active task found for this project\./);
});

test('task report shows recent completed tasks', () => {
  const db = createTestDb();
  const firstTask = createTask(db, {
    name: 'Older task',
    projectPath: 'd:\\agent-roi',
    startedAt: '2026-06-15T00:00:00.000Z',
  });
  completeTask(db, firstTask.id, '2026-06-15T00:30:00.000Z');
  const secondTask = createTask(db, {
    name: 'Newer task',
    projectPath: 'd:\\agent-roi-2',
    startedAt: '2026-06-15T01:00:00.000Z',
  });
  completeTask(db, secondTask.id, '2026-06-15T01:45:00.000Z');

  const tasks = listRecentTasks(db, 10);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0]?.name, 'Newer task');

  const lines = buildTaskReportLines(tasks[0]!, {
    aiCostUsd: 2,
    totalTokens: 4000,
    hasUnknownCost: false,
    gitMetrics: {
      projectPath: 'd:\\agent-roi-2',
      projectName: 'agent-roi-2',
      commitCount: 2,
      filesChanged: 3,
      linesAdded: 200,
      linesRemoved: 50,
    },
  });

  assert.match(lines.join('\n'), /Newer task/);
  assert.match(lines.join('\n'), /Cost Per Commit: \$1\.00/);

  db.close();
});

test('task with no AI data shows No matched AI data', () => {
  const output = buildTaskStopOutput(
    {
      id: 1,
      name: 'No AI task',
      projectPath: 'd:\\agent-roi',
      startedAt: '2026-06-15T01:00:00.000Z',
      endedAt: '2026-06-15T01:30:00.000Z',
      status: 'completed',
      createdAt: '2026-06-15T01:00:00.000Z',
      updatedAt: '2026-06-15T01:30:00.000Z',
    },
    {
      aiCostUsd: 0,
      totalTokens: 0,
      hasUnknownCost: false,
      gitMetrics: {
        projectPath: 'd:\\agent-roi',
        projectName: 'agent-roi',
        commitCount: 0,
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
      },
    },
  );

  assert.match(output, /No matched AI data/);
});

test('task with no commits does not crash', () => {
  const lines = buildTaskReportLines(
    {
      id: 1,
      name: 'Docs only',
      projectPath: 'd:\\agent-roi',
      startedAt: '2026-06-15T01:00:00.000Z',
      endedAt: '2026-06-15T02:00:00.000Z',
      status: 'completed',
      createdAt: '2026-06-15T01:00:00.000Z',
      updatedAt: '2026-06-15T02:00:00.000Z',
    },
    {
      aiCostUsd: 3,
      totalTokens: 6000,
      hasUnknownCost: false,
      gitMetrics: {
        projectPath: 'd:\\agent-roi',
        projectName: 'agent-roi',
        commitCount: 0,
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
      },
    },
  );

  assert.match(lines.join('\n'), /Cost Per Commit: N\/A/);
  assert.match(lines.join('\n'), /Cost Per 1000 LOC: N\/A/);
});
