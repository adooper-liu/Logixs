import { describe, expect, it, vi } from "vitest";
import { collectDatabaseContentFingerprint } from "./postgres-fingerprint";

describe("database content fingerprint", () => {
  it("hashes every catalog table and migrations in stable order", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM "alpha"'))
        return {
          rows: [{ row_json: '{"id":"2"}' }, { row_json: '{"id":"1"}' }],
        };
      if (sql.includes('FROM "beta"'))
        return { rows: [{ row_json: '{"id":"b"}' }] };
      if (sql.includes('FROM "_prisma_migrations"'))
        return { rows: [{ row_json: '{"migration_name":"one"}' }] };
      return { rows: [] };
    });

    const first = await collectDatabaseContentFingerprint({ query }, [
      "beta",
      "alpha",
    ]);
    const second = await collectDatabaseContentFingerprint({ query }, [
      "alpha",
      "beta",
    ]);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('FROM "alpha"'),
        expect.stringContaining('FROM "beta"'),
        expect.stringContaining('FROM "_prisma_migrations"'),
      ]),
    );
  });

  it("rejects untrusted table identifiers before querying", async () => {
    const query = vi.fn();

    await expect(
      collectDatabaseContentFingerprint({ query }, ["safe; DROP TABLE x"]),
    ).rejects.toThrow("OWNERSHIP_IDENTIFIER_INVALID");
    expect(query).not.toHaveBeenCalled();
  });
});
