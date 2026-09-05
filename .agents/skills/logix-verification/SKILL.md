---
name: logix-verification
description: Verify completed Logix code, configuration, migration, or documentation changes before handoff by selecting risk-proportional checks, inspecting the final diff, and reporting only observed results. Do not use as a substitute for implementation or to weaken failing gates.
---

# Logix Verification

Produce evidence that a change meets its acceptance criteria without modifying files through check commands.

1. Re-read the task acceptance criteria and determine the affected modules and risk surfaces: UI, contract, domain, database, security, workflow, integration, or documentation.
2. Run checks from narrowest to broadest:
   - The closest regression or component test.
   - Relevant lint, format check, type check, and build commands.
   - Repository `validate` when configured.
   - Risk-specific gates such as contract parity, migration upgrade tests, database integration tests, authorization tests, security scans, or end-to-end flows.
3. Use only documented project commands. Check commands must not format or rewrite files. Never skip tests, loosen assertions, update snapshots blindly, or suppress errors to obtain a pass.
4. Inspect the final scoped diff and worktree for unrelated edits, generated output, dependency directories, logs, coverage, secrets, real environment files, debug code, dead code, unexplained defaults, and unowned TODOs. Preserve pre-existing user changes.
5. Check compatibility, migration, authorization, privacy, observability, documentation, and rollback impact where the change touches those surfaces.
6. A failed command remains failed. Diagnose enough to distinguish a change regression from an environmental or pre-existing failure, but do not expand into an unrelated fix without authorization.
7. Report:
   - Changed behavior and files.
   - Exact commands executed and their outcomes.
   - Required commands that are not configured or were not run.
   - Known warnings, residual risks, and any required human review.

Do not mark a task brief `done` unless its required evidence exists. Never commit, push, deploy, or modify external systems unless explicitly requested.
