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

## Delivery priority decision

On 2026-10-25 the project owner confirmed business-first, workbench-by-workbench delivery. Standalone whole-repository UI spreading stops. Each future business slice delivers its required UI together with role tasks, authoritative facts, technical safeguards and permissions, with observable results in the existing page. Existing UI standards remain reusable guidance, not an independent prerequisite for business implementation.

This PR preserves the reviewed UI work and is limited to necessary operational, safety and CI/integration recovery. No new workbench or presentation-only expansion is authorized by this brief. Open CI failures are not waived and the PR must not claim completion before its applicable gates pass. Independent business discovery and implementation that does not depend on this unmerged code need not wait for this PR. Any real code dependency must be named explicitly rather than assumed merged.

## CI recovery slice

The public release branch includes a generated progress board and browser-fixture corrections. The fixture correction keeps exact task/work-order binding, enters the visible mobile work pane before editing, verifies the edited value, and preserves the supported dirty-switch choices. No production component, public configuration, API, contract, database or snapshot tolerance is changed by this slice.

### Verification

Run calibration, board, repository, documentation, lint, typecheck, build, formatting, focused work-session tests and affected browser checks. Use snapshot updates only when a reviewed visual cause is established; otherwise report the visual difference. Keep full release validation and external business acceptance as separate gates.

### Recovery delta `session-overlay-and-visual-parity`

The reviewed source files belong to this PR even while the current repair changes only tests. The missing `apps/web/src/**` declaration has been restored; calibration and board freshness pass locally. Do not remove that declaration when editing the public summary.

The latest completed browser run has 546 passing, 81 skipped and 19 failing tests. The two mobile dirty-switch tests now pass. Four desktop/narrow executions of those tests fail because a lifecycle rail button intercepts clicks on a visible session menu item. The downloaded error context proves pointer interception, not a missing list or popup blocker. Static tracing confirms the header and the later lifecycle rail establish equal raised stacking levels; the session panel cannot escape its parent header stacking context. This is a current shared presentation defect, not a dirty-state policy change.

The remaining fifteen screenshot failures still require evidence-based visual parity diagnosis. The downloaded actual/expected/diff artifacts are available for direct inspection. Stable pane boundaries with widespread text changes suggest rendering differences, but a specific font or browser cause has not yet been proven. Do not describe that hypothesis as a confirmed cause or replace all baselines to obtain green CI.

#### Exact repair scope

The implementation executor may modify only `apps/web/src/components/workbench/WorkbenchLayout.vue`, `apps/web/src/components/workbench/WorkbenchLayout.test.ts`, `apps/web/e2e/recoverable-work-sessions.spec.ts`, `apps/web/e2e/shell-layout.spec.ts` for the proven overlay defect. Keep the smallest neutral stacking correction and do not raise the entire header over unrelated global navigation, drawers or command surfaces. Preserve the rail's normal interaction. Prove real pointer selection and dirty/new-tab choices in both ProductSelection and Stuffing at desktop, narrow and mobile sizes. Do not force clicks or use longer timeouts as a fix. Add a focused regression before the correction.

For visual-parity diagnosis the executor may inspect the four affected geometry specs, the existing Playwright setup, computed font/style data and the downloaded CI artifacts. Those extra files and all PNGs remain read-only until a specific cause and smallest change set are identified. If visual parity requires font assets, shared test configuration, production typography or baseline replacement, return the exact proposal and evidence in the same HANDOFF instead of silently changing it. The overlay repair may be handed back independently of that unresolved visual diagnosis, without claiming all E2E pass.

Do not stop or reuse an unrelated development server, weaken the server identity guard, edit shared port policy, skip tests, change visual thresholds or modify the original candidate checkout. A local port conflict is a runtime blocker, not product verification. Use an available authorized test environment or explicitly record which browser checks could not run.

#### Verification and handoff

Run focused layout tests, both consumers' real session-switch interactions across three viewports, the affected browser combination and the closest lint/typecheck/build/format checks. Preserve dirty values and existing snapshot hashes. Report pass/fail/not-run, all remaining screenshot differences and actual implementation model. No new full-repository review is required; review is limited to this shared stacking delta and any explicitly proposed visual-parity change. No commit or push by the implementation executor. The main agent maintains this brief and regenerates the board during integration.

### Stop conditions

Changes beyond the exact repair scope, new business or authorization semantics, new dependencies/fonts, shared test configuration, snapshot replacement or unrelated service/process changes require a concrete evidence-backed proposal. Do not weaken exact context binding, disable checks, stop unrelated local services or include internal paths, temporary logs or private provenance in public documentation.
