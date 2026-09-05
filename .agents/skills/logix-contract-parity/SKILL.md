---
name: logix-contract-parity
description: Change or review shared Logix DTOs, enums, events, status codes, OpenAPI, JSON Schema, TypeScript/Python contracts, or generated API clients while preventing cross-language and runtime contract drift. Do not use for private implementation types with no shared boundary.
---

# Logix Contract Parity

Keep shared contracts derived from one authority and compatible across consumers.

1. Identify the contract's authoritative source and every consumer before editing. Shared definitions belong in formal public packages; application internals must not become an accidental contract.
2. Classify the change as additive-compatible, behavior-changing, or breaking. For behavior-changing or breaking work, state affected clients, stored data, events, workflows, and compatibility strategy before implementation.
3. Preserve one stable definition for DTO fields, enums, status/event/action codes, nullability, formats, and error codes. Generate or derive TypeScript, Python, JSON Schema, OpenAPI, fixtures, and evaluation data where supported; do not hand-maintain equivalent lists in multiple places.
4. Keep database entities separate from API and AI contracts through explicit mapping. External vendor models must terminate at adapters and map into stable internal identifiers.
5. Validate boundary semantics:
   - Inputs specify structure, type, length, format, and business preconditions.
   - Errors use stable codes and trace IDs without exposing internals.
   - Lists define pagination, maximum page size, and stable ordering.
   - Events define name, version, unique ID, occurrence time, and correlation ID.
   - Time and money follow the repository's UTC/ISO 8601 and decimal-plus-currency rules.
6. Update all derived artifacts and parity registrations in the same change. Run the closest contract tests, generation drift check, type checks, and consumer tests. A missing generator or parity command is an explicit project gap, never a reason to claim parity.
7. Do not silently reinterpret or remove existing wire values. Use a new version or documented compatibility period for breaking changes, and require the designated contract/domain reviewers.

Report the authority, compatibility class, updated consumers, commands actually run, unavailable gates, and residual migration risk.
