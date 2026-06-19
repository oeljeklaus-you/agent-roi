# UI

`agent-roi ui` opens the local Agent ROI dashboard.

It is the fastest way to review:

- Overview
- Projects
- Tasks
- Budget
- Compare
- Insights
- Waste
- Recommendations
- Leaderboard

## Run It

```bash
agent-roi ui --open
```

Useful options:

- `--open`
  Opens the local dashboard in your default browser.
- `--port <port>`
  Chooses a custom local port.
- `--budget <usd>`
  Shows a monthly budget target in the budget view.

## What It Shows

### Overview

The dashboard overview is the visual summary page.

It highlights:

- current spend
- tracked vs untracked project coverage
- recent completed task volume
- compare takeaway
- next recommendation
- potential waste
- leaderboard snapshot

### Projects

The projects page is a searchable and filterable project coverage view.

It helps you quickly see:

- which projects are already tracked
- which projects still have AI usage but no task attribution
- active task coverage
- recent project activity

### Tasks

The tasks page is a searchable and filterable review queue for recent completed tasks.

It helps you inspect:

- matched vs unmatched attribution
- task duration
- AI cost
- tokens
- commits
- files changed
- LOC changed

### Analysis Pages

The remaining pages turn the existing CLI analyses into visual views:

- Budget
- Compare
- Insights
- Waste
- Recommendations
- Leaderboard

## Product Boundaries

- local-only
- no cloud
- no telemetry
- no account required
- Claude snapshots excluded from task views
- Codex task attribution only for task-based analysis pages

## Related Commands

- `agent-roi scan`
  Load local AI usage before opening the dashboard.
- `agent-roi watch`
  Collect higher-quality task data automatically from Git branch changes.
- `agent-roi task report`
  Review the same task history in CLI form.
