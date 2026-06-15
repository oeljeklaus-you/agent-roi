# Attribution

Task Attribution is time-window based.

That means Agent ROI does not try to infer intent from prompts, diffs, or AI conversation content.

It uses a simpler and auditable rule:

```text
Task Start
↓
Task End
↓
Time Window
```

## Attribution Rule

A session is counted toward a task only when all of the following are true:

- `project_path` matches the task project
- the session timestamp falls inside the task time window
- the session is a Codex session

Claude latest snapshots are not counted in task historical attribution.

## Why This Model

This model is intentionally narrow.

It keeps V0.1 local, deterministic, and easy to explain:

- no cloud state
- no background agent
- no prompt classification
- no hidden attribution heuristic

## Included and Excluded Data

Included in task attribution:

- Codex sessions matched by project path and task time window
- Git activity matched to the same repository and time window

Excluded from task attribution:

- Claude latest snapshots
- AI activity outside the task time window
- sessions from a different project path

## Output Metrics

Task summaries and task reports currently expose:

- Duration
- AI Cost
- Cost Per Hour
- Tokens
- Tokens Per Hour
- Commits
- Commits Per Hour
- Files Changed
- Files Changed Per Hour
- Cost Per Commit
- Cost Per 1000 LOC

Per-hour metrics are calculated from:

```text
task.started_at
↓
task.ended_at
↓
durationHours
```

Per-hour metrics use that task duration together with matched Codex sessions and matched Git activity.

If duration is zero, invalid, or too short to calculate reliably, per-hour metrics are shown as `N/A`.

Example task summary:

```text
Task: Fix purchase button

Duration: 2h 0m
AI Cost: $1.25
Cost Per Hour: $0.63/h
Tokens: 1,500,000
Tokens Per Hour: 750k/h
Commits: 2
Commits Per Hour: 1/h
Files Changed: 7
Files Changed Per Hour: 3.5/h
Cost Per Commit: $0.63
Cost Per 1000 LOC: $2.97
```

## FAQ

### Why does a task show no cost?

Common reasons:

- no matched Codex session was found in that time window
- the matched session used a model with no local price entry
- the task started and stopped outside the session timestamps you expected

If the model has no price entry, Agent ROI marks it as `unknown_model` instead of guessing.

### Why does a task show no commit?

Task attribution and Git activity are related, but they are not the same event stream.

Possible reasons:

- work happened but was not committed yet
- changes were squashed or committed outside the task window
- the task involved review, debugging, or exploration with no final commit

### Why is Claude not counted?

Because V0.1 only imports Claude latest snapshot data.

That snapshot shape is useful for repository-level visibility, but it is not a reliable historical session stream for task-level attribution.

### Why is cost different from billing?

Because Codex cost is estimated from a local pricing table.

Agent ROI is designed for ROI analysis, not invoice reconciliation.

Provider billing may differ due to pricing updates, billing rules, or model mapping gaps.
