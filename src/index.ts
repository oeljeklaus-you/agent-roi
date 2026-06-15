#!/usr/bin/env node

import { Command } from 'commander';
import { runReportCommand } from './commands/report.js';
import { runScanCommand } from './commands/scan.js';
import { runTaskReportCommand, runTaskStartCommand, runTaskStopCommand } from './commands/task.js';
import { runTodayCommand } from './commands/today.js';

const program = new Command();

program
  .name('agent-roi')
  .description('AI Coding ROI Analyzer')
  .version('0.1.0');

program.command('scan').description('Scan local AI coding data into SQLite').action(runScanCommand);

program.command('today').description("Show today's AI coding activity summary").action(runTodayCommand);

program
  .command('report')
  .description('Show ROI report for the current Git repository over the last 7 days')
  .action(runReportCommand);

const taskProgram = program.command('task').description('Track time-window-based task attribution');

taskProgram.command('start <name>').description('Start a task in the current project').action(runTaskStartCommand);

taskProgram.command('stop').description('Stop the active task in the current project').action(runTaskStopCommand);

taskProgram.command('report').description('Show the 10 most recent tasks').action(runTaskReportCommand);

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown CLI failure';
  console.error(message);
  process.exitCode = 1;
}
