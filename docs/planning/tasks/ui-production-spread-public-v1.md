---
status: fix
branch: feat/ui-production-spread-public
owner: main
writer: codex
risk: high
dependsOn: []
writeScopes:
  - docs/planning/tasks/ui-production-spread-public-v1.md
  - apps/web/e2e/recoverable-work-sessions.spec.ts
  - docs/planning/progress-board.html
  - apps/web/e2e/**
  - apps/web/src/**
exclusiveLocks:
  - ui-pattern:public-workbench-ci-recovery
sharedIntegrationScopes: []
authorityRefs:
  - AGENTS.md
  - ENGINEERING_RULES.md
uiStructure:
  - Preserve the workbench order of queue, current object and facts, then allowed actions and feedback.
  - Keep desktop, narrow and mobile navigation aligned with the active work context.
uiMustStayVisible:
  - Current object, current responsibility, facts, gaps, allowed action and result feedback.
  - Failure, retry and recovery states where the consumer supports them.
uiProgressiveDisclosure:
  - Archive, collaboration, AI explanation and technical details remain in contextual modes.
uiForbidden:
  - No empty capability panels, invented permissions, invented business conclusions or claims of business-value completion.
uiViewportEvidence:
  - 1440x900, 1024x768 and 390x844 responsive paths must avoid horizontal overflow and preserve the decision sequence.
---

# Public UI workbench spread

## Scope

This public release branch contains reviewed web UI, consumer tests and responsive browser fixtures for spreading task context and recovery patterns across operational workbench consumers.

## Boundaries

This change does not modify APIs, contracts, database migrations, backend services, authorization policy or business completion semantics. It does not claim production release, validation of all workbenches or business-value improvement.

## Acceptance

- Exact task and work-order context remains bound to the active consumer.
- Professional drafts, asynchronous responses, retries and recovery remain isolated by active context.
- Responsive desktop, narrow and mobile paths preserve the workbench decision sequence without horizontal overflow.
- Snapshot baselines are reviewed artifacts and are not silently regenerated.

## CI recovery slice

The public release branch includes a generated progress board and browser-fixture corrections. The fixture correction keeps exact task/work-order binding, enters the visible mobile work pane before editing, verifies the edited value, and preserves the supported dirty-switch choices. No production component, public configuration, API, contract, database or snapshot tolerance is changed by this slice.

### Verification

Run calibration, board, repository, documentation, lint, typecheck, build, formatting, focused work-session tests and affected browser checks. Use snapshot updates only when a reviewed visual cause is established; otherwise report the visual difference. Keep full release validation and external business acceptance as separate gates.

### Stop conditions

If a production change, shared configuration change, new fixture family, font change, snapshot replacement or server/process change is required, stop and report the evidence. Do not weaken exact context binding, disable checks, stop unrelated local services or publish internal paths, temporary logs or private provenance.
