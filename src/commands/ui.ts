import chalk from 'chalk';
import { startUiServer } from '../ui/server.js';

type UiCommandOptions = {
  port?: number;
  open?: boolean;
  budget?: number;
};

export async function runUiCommand(options: UiCommandOptions = {}): Promise<void> {
  let started: Awaited<ReturnType<typeof startUiServer>> | null = null;
  let shuttingDown = false;

  try {
    started = await startUiServer({
      port: normalizePort(options.port),
      openBrowser: options.open ?? false,
      budgetLimitUsd: normalizeBudget(options.budget),
    });

    console.log([
      chalk.bold('Agent ROI UI'),
      '',
      'Local dashboard running at:',
      started.url,
      '',
      'Press Ctrl+C to stop.',
    ].join('\n'));

    const shutdown = async (): Promise<void> => {
      if (shuttingDown) {
        return;
      }

      shuttingDown = true;
      process.off('SIGINT', handleSignal);

      if (started) {
        await started.close();
      }

      process.exit(0);
    };

    const handleSignal = (): void => {
      void shutdown();
    };

    process.on('SIGINT', handleSignal);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown UI failure';
    console.error(chalk.red(`agent-roi ui failed: ${message}`));
    process.exitCode = 1;
  }
}

function normalizePort(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}

function normalizeBudget(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

export type { UiCommandOptions };
