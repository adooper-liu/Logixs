# Full-chain Demo Backup and Restore Rehearsal

This runbook prepares the recovery evidence required before rebuilding the controlled full-chain sample for tenant `demo-real-sample-20260921`. It covers manifest generation, backup tooling, isolated restore rehearsal, and rollback-only purge rehearsal. It does not authorize a real purge or a sample switch.

## 1. Prerequisites

- Run only against the repository's local Docker PostgreSQL, MinIO, and Temporal services.
- Confirm the three services are healthy before starting.
- Provide PostgreSQL, object-storage, and Temporal connection settings through the approved environment variables; never paste credentials into commands, receipts, or logs.
- Set `DEMO_MAINTENANCE_OUTPUT_ROOT` to an approved external evidence root. Every manifest, dump, and receipt input/output must resolve under that root and outside the repository; existing outputs, symlink/junction escapes, and repository-contained paths are rejected before infrastructure clients are created.
- The PostgreSQL client tools `pg_dump`, `pg_restore`, `createdb`, and `dropdb` must be available to the CLI. The automated integration tests may execute them inside the local PostgreSQL container.
- All rehearsal resources must be created by the current run and be empty before use.

## 2. Generate the ownership manifest

```text
pnpm demo:purge:manifest -- \
  --tenant demo-real-sample-20260921 \
  --output <new-manifest-directory>
```

The command reads PostgreSQL, MinIO, and Temporal only. It writes a canonical external manifest and a redacted receipt. It must fail closed when ownership is unresolved, a global Temporal schedule requires maintenance handling, or any infrastructure inventory fails.

Record:

- catalog, schema, and migration fingerprints;
- domain candidate counts and hashes;
- blocker codes and blocker count;
- the exact manifest hash from the controlled manifest file;
- the redacted receipt.

Do not copy row IDs, object keys, workflow IDs/inputs, business values, credentials, connection strings, or local paths into tickets or logs.

## 3. Create isolated backup artifacts

```text
pnpm demo:backup:create -- \
  --source-manifest <manifest-file> \
  --expected-manifest-hash <exact-source-hash> \
  --target-db logix_rehearsal_<pid>_<16-hex> \
  --target-prefix rehearsal/<run-token> \
  --target-namespace rehearsal-<run-token> \
  --output <new-backup-directory>
```

The command:

1. verifies the exact target tenant and isolation arguments;
2. creates a PostgreSQL custom-format dump and proves `pg_restore --list` can read it;
3. copies only MinIO objects whose ownership is proven by the manifest;
4. streams source and copied object bytes and verifies actual SHA-256 plus size; object metadata alone is never accepted as content proof;
5. re-reads Temporal inventory without pausing, cancelling, terminating, or resetting workflows;
6. proves the source fingerprint did not change;
7. atomically publishes the validated backup manifest and receipt.

Any missing evidence, empty dump, partial copy, checksum mismatch, Temporal drift, or source drift produces an `incomplete` result. Failure cleanup removes only the current run's staging directory and rehearsal prefix; it never deletes source objects.

## 4. Rehearse isolated restore

```text
pnpm demo:restore:rehearse -- \
  --backup-manifest <backup-manifest-file> \
  --expected-backup-manifest-hash <exact-backup-hash> \
  --source-manifest <original-purge-manifest-file> \
  --expected-source-manifest-hash <exact-source-hash> \
  --dump <postgres-dump-file> \
  --output <new-restore-receipt-directory> \
  --target-db logix_rehearsal_<pid>_<16-hex> \
  --target-prefix rehearsal/<run-token> \
  --target-namespace rehearsal-<run-token>
```

The target database URL is derived from the configured source URL so host, port, and user cannot silently fall back to another PostgreSQL instance. Passwords are passed through process environment only and must never appear in command arguments or output.

Restore verification must prove all of the following before reporting completion:

- the backup manifest is verified and references the supplied source manifest hash;
- the restored PostgreSQL catalog inventory, schema fingerprint, and migration fingerprint match;
- the full catalog table-content fingerprint matches the source, covering the target tenant, other tenants, and all preserved global tables;
- the copied MinIO bytes and checksums match;
- Temporal inventory and freeze assumptions remain unchanged;
- source PostgreSQL and three-domain fingerprints are unchanged before and after the rehearsal.

The command always drops only the database created by the current rehearsal and deletes only the exact copied object keys recorded for this run. It publishes a schema-validated, hashed `verified` or `incomplete` restore receipt only after database and object cleanup finish. A failed restore, verification, or cleanup cannot return a verified receipt, and cleanup errors cannot overwrite the primary stable error code.

## 5. Run rollback-only purge rehearsal

```text
pnpm demo:purge:dry-run -- \
  --tenant demo-real-sample-20260921 \
  --manifest <manifest-file> \
  --expected-manifest-hash <exact-hash>
```

The command validates the manifest before creating clients, then collects PostgreSQL inventory, schema/migration fingerprints, and the ImportBatch ownership projection inside the same serializable transaction used by the child-first `DELETE ... RETURNING` rehearsal. It deletes from the transaction's current manifest, compares count and primary-key hash, and forcibly rolls back. MinIO and Temporal remain read-only and are sampled before and after the rollback; any external drift suppresses the success receipt.

A successful receipt means only that the dry-run completed with zero persistent changes. It is not deletion authorization.

## 6. Evidence checklist

Keep the following external evidence together:

- ownership manifest and exact manifest hash;
- catalog, schema, migration, PostgreSQL, MinIO, Temporal, and blocker hashes/counts;
- backup manifest and `verified` receipt;
- isolated restore receipt and source-before/source-after equality evidence;
- rollback-only dry-run receipt;
- temporary database and rehearsal prefix creation/cleanup confirmation;
- Temporal global schedule blocker and future maintenance/freeze requirement.

Receipts and ordinary logs remain redacted. Controlled external manifests may contain the detailed IDs and keys needed for verification, but they must not be committed or pasted into general-purpose logs.

## 7. Explicitly prohibited in Brief 2

- real demo purge or any `--execute` path;
- adapter writes for the v0.5 sample package;
- deletion of reference data, migrations, other-tenant data, or Temporal data;
- source MinIO object deletion;
- Temporal pause, unpause, cancel, terminate, reset, or database dump;
- production API, Controller, capability, or UI entry points;
- page switching or claims that the rebuilt sample is live.

## 8. Future authorization gate

A later brief may propose a real demo purge only after all of these exist for the same frozen source state:

1. exact manifest hash;
2. verified backup manifest and isolated restore receipt;
3. rollback-only dry-run receipt;
4. explicit global schedule maintenance/freeze plan;
5. proof that the source state did not drift;
6. owner confirmation for that specific execution.

Any changed count, hash, blocker set, schema, migration, object metadata, or Temporal state invalidates the prior evidence and requires regeneration.

## 9. Current execution status

As of 2026-10-11:

- local isolated PostgreSQL/MinIO/Temporal integration rehearsals: run by automated tests;
- real demo PostgreSQL backup: **not run**;
- real demo MinIO copy: **not run**;
- real Temporal freeze or pause: **not run**;
- real demo purge: **not run**;
- v0.5 package adapter write: **not run**;
- UI data switch and business acceptance: **not run**.
