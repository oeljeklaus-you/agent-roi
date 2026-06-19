# Architecture

Agent ROI is a local-first CLI.

Its data flow is intentionally simple:

```text
AI Logs
↓
Parsers
↓
SQLite
↓
CLI + UI
```

## Core Pipeline

1. Local AI logs are discovered on the developer machine.
2. Parsers normalize those records into a shared session shape.
3. Normalized records are stored in SQLite.
4. CLI commands read SQLite and combine it with Git metrics to produce ROI-style reports.
5. The local UI reads the same SQLite-backed view models and presents them as dashboard pages.

## Data Flows

### Codex

Codex is the primary historical source in V0.1.

Flow:

```text
~/.codex/sessions/**/*.jsonl
~/.codex/session_index.jsonl
↓
Codex parser
↓
sessions table
↓
today / report / task report
```

Codex provides stable local session data for:

- session id
- project path
- timestamp
- token usage
- model

Cost is estimated later from the local pricing table.

### Claude

Claude is supported with limited scope in V0.1.

Flow:

```text
~/.claude.json
~/.claude/sessions/*.json
↓
Claude parser
↓
sessions table
↓
today / report
```

Claude local data supports latest snapshot import, not reliable full historical backfill.

That means Claude data is useful for snapshot-style repository reporting, but not for historical task attribution.

### Git

Git data is collected from the current repository.

Flow:

```text
Current Git repository
↓
Git metrics collector
↓
git_metrics table
↓
report / task stop / task report
```

Git metrics include:

- commit count
- files changed
- lines added
- lines removed

## Why SQLite

SQLite keeps the MVP local, inspectable, and easy to extend.

It also keeps the project aligned with the original constraint:

- no cloud
- no account system
- no sync requirement

## UI Layer

The dashboard is still local-first.

Flow:

```text
SQLite
↓
view-models
↓
local HTTP server
↓
browser UI
```

It does not add:

- cloud sync
- hosted storage
- remote analytics

See [ui.md](ui.md) for the dashboard behavior.
