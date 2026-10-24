---
status: review
branch: feat/ui-production-spread-public
owner: main
writer: main
risk: high
dependsOn: []
writeScopes:
  - docs/planning/tasks/ui-production-spread-public-v1.md
  - apps/web/**
exclusiveLocks: []
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
