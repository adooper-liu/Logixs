---
name: logix-task-bootstrap
description: Prepare implementation, fixes, or design changes in the Logix repository by locating governing instructions, authoritative artifacts, current work, module boundaries, and the narrowest verification path. Do not use for read-only explanations or status reports.
---

# Logix Task Bootstrap

Establish a reliable task baseline before editing files.

1. Read every applicable `AGENTS.md` from the repository root through the target directory, plus `ENGINEERING_RULES.md`.
2. Inspect `git status --short`. Treat all existing changes and untracked files as user work unless proven otherwise. Do not revert, overwrite, format, or regenerate unrelated files.
3. Locate the active task brief under `docs/planning/tasks/`. Respect its phase, scope, acceptance criteria, and single-in-progress-task rule. Do not change its status without the required evidence.
4. Read the smallest authoritative set needed for the task:
   - Use `docs/INDEX.md` to identify document status and ownership.
   - Prefer accepted or owner-confirmed artifacts over candidates.
   - Treat snapshots as evidence of current or legacy behavior, not target policy.
   - Never promote a candidate or unverified statement into a business rule.
5. Locate the affected entry points, public contracts, dependency direction, tests, configuration, and migrations. For data work, identify the authoritative schema and migration history before proposing edits.
6. State the intended behavior, affected modules, compatibility or security impact, files likely to change, and nearest verification commands before editing. Keep the scope no wider than the request.
7. If the request conflicts with an accepted architecture decision, phase gate, or owner-confirmed rule, stop and identify the decision or exception process required. Do not conceal the conflict with a local workaround.

Hand off a concise working baseline to the implementation: authority sources, current-state facts, assumptions, impact boundary, and verification plan.
