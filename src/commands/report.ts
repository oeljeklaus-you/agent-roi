import chalk from 'chalk';
import { getProjectAiSummary, openDatabase, upsertGitMetric } from '../database/db.js';
import { getGitMetricsForCurrentRepo, GitRepositoryNotFoundError, type GitMetrics } from '../git/metrics.js';
import { formatInteger, formatUsd } from '../utils/format.js';
import { daysAgoIso, nowIso } from '../utils/time.js';

export async function runReportCommand(): Promise<void> {
  let db: ReturnType<typeof openDatabase> | null = null;

  try {
    db = openDatabase();
    const fromDate = new Date(daysAgoIso(7));
    const toDate = new Date(nowIso());
    const gitMetrics = getGitMetricsForCurrentRepo(fromDate);

    upsertGitMetric(db, {
      projectPath: gitMetrics.projectPath,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      commitCount: gitMetrics.commitCount,
      filesChanged: gitMetrics.filesChanged,
      linesAdded: gitMetrics.linesAdded,
      linesRemoved: gitMetrics.linesRemoved,
    });

    const aiSummary = getProjectAiSummary(db, gitMetrics.projectPath, fromDate.toISOString(), toDate.toISOString());
    console.log(buildReportOutput(gitMetrics, aiSummary));
  } catch (error) {
    if (error instanceof GitRepositoryNotFoundError) {
      console.error(chalk.red('agent-roi report must be run inside a Git repository.'));
      process.exitCode = 1;
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown report failure';
    console.error(chalk.red(`agent-roi report failed: ${message}`));
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

export function buildReportOutput(
  gitMetrics: GitMetrics,
  aiSummary: {
    costUsd: number | null;
    totalTokens: number;
    codexCount: number;
    claudeCount: number;
    hasUnknownCost: boolean;
  },
): string {
  const netLoc = gitMetrics.linesAdded + gitMetrics.linesRemoved;
  const costPerCommit = gitMetrics.commitCount > 0 ? (aiSummary.costUsd ?? 0) / gitMetrics.commitCount : null;
  const costPer1000Loc = netLoc > 0 ? ((aiSummary.costUsd ?? 0) / netLoc) * 1000 : null;
  const tokensPerCommit = gitMetrics.commitCount > 0 ? aiSummary.totalTokens / gitMetrics.commitCount : null;
  const costQuality = buildCostQualityLabel(aiSummary);

  const lines: string[] = [
    chalk.bold('Project ROI Report'),
    '',
    `Project: ${gitMetrics.projectName}`,
    `AI Cost: ${formatUsd(aiSummary.costUsd ?? 0)}`,
    `Cost Quality: ${costQuality}`,
    `Tokens: ${formatInteger(aiSummary.totalTokens)}`,
    '',
    chalk.cyan('Git Activity'),
    `  Commits: ${formatInteger(gitMetrics.commitCount)}`,
    `  Files Changed: ${formatInteger(gitMetrics.filesChanged)}`,
    `  Lines Added: ${formatInteger(gitMetrics.linesAdded)}`,
    `  Lines Removed: ${formatInteger(gitMetrics.linesRemoved)}`,
    '',
    chalk.cyan('Efficiency'),
    `  Cost Per Commit: ${costPerCommit === null ? 'N/A' : formatUsd(costPerCommit)}`,
    `  Cost Per 1000 LOC: ${costPer1000Loc === null ? 'N/A' : formatUsd(costPer1000Loc)}`,
    `  Tokens Per Commit: ${tokensPerCommit === null ? 'N/A' : formatInteger(Math.round(tokensPerCommit))}`,
    '',
    chalk.cyan('Coverage Notes'),
    '  Codex historical sessions are fully scanned.',
    '  Claude historical session-level usage is limited by local data shape.',
    '  Claude data is latest snapshot only in V0.1.',
  ];

  if (aiSummary.codexCount === 0 && aiSummary.claudeCount === 0) {
    lines.push('  No matched AI session or snapshot data was found for this repository in the last 7 days.');
  }

  if (aiSummary.hasUnknownCost) {
    lines.push('  Some Codex models were missing from the local price table, so part of cost is unavailable.');
  }

  return lines.join('\n');
}

function buildCostQualityLabel(aiSummary: {
  codexCount: number;
  claudeCount: number;
  hasUnknownCost: boolean;
}): string {
  const parts: string[] = [];

  if (aiSummary.codexCount > 0) {
    parts.push(aiSummary.hasUnknownCost ? 'Codex estimated (partial price coverage)' : 'Codex estimated');
  }

  if (aiSummary.claudeCount > 0) {
    parts.push('Claude latest snapshot');
  }

  if (parts.length === 0) {
    return 'No matched AI data';
  }

  return parts.join(' / ');
}
