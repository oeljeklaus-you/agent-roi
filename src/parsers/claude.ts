import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { type SessionRecord } from '../database/db.js';
import { getClaudeSessionsDir, getClaudeSnapshotPath, listFilesRecursive, normalizeProjectPath } from '../utils/paths.js';
import { nowIso } from '../utils/time.js';

const claudeSessionSchema = z.object({
  sessionId: z.string(),
  cwd: z.string(),
  startedAt: z.number().int(),
});

const claudeProjectSchema = z
  .object({
    lastSessionId: z.string().optional(),
    lastCost: z.number().optional(),
    lastTotalInputTokens: z.number().optional(),
    lastTotalOutputTokens: z.number().optional(),
    lastTotalCacheCreationInputTokens: z.number().optional(),
    lastTotalCacheReadInputTokens: z.number().optional(),
    lastModelUsage: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const claudeSnapshotSchema = z.object({
  projects: z.record(z.string(), claudeProjectSchema).optional(),
});

type ClaudeSessionLookup = {
  cwd: string;
  startedAt: string;
};

export function parseClaudeLatestSnapshots(): SessionRecord[] {
  return parseClaudeLatestSnapshotsFromPaths(getClaudeSnapshotPath(), getClaudeSessionsDir());
}

export function parseClaudeLatestSnapshotsFromPaths(
  snapshotPath: string,
  sessionsDir: string,
  capturedAt = nowIso(),
): SessionRecord[] {
  if (!fs.existsSync(snapshotPath)) {
    return [];
  }

  let snapshot: z.infer<typeof claudeSnapshotSchema>;
  try {
    const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8');
    const snapshotJson = JSON.parse(snapshotRaw);
    snapshot = claudeSnapshotSchema.parse(snapshotJson);
  } catch (error) {
    throw new Error(`Failed to parse Claude snapshot file: ${snapshotPath}`, {
      cause: error,
    });
  }

  const sessionLookup = loadClaudeSessionLookup(sessionsDir);

  const records: SessionRecord[] = [];
  const projects = snapshot.projects ?? {};

  for (const [projectPath, project] of Object.entries(projects)) {
    const normalizedProjectPath = normalizeProjectPath(projectPath);
    const lastSessionId = project.lastSessionId ?? `claude-snapshot:${normalizedProjectPath}`;
    const linkedSession = project.lastSessionId ? sessionLookup.get(project.lastSessionId) : undefined;
    const startedAt = linkedSession?.startedAt ?? null;

    const inputTokens = project.lastTotalInputTokens ?? 0;
    const outputTokens = project.lastTotalOutputTokens ?? 0;
    const cacheCreationTokens = project.lastTotalCacheCreationInputTokens ?? 0;
    const cacheReadTokens = project.lastTotalCacheReadInputTokens ?? 0;
    const totalTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
    const model = extractPrimaryClaudeModel(project.lastModelUsage);

    records.push({
      source: 'claude',
      sessionId: lastSessionId,
      projectPath: linkedSession?.cwd ? normalizeProjectPath(linkedSession.cwd) : normalizedProjectPath,
      model,
      startedAt,
      inputTokens,
      cachedInputTokens: cacheReadTokens,
      outputTokens,
      reasoningOutputTokens: 0,
      totalTokens,
      costUsd: project.lastCost ?? null,
      costSource: 'reported_snapshot',
      rawPath: snapshotPath,
    });
  }

  return records.map((record) => ({
    ...record,
    startedAt: record.startedAt ?? capturedAt,
  }));
}

export function loadClaudeSessionLookup(sessionsDir = getClaudeSessionsDir()): Map<string, ClaudeSessionLookup> {
  const files = listFilesRecursive(sessionsDir, (filePath) => filePath.endsWith('.json'));
  const map = new Map<string, ClaudeSessionLookup>();

  for (const filePath of files) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = claudeSessionSchema.parse(JSON.parse(raw));
      map.set(parsed.sessionId, {
        cwd: parsed.cwd,
        startedAt: new Date(parsed.startedAt).toISOString(),
      });
    } catch {
      // Ignore malformed local session files.
    }
  }

  return map;
}

function extractPrimaryClaudeModel(lastModelUsage: Record<string, unknown> | undefined): string | null {
  if (!lastModelUsage) {
    return null;
  }

  const models = Object.keys(lastModelUsage);
  return models[0] ?? null;
}
