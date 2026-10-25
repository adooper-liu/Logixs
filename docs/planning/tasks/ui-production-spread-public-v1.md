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

### Overlay repair handoff

The implementation handoff reports a one-line neutral repair: the workbench header moves from the raised-content level to one level above it, remaining below backdrop, sidebar and command levels. The source baseline was followed by documentation-only priority updates; review covers the actual current diff, not an assumed clean original baseline. No other product file, snapshot or threshold was changed.

The main agent reran layout and frame regression tests: 52/52 passed, with Web lint, typecheck, build, post-build formatting, targeted formatting, repository and board checks passing. A scoped read-only stacking review found no remaining static finding; it did not execute browser tests. This establishes a reviewed candidate, not post-fix browser acceptance.

The main agent verified that the preceding CI run passes static, unit and build. Its E2E and aggregate quality checks still fail; the handoff is partial, not full browser acceptance. Local browser verification remains unavailable because the server identity guard rejects the existing development listener; it was not stopped or reused. CI must verify real-pointer session selection after this repair. The fifteen visual comparisons and mobile session-menu state difference remain unresolved; no font root cause is declared and no baseline update is authorized by this handoff.

### CI verification after overlay repair

At published commit `6de839bb`, CI static, unit and build pass. Browser results are 550 passed, 81 skipped and 15 failed, with every remaining failure at a screenshot comparison. The four desktop/narrow session-selection pointer failures no longer occur. This closes the observed overlay interaction defect at the CI consumer boundary; it does not close the visual comparisons or make aggregate quality green.

The main agent confirmed the local Playwright version is 1.63.0, matching the reported CI trace version; browser-library version mismatch is not currently supported as the root cause. Reviewed geometry PNGs are unchanged from the initial public code commit. No baseline replacement, tolerance change, production typography change or new UI rollout is included. Continue with a narrow visual evidence investigation, including the mobile session-menu queue/detail state difference, before proposing a repair.

### Visual evidence disposition

A narrow read-only review of downloaded CI artifacts separates two cases. In the sampled Unloading mobile comparison, business text, values, states and card positions agree, while differences concentrate on glyphs, weight and text baselines. The actual resolved font and rendering cause remain unproven; this does not authorize production typography changes or blanket baseline replacement. This sample must not be generalized to all other geometry snapshots without comparison.

The Stuffing mobile work-session menu comparison is not merely text rendering: its expected background is the old queue, while the actual background is the detail/Stuffing-review pane; current-session ordering and the page scroll position also differ. The next repair is limited to `apps/web/e2e/recoverable-work-sessions.spec.ts`: establish the intended visible background pane, readiness and deterministic session ordering/scroll conditions using the existing supported UI before taking the menu snapshot. Do not sort in the browser only to conceal incorrect production ordering, force input into inactive panes, or reset navigation independently of the session semantics. Any discovered production defect must be reported with its failing scenario rather than hidden by the test.

First verify real session selection, dirty choices and new-tab behavior continue to pass with snapshot updates disabled. Then compare the stabilized expected/actual pair. A changed baseline may be proposed only for the specific reviewed snapshot with its intended pane/order/scroll state and explicit before/after evidence; no PNG change is authorized by this disposition. Other geometry specs, shared configuration, fonts and production CSS remain read-only. The original candidate checkout remains untouched.

### Execution slice `public-snapshot-state`

Write only `apps/web/e2e/recoverable-work-sessions.spec.ts`. Keep both ProductSelection and Stuffing cases, and keep all six desktop/narrow/mobile session-menu checks. Observe the supported current-context/pointer behavior first; after it settles, select the intended background pane via real navigation if needed. Assert that pane, the current-session identity and the expected service-provided order before capture. Stabilize fixture timestamps or delayed responses only where the test owns them; do not reorder production DOM or silently change the meaning of restore pointers. Distinguish intentional page scrolling from an accidental captured offset.

The initial failure is the published mobile Stuffing expected/actual state mismatch. The required result is a deterministic, semantically correct snapshot state and preserved real session switching, dirty choices and new-tab behavior. Do not promise pixel GREEN while text-rendering differences remain. No PNG edits, threshold changes, shared runner/config changes, new ports, forced clicks, sleeps or production changes are permitted. If the current pointer restore itself violates an established requirement, report that scenario instead of hiding it in the test.

Run the closest spec lint, Web typecheck, targeted formatting and repository checks. Run the session suite with snapshots disabled for updates in a clean authorized local test environment if available. If the protected development listener still prevents startup, return the actual blocked command once, plus the code-level assertions and exact CI tests required; do not repeat full suites that cannot start. Return one HANDOFF with actual model, changed paths, all pass/fail/not-run results and a precise baseline proposal only if still needed. Do not commit or push. The main agent performs the final before/after visual review and integration; no new fresh whole-task review is needed.

### Snapshot-state handoff review

The implementation handoff changes only `apps/web/e2e/recoverable-work-sessions.spec.ts`. It waits for the initial session-list response, controls initial fixture response ordering for the Stuffing screenshot case, selects the intended mobile background pane through normal navigation, checks the exact current session and service-provided order, and asserts menu opening preserves the measured page scroll position. Production code, PNGs, thresholds and shared configuration are unchanged. The initial-response ordering belongs to this visual fixture; it is not evidence that arbitrary production request ordering has been verified.

The main agent independently reran spec ESLint, Web typecheck, targeted formatting and repository policy checks: all passed. Playwright test discovery retains all 63 session cases across the three configured viewports. Test listing is not browser execution. Local browser execution remains unverified because the protected development listener prevents global setup; no post-fix screenshot comparison or end-to-end GREEN is claimed. Integrate this as a CI verification candidate and inspect the resulting assertions and specific mobile snapshot before deciding whether any baseline change is justified. Existing unresolved text-rendering comparisons remain open.

### CI result and ordering residual `public-snapshot-order`

At commit `5df1e6a9`, static, unit and build pass. E2E reports 550 passed, 81 skipped and 15 failed tests. Most executions fail screenshot comparison, but the Stuffing mobile session-menu retry also fails the newly added order assertion: the service returns Selection then Stuffing, while the visible list is Stuffing then Selection. Therefore this run does not prove snapshot-state stabilization, and not every failed execution is a pixel failure.

The current fixture releases its initial-data barrier when the list request handler begins, before the list response has been fulfilled and consumed. Waiting for that HTTP response does not prove the client has installed the list or completed pointer restoration. The existing session consumer can prepend an opened session and invalidate an older list response. This explains a plausible ordering race; the exact request schedule still requires a failing runtime probe, not merely static inference. There is no established general current-session-first ordering policy that permits changing the assertion to accept any order.

Only `apps/web/e2e/recoverable-work-sessions.spec.ts` may change in this repair. Reproduce the two response schedules using fixture-owned deferred requests, then make the screenshot fixture establish a deterministic initial list and settled current-context restoration before choosing the intended pane and opening the menu. Use observable application state and existing fixture callbacks, not arbitrary sleeps, forced clicks, DOM sorting, additional manual fetches as a surrogate for client readiness, or acceptance of either ordering. Preserve all session-menu cases, exact current-session identity, dirty choices and new-tab coverage. If slow-list ordering reveals lost sessions or another production correctness defect, report its exact failure and minimal production scope instead of hiding it in the visual test.

Do not change production code, PNGs, thresholds, typography, shared configuration or ports. Verify the targeted spec's lint, typecheck, format and repository checks; run focused session-menu checks when a clean authorized browser environment is available. Do not repeat attempts against the protected development listener. Browser not-run and remaining pixel failures must remain explicit. Return one grouped HANDOFF with the observed response schedule, assertions, results and remaining unknowns; do not commit or push. Other fourteen geometry comparisons are not included in this repair.

### Stop conditions

Changes beyond the exact repair scope, new business or authorization semantics, new dependencies/fonts, shared test configuration, snapshot replacement or unrelated service/process changes require a concrete evidence-backed proposal. Do not weaken exact context binding, disable checks, stop unrelated local services or include internal paths, temporary logs or private provenance in public documentation.
