---
name: logix-domain-review
description: Review proposed or implemented Logix business rules involving containers, shipments, lifecycle states, events, imports, markers, actions, time fields, or demurrage. Use for domain design and domain-focused code review, not routine UI copy or styling.
---

# Logix Domain Review

Review domain changes against their authoritative definitions without duplicating those definitions here.

1. Read `docs/INDEX.md`, then open only the domain documents governing the changed concepts. Record each source's status: accepted, owner-confirmed, baseline, candidate, snapshot, or review input.
2. Trace the change through the repository's required chain:

   `evidence (S/R/O/C) -> stable catalog or rule -> persisted contract -> visualization -> user action`

   Flag any behavior that cannot be traced, any candidate presented as settled fact, and any copied rule that can drift from its authority.
3. Check these invariants when relevant:
   - Lifecycle transitions come from the authoritative state machine; exceptions remain orthogonal unless explicitly modeled.
   - State, event, action, marker, field, and error identifiers have one stable definition.
   - External values pass through explicit mappings; unknown values fail explicitly or enter a review queue.
   - Planned, estimated, and actual times retain distinct semantics; persistence uses UTC and exchange uses ISO 8601.
   - Money uses fixed-point decimal plus currency, with an explicit calculation basis.
   - Source authority, manual locks, historical sealing, idempotency, and audit evidence are preserved.
   - AI suggestions, human decisions, business facts, and execution results remain distinguishable and traceable.
4. Review success, rejection, boundary, replay, and concurrency behavior. For imports, also require preflight, transactionality, duplicate detection, row-level errors, reconciliation, and recovery.
5. Report findings first, ordered by severity, with file and line references. For each finding, identify the violated authority, concrete consequence, and compliant path. Do not rewrite candidate decisions during a read-only review.

If no defect is found, state that clearly and list the remaining evidence or test gaps.
