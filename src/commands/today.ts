import chalk from 'chalk';
import { getTodaySummaryForSource, openDatabase } from '../database/db.js';
import { formatInteger, formatUsd } from '../utils/format.js';
import { addDays, startOfTodayIso } from '../utils/time.js';

export async function runTodayCommand(): Promise<void> {
  let db: ReturnType<typeof openDatabase> | null = null;

  try {
    db = openDatabase();
    const fromIso = startOfTodayIso();
    const toIso = addDays(fromIso, 1);

    const codex = getTodaySummaryForSource(db, 'codex', 'started_at', fromIso, toIso);
    const claude = getTodaySummaryForSource(db, 'claude', 'updated_at', fromIso, toIso);

    const totalTokens = codex.totalTokens + claude.totalTokens;
    const totalCost = (codex.costUsd ?? 0) + (claude.costUsd ?? 0);

    console.log(
      buildTodayOutput({
        codexSessions: codex.count,
        codexTokens: codex.totalTokens,
        codexCostUsd: codex.costUsd ?? 0,
        claudeSnapshots: claude.count,
        claudeTokens: claude.totalTokens,
        claudeCostUsd: claude.costUsd ?? 0,
        totalTokens,
        totalCostUsd: totalCost,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown today summary failure';
    console.error(chalk.red(`agent-roi today failed: ${message}`));
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

export function buildTodayOutput(summary: {
  codexSessions: number;
  codexTokens: number;
  codexCostUsd: number;
  claudeSnapshots: number;
  claudeTokens: number;
  claudeCostUsd: number;
  totalTokens: number;
  totalCostUsd: number;
}): string {
  return [
    chalk.bold("Today's AI Activity"),
    'Scope: Codex sessions started today plus Claude latest snapshots captured today. This is not an official billing-day view.',
    '',
    chalk.cyan('Codex'),
    `  Sessions: ${formatInteger(summary.codexSessions)}`,
    `  Tokens: ${formatInteger(summary.codexTokens)}`,
    `  Estimated Cost: ${formatUsd(summary.codexCostUsd)}`,
    '',
    chalk.cyan('Claude'),
    `  Latest Snapshots Captured: ${formatInteger(summary.claudeSnapshots)}`,
    `  Tokens: ${formatInteger(summary.claudeTokens)}`,
    `  Reported Snapshot Cost: ${formatUsd(summary.claudeCostUsd)}`,
    '',
    chalk.cyan('Total'),
    `  Tokens: ${formatInteger(summary.totalTokens)}`,
    `  Cost: ${formatUsd(summary.totalCostUsd)}`,
  ].join('\n');
}
