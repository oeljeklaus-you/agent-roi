export const CREATE_SESSIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  session_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  model TEXT,
  started_at TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  cost_source TEXT NOT NULL,
  raw_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source, session_id, raw_path)
);
`;

export const CREATE_GIT_METRICS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS git_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  commit_count INTEGER NOT NULL DEFAULT 0,
  files_changed INTEGER NOT NULL DEFAULT 0,
  lines_added INTEGER NOT NULL DEFAULT 0,
  lines_removed INTEGER NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL,
  UNIQUE(project_path, from_date, to_date)
);
`;

export const CREATE_PRICE_MODELS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS price_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_price_per_1m REAL NOT NULL,
  cached_input_price_per_1m REAL NOT NULL,
  output_price_per_1m REAL NOT NULL,
  reasoning_output_price_per_1m REAL,
  effective_from TEXT NOT NULL,
  UNIQUE(provider, model, effective_from)
);
`;

export const CREATE_TASKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const CREATE_ACTIVE_TASK_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_active_project
ON tasks(project_path)
WHERE status = 'active';
`;
