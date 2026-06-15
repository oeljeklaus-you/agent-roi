import chalk from 'chalk';
import { openDatabase, upsertSessionRecords } from '../database/db.js';
import { parseClaudeLatestSnapshots } from '../parsers/claude.js';
import { parseCodexSessions } from '../parsers/codex.js';

export async function runScanCommand(): Promise<void> {
  let db: ReturnType<typeof openDatabase> | null = null;

  try {
    db = openDatabase();
    const codexRecords = parseCodexSessions(db);
    const claudeRecords = parseClaudeLatestSnapshots();

    upsertSessionRecords(db, codexRecords);
    upsertSessionRecords(db, claudeRecords);

    console.log(chalk.bold('Scan Complete'));
    console.log(`Codex sessions imported: ${codexRecords.length}`);
    console.log(`Claude latest snapshots imported: ${claudeRecords.length}`);
    console.log(`Database: ${db.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scan failure';
    console.error(chalk.red(`agent-roi scan failed: ${message}`));
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}
