import chalk from 'chalk';
import {
  completeTask,
  createTask,
  getActiveTaskForProject,
  getProjectAiSummary,
  listRecentTasks,
  openDatabase,
  upsertGitMetric,
  type TaskRecord,
} from '../database/db.js';
import {
  getGitMetricsForRepoWindow,
  tryGetGitRepoRoot,
  type GitMetrics,
} from '../git/metrics.js';
import { formatInteger, formatUsd } from '../utils/format.js';
import { normalizeProjectPath } from '../utils/paths.js';
import { nowIso } from '../utils/time.js';

type TaskMetricsSummary = {
  aiCostUsd: number | null;
  totalTokens: number;
  hasUnknownCost: boolean;
  gitMetrics: GitMetrics;
};

export async function runTaskStartCommand(name: string): Promise<void> {
  let db: ReturnType<typeof openDatabase> | null = null;

  try {
    db = openDatabase();
    const projectPath = resolveTaskProjectPath();
    const activeTask = getActiveTaskForProject(db, projectPath);

    if (activeTask) {
      console.log(buildDuplicateActiveTaskMessage(activeTask.name));
      return;
    }

    const task = createTask(db, {
      name,
      projectPath,
    });

    console.log(buildTaskStartOutput(task));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown task start failure';
    console.error(chalk.red(`agent-roi task start failed: ${message}`));
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

export async function runTaskStopCommand(): Promise<void> {
  let db: ReturnType<typeof openDatabase> | null = null;

  try {
    db = openDatabase();
    const projectPath = resolveTaskProjectPath();
    const activeTask = getActiveTaskForProject(db, projectPath);

    if (!activeTask) {
      console.log(buildNoActiveTaskMessage());
      return;
    }

    const endedAt = nowIso();
    const completedTask = completeTask(db, activeTask.id, endedAt);
    const summary = summarizeTaskWindow(db, completedTask);

    if (summary.gitMetrics.projectPath === projectPath) {
      upsertGitMetric(db, {
        projectPath,
        fromDate: completedTask.startedAt,
        toDate: completedTask.endedAt ?? endedAt,
        commitCount: summary.gitMetrics.commitCount,
        filesChanged: summary.gitMetrics.filesChanged,
        linesAdded: summary.gitMetrics.linesAdded,
        linesRemoved: summary.gitMetrics.linesRemoved,
      });
    }

    console.log(buildTaskStopOutput(completedTask, summary));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown task stop failure';
    console.error(chalk.red(`agent-roi task stop failed: ${message}`));
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

export async function runTaskReportCommand(): Promise<void> {
  let db: ReturnType<typeof openDatabase> | null = null;

  try {
    db = openDatabase();
    const tasks = listRecentTasks(db, 10);
    const lines = [chalk.bold('Task Report'), 'Task Attribution is time-window based.', ''];

    if (tasks.length === 0) {
      lines.push('No tasks recorded yet.');
      console.log(lines.join('\n'));
      return;
    }

    for (const task of tasks) {
      const summary = task.status === 'completed' ? summarizeTaskWindow(db, task) : null;
      lines.push(...buildTaskReportLines(task, summary));
      lines.push('');
    }

    console.log(lines.slice(0, -1).join('\n'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown task report failure';
    console.error(chalk.red(`agent-roi task report failed: ${message}`));
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

export function buildTaskStartOutput(task: TaskRecord): string {
  return [
    chalk.bold('Task Started'),
    `Name: ${task.name}`,
    `Project Path: ${task.projectPath}`,
    `Started At: ${task.startedAt}`,
    'Status: active',
  ].join('\n');
}

export function buildDuplicateActiveTaskMessage(taskName: string): string {
  return chalk.yellow(
    `An active task already exists for this project: "${taskName}". Run "agent-roi task stop" before starting a new task.`,
  );
}

export function buildNoActiveTaskMessage(): string {
  return chalk.yellow('No active task found for this project. Run "agent-roi task start <name>" first.');
}

export function buildTaskStopOutput(task: TaskRecord, summary: TaskMetricsSummary): string {
  const duration = formatDuration(task.startedAt, task.endedAt);
  const durationHours = getDurationHours(task.startedAt, task.endedAt);
  const lines = [
    chalk.bold('Task Summary'),
    `Name: ${task.name}`,
    `Project Path: ${task.projectPath}`,
    `Duration: ${duration}`,
    'Task Attribution: time-window based',
    '',
    `AI Cost: ${summary.aiCostUsd === null ? 'N/A' : formatUsd(summary.aiCostUsd)}`,
    `Tokens: ${formatInteger(summary.totalTokens)}`,
    `Commits: ${formatInteger(summary.gitMetrics.commitCount)}`,
    `Files Changed: ${formatInteger(summary.gitMetrics.filesChanged)}`,
    `Lines Added: ${formatInteger(summary.gitMetrics.linesAdded)}`,
    `Lines Removed: ${formatInteger(summary.gitMetrics.linesRemoved)}`,
    `Cost Per Hour: ${formatTaskCostPerHour(summary, durationHours)}`,
    `Tokens Per Hour: ${formatTaskTokensPerHour(summary, durationHours)}`,
    `Commits Per Hour: ${formatTaskCommitsPerHour(summary, durationHours)}`,
    `Files Changed Per Hour: ${formatTaskFilesChangedPerHour(summary, durationHours)}`,
    `Cost Per Commit: ${formatTaskCostPerCommit(summary)}`,
    `Cost Per 1000 LOC: ${formatTaskCostPer1000Loc(summary)}`,
  ];

  if (summary.totalTokens === 0) {
    lines.push('No matched AI data');
  }

  if (summary.hasUnknownCost) {
    lines.push('Cost Source: Codex estimated (partial price coverage)');
  } else if (summary.totalTokens > 0) {
    lines.push('Cost Source: Codex estimated');
  }

  lines.push('Claude latest snapshot data is excluded from task attribution in V0.1.');

  return lines.join('\n');
}

export function buildTaskReportLines(task: TaskRecord, summary: TaskMetricsSummary | null): string[] {
  const duration = formatDuration(task.startedAt, task.endedAt);
  const durationHours = getDurationHours(task.startedAt, task.endedAt);
  const lines = [
    chalk.cyan(task.name),
    `  Status: ${task.status}`,
    `  Duration: ${duration}`,
  ];

  if (!summary) {
    lines.push('  AI Cost: N/A');
    lines.push('  Tokens: N/A');
    lines.push('  Commits: N/A');
    return lines;
  }

  lines.push(`  AI Cost: ${summary.aiCostUsd === null ? 'N/A' : formatUsd(summary.aiCostUsd)}`);
  lines.push(`  Tokens: ${formatInteger(summary.totalTokens)}`);
  lines.push(`  Commits: ${formatInteger(summary.gitMetrics.commitCount)}`);
  lines.push(`  Files Changed: ${formatInteger(summary.gitMetrics.filesChanged)}`);
  lines.push(`  Lines Added: ${formatInteger(summary.gitMetrics.linesAdded)}`);
  lines.push(`  Lines Removed: ${formatInteger(summary.gitMetrics.linesRemoved)}`);
  lines.push(`  Cost Per Hour: ${formatTaskCostPerHour(summary, durationHours)}`);
  lines.push(`  Tokens Per Hour: ${formatTaskTokensPerHour(summary, durationHours)}`);
  lines.push(`  Commits Per Hour: ${formatTaskCommitsPerHour(summary, durationHours)}`);
  lines.push(`  Files Changed Per Hour: ${formatTaskFilesChangedPerHour(summary, durationHours)}`);
  lines.push(`  Cost Per Commit: ${formatTaskCostPerCommit(summary)}`);
  lines.push(`  Cost Per 1000 LOC: ${formatTaskCostPer1000Loc(summary)}`);

  if (summary.totalTokens === 0) {
    lines.push('  No matched AI data');
  }

  if (summary.hasUnknownCost) {
    lines.push('  Cost Source: Codex estimated (partial price coverage)');
  } else if (summary.totalTokens > 0) {
    lines.push('  Cost Source: Codex estimated');
  }

  return lines;
}

export function summarizeTaskWindow(
  db: ReturnType<typeof openDatabase>,
  task: Pick<TaskRecord, 'projectPath' | 'startedAt' | 'endedAt'>,
): TaskMetricsSummary {
  const fromDate = new Date(task.startedAt);
  const toDate = new Date(task.endedAt ?? nowIso());
  const aiSummary = getProjectAiSummary(db, task.projectPath, fromDate.toISOString(), toDate.toISOString(), {
    includeClaudeSnapshots: false,
  });
  const repoRoot = tryGetGitRepoRoot(task.projectPath);
  const gitMetrics = repoRoot
    ? getGitMetricsForRepoWindow(repoRoot, fromDate, toDate)
    : {
        projectPath: task.projectPath,
        projectName: task.projectPath.split(/[\\/]/).pop() ?? task.projectPath,
        commitCount: 0,
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
      };

  return {
    aiCostUsd: aiSummary.costUsd,
    totalTokens: aiSummary.totalTokens,
    hasUnknownCost: aiSummary.hasUnknownCost,
    gitMetrics,
  };
}

export function resolveTaskProjectPath(cwd = process.cwd()): string {
  const repoRoot = tryGetGitRepoRoot(cwd);
  return normalizeProjectPath(repoRoot ?? cwd);
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt ?? nowIso()).getTime();
  const diffMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function getDurationHours(startedAt: string, endedAt: string | null): number | null {
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt ?? nowIso()).getTime();
  const diffMs = endMs - startMs;

  if (!Number.isFinite(diffMs) || diffMs < 60_000) {
    return null;
  }

  return diffMs / (60 * 60 * 1000);
}

function formatTaskCostPerCommit(summary: TaskMetricsSummary): string {
  if (!summary.aiCostUsd || summary.gitMetrics.commitCount === 0) {
    return 'N/A';
  }

  return formatUsd(summary.aiCostUsd / summary.gitMetrics.commitCount);
}

function formatTaskCostPer1000Loc(summary: TaskMetricsSummary): string {
  const loc = summary.gitMetrics.linesAdded + summary.gitMetrics.linesRemoved;
  if (!summary.aiCostUsd || loc === 0) {
    return 'N/A';
  }

  return formatUsd((summary.aiCostUsd / loc) * 1000);
}

function formatTaskCostPerHour(summary: TaskMetricsSummary, durationHours: number | null): string {
  if (durationHours === null || summary.totalTokens === 0 || summary.aiCostUsd === null) {
    return 'N/A';
  }

  return `${formatUsd(summary.aiCostUsd / durationHours)}/h`;
}

function formatTaskTokensPerHour(summary: TaskMetricsSummary, durationHours: number | null): string {
  if (durationHours === null || summary.totalTokens === 0) {
    return 'N/A';
  }

  return `${formatCompactTokens(summary.totalTokens / durationHours)}/h`;
}

function formatTaskCommitsPerHour(summary: TaskMetricsSummary, durationHours: number | null): string {
  if (durationHours === null) {
    return 'N/A';
  }

  return `${formatPerHourValue(summary.gitMetrics.commitCount / durationHours)}/h`;
}

function formatTaskFilesChangedPerHour(summary: TaskMetricsSummary, durationHours: number | null): string {
  if (durationHours === null) {
    return 'N/A';
  }

  return `${formatPerHourValue(summary.gitMetrics.filesChanged / durationHours)}/h`;
}

function formatPerHourValue(value: number): string {
  if (value === 0) {
    return '0';
  }

  if (value >= 10) {
    return value.toFixed(1).replace(/\.0$/, '');
  }

  return value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

function formatCompactTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${trimTrailingZeros((value / 1_000_000).toFixed(2))}M`;
  }

  if (value >= 1_000) {
    const thousands = value / 1_000;
    const digits = thousands >= 100 ? 0 : thousands >= 10 ? 1 : 2;
    return `${trimTrailingZeros(thousands.toFixed(digits))}k`;
  }

  return formatPerHourValue(value);
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}
