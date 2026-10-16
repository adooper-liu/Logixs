const STABLE_CODES = new Set([
  "BACKUP_TARGET_NOT_ISOLATED",
  "BACKUP_VERIFICATION_FAILED",
  "BACKUP_DUMP_EMPTY",
  "BACKUP_SOURCE_CHANGED",
  "BACKUP_VERIFICATION_REQUIRED",
  "MINIO_CHECKSUM_MISMATCH",
  "MINIO_COPY_FAILED",
  "TEMPORAL_INVENTORY_CHANGED",
  "RESTORE_TARGET_NOT_ISOLATED",
  "RESTORE_VERIFICATION_FAILED",
  "MANIFEST_INVALID",
  "MANIFEST_HASH_MISMATCH",
  "MANIFEST_STALE",
  "OWNERSHIP_BLOCKERS_PRESENT",
  "DEMO_PURGE_EXECUTE_NOT_AVAILABLE_IN_BRIEF_2",
  "DEMO_MAINTENANCE_ARGUMENTS_INVALID",
  "DEMO_MAINTENANCE_TENANT_DENIED",
  "OUTPUT_MUST_BE_EXTERNAL",
  "RESTORE_CLEANUP_FAILED",
  "RESTORE_RECEIPT_INVALID",
  "RESTORE_RECEIPT_WRITE_FAILED",
]);

export type OperationalFailure = { errorCode: string; traceId: string };

export function operationalFailure(
  error: unknown,
  fallbackCode: string,
  traceId: string,
): OperationalFailure {
  const message = error instanceof Error ? error.message : "";
  return {
    errorCode: STABLE_CODES.has(message) ? message : fallbackCode,
    traceId,
  };
}

export function serializeOperationalError(
  error: unknown,
  fallbackCode: string,
  traceId: string,
): string {
  return JSON.stringify(operationalFailure(error, fallbackCode, traceId));
}
