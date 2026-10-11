import { describe, expect, it } from "vitest";
import {
  operationalFailure,
  serializeOperationalError,
} from "./operational-errors";

describe("operational error redaction", () => {
  it("maps raw infrastructure errors to stable codes without leaking details", () => {
    const failure = operationalFailure(
      new Error(
        "spawn pg_dump --dbname postgresql://user:SENTINEL_PASSWORD@host/db --file C:\\SENTINEL_PATH\\dump failed",
      ),
      "BACKUP_VERIFICATION_FAILED",
      "trace-123",
    );

    expect(failure).toEqual({
      errorCode: "BACKUP_VERIFICATION_FAILED",
      traceId: "trace-123",
    });
    expect(JSON.stringify(failure)).not.toContain("SENTINEL_PASSWORD");
    expect(JSON.stringify(failure)).not.toContain("SENTINEL_PATH");
  });

  it("serializes only the stable code and trace id", () => {
    const serialized = serializeOperationalError(
      new Error("MANIFEST_STALE:SENTINEL_PATH"),
      "MANIFEST_STALE",
      "trace-789",
    );

    expect(JSON.parse(serialized)).toEqual({
      errorCode: "MANIFEST_STALE",
      traceId: "trace-789",
    });
    expect(serialized).not.toContain("SENTINEL_PATH");
  });
});
