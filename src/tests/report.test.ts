import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildReportOutput } from '../commands/report.js';
import { parseGitLogOutput } from '../git/metrics.js';

test('Git log parsing aggregates commits, files, and line counts', () => {
  const logOutput = [
    'commit:abc',
    '10\t2\tsrc/index.ts',
    '-\t-\tbinary.png',
    '',
    'commit:def',
    '5\t1\tREADME.md',
  ].join('\n');

  const metrics = parseGitLogOutput(logOutput, 'D:\\agent-roi');

  assert.equal(metrics.projectName, 'agent-roi');
  assert.equal(metrics.commitCount, 2);
  assert.equal(metrics.filesChanged, 3);
  assert.equal(metrics.linesAdded, 15);
  assert.equal(metrics.linesRemoved, 3);
});

test('Report output shows No matched AI data for repos without matched sessions', () => {
  const output = buildReportOutput(
    {
      projectPath: 'd:\\repo',
      projectName: 'repo',
      commitCount: 1,
      filesChanged: 1,
      linesAdded: 10,
      linesRemoved: 0,
    },
    {
      costUsd: 0,
      totalTokens: 0,
      codexCount: 0,
      claudeCount: 0,
      hasUnknownCost: false,
    },
  );

  assert.match(output, /Cost Quality: No matched AI data/);
  assert.match(output, /No matched AI session or snapshot data/);
});

test('Report output computes cost per commit and cost per 1000 LOC', () => {
  const output = buildReportOutput(
    {
      projectPath: 'd:\\repo',
      projectName: 'repo',
      commitCount: 2,
      filesChanged: 4,
      linesAdded: 90,
      linesRemoved: 10,
    },
    {
      costUsd: 10,
      totalTokens: 4000,
      codexCount: 1,
      claudeCount: 0,
      hasUnknownCost: false,
    },
  );

  assert.match(output, /Cost Per Commit: \$5\.00/);
  assert.match(output, /Cost Per 1000 LOC: \$100\.00/);
  assert.match(output, /Tokens Per Commit: 2,000/);
});

test('Non-Git repo report prints a friendly message', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-roi-non-git-'));
  const testFilePath = fileURLToPath(import.meta.url);
  const distIndexPath = path.resolve(path.dirname(testFilePath), '..', 'index.js');

  let stderr = '';

  try {
    execFileSync('node', [distIndexPath, 'report'], {
      cwd: tempDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.fail('Expected report to fail outside a Git repository');
  } catch (error) {
    stderr = error instanceof Error && 'stderr' in error ? String(error.stderr ?? '') : '';
  }

  assert.match(stderr, /agent-roi report must be run inside a Git repository\./);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
