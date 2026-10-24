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
  - apps/web/e2e/stuffing-workbench.spec.ts
  - apps/web/e2e/pickup-workbench.spec.ts
  - apps/web/e2e/warehouse-delivery-workbench.spec.ts
  - apps/web/e2e/container-unloading-workbench.spec.ts
  - docs/planning/progress-board.html
  - apps/web/src/**
  - apps/web/e2e/shell-layout.spec.ts
  - apps/web/e2e/container-unloading-workbench.spec.ts-snapshots/**
  - apps/web/e2e/stuffing-workbench.spec.ts-snapshots/**
  - apps/web/e2e/pickup-workbench.spec.ts-snapshots/**
  - apps/web/e2e/warehouse-delivery-workbench.spec.ts-snapshots/**
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

This public release branch contains the reviewed web UI, consumer tests and responsive browser fixtures for spreading task context and recovery patterns across operational workbench consumers.

## Boundaries

This change does not modify APIs, contracts, database migrations, backend services, authorization policy or business completion semantics. It does not claim production release, validation of all workbenches or business-value improvement.

## Verification

The reviewed consumer tests, responsive browser checks, lint, typecheck, build and formatting checks are run for the changed web scope. Full repository validation, external business acceptance and release approval remain separate gates.

## Acceptance

- Exact task and work-order context remains bound to the active consumer.
- Professional drafts, asynchronous responses, retries and recovery remain isolated by active context.
- Responsive desktop, narrow and mobile paths preserve the workbench decision sequence without horizontal overflow.
- Snapshot baselines are reviewed artifacts and are not silently regenerated.

## CI recovery slice `public-ci-recovery`

PR #200 run `40086009365` failed in two independent gates. `static` passed task calibration but failed `board:check` because adding this public brief changed the board inputs without regenerating its tracked output. Local checks from the public checkout confirm calibration passes, repository policy passes, formatting and production static checks pass, and board freshness fails. Checks previously run from another checkout are not evidence for this branch.

The E2E run reports 548 passed, 81 skipped and 17 failed tests. Fifteen failures are screenshot comparisons across Stuffing, Pickup, Delivery, Unloading and the mobile Stuffing work-session menu; two are missing dirty-switch choices in the mobile recoverable-work-session flow. The two choices cannot be treated as browser popup blocking: the expected new-tab control is absent before the popup wait. Action runtime deprecation notices are warnings, not established causes. The aggregate quality job fails when these required jobs fail and is not an independent product defect.

### Current result and smallest permitted repair

- Regenerate the tracked progress board from this public checkout and verify the exact CI calibration/board commands. Do not disable or skip either gate. Treat the generated board as a public artifact: inspect it before committing; no absolute workstation paths, temporary log references or private task history may be added. If the official generator cannot produce an acceptable artifact, report the specific conflicting output rather than hand-editing it or changing the generator.
- Inspect CI expected/actual/diff screenshots to determine whether the differences are fonts/rendering, a frozen-clock mismatch or actual geometry/behavior regressions. Widespread changed text pixels with stable pane edges are evidence to investigate rendering, not permission to relax thresholds. Establish a reproducible cause before changing any baseline. Preserve responsive geometry, information order and visible recovery controls.
- Investigate the existing recoverable-work-session fixture and real Stuffing consumer together. The fixture currently combines `workOrders: []` with a claim nextAction; current exact-context binding deliberately rejects that mismatch. Read-only tracing confirms the fixture is inconsistent; it does not prove a production dirty-state defect. The form now belongs to the context pane, while the old edit pointer targets detail. First repair the fixture with the matching WorkOrder and make the two mobile tests enter the visible work/context pane before editing; assert the seal actually equals the typed value before switching. Never weaken exact task binding, use forced input into inert content, or silently change production pointer semantics to make this fixture pass. Prove input remains dirty and the supported discard/new-tab/stay choices remain reachable.

### Execution scope and stop conditions

The implementation executor may modify only these existing files: `apps/web/e2e/recoverable-work-sessions.spec.ts`, `apps/web/e2e/stuffing-workbench.spec.ts`, `apps/web/e2e/pickup-workbench.spec.ts`, `apps/web/e2e/warehouse-delivery-workbench.spec.ts`, `apps/web/e2e/container-unloading-workbench.spec.ts`, `docs/planning/progress-board.html`. This brief is maintained by the main agent. All production views, shared components, public Playwright configuration, backend, contracts and database are read-only. Existing PNGs are read-only in this slice. If a proven root cause requires production changes, additional support files, fonts or reviewed baseline replacement, stop with the exact evidence and proposed minimal files; do not broaden silently.

Use failing tests first, then the smallest correction. Reproduce the two dirty-switch failures and representative screenshot failures before repair. Run the work-session suite and affected geometry checks in all three configured viewports, then the full browser suite with snapshot updates disabled, and affected lint/typecheck/format/repository/calibration/board checks. Report failures and skipped paths honestly. No snapshot tolerance increases, blanket updates, worker restarts to hide state pollution or checks disabled to obtain green CI.

The local test-server guard currently reports a foreign development server on its normal port. Do not stop someone else's process, silently reuse it, or change shared port/probe policy. Use an already authorized test-only environment or report the exact runtime blocker separately from product findings. CI evidence is already available for the original failures.

One grouped HANDOFF must identify actual model, exact changed paths, RED/GREEN evidence, reviewed screenshot differences, all verification results and remaining unknowns. Do not commit or push implementation. The main agent reviews the real diff and integrates the accepted changes on this public branch; the original candidate checkout stays untouched.
