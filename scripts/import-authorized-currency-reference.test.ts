import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "../generated/prisma/index.js";
import {
  generateCurrencyReferenceSnapshot,
  ISO_4217_LIST_ONE_URL,
} from "./generate-currency-reference-snapshot.mjs";
import {
  importAuthorizedCurrencyReference,
  type AuthorizedCurrencySnapshot,
} from "./import-authorized-currency-reference.mjs";
import { verifyCurrencyReferenceData } from "./verify-currency-reference-data.mjs";

describe("authorized currency reference importer", () => {
  it("imports, verifies, supersedes and activates in one transaction", async () => {
    const snapshot = officialSnapshot();
    const calls: string[] = [];
    let supersedeWhere: unknown;
    const transaction = {
      referenceDataRelease: {
        findUnique: async () => null,
        create: async () => calls.push("release:create:staged"),
        updateMany: async (args: { where: unknown }) => {
          supersedeWhere = args.where;
          calls.push("release:supersede-active");
        },
        update: async () => calls.push("release:activate"),
      },
      currencyCodeReference: {
        createMany: async () => {
          calls.push("currency:create-many");
          return { count: snapshot.recordCount };
        },
        findMany: async () => snapshot.records,
      },
    };
    let transactionCount = 0;
    const prisma = {
      $transaction: async (
        operation: (client: typeof transaction) => Promise<unknown>,
      ) => {
        transactionCount += 1;
        return operation(transaction);
      },
    } as unknown as PrismaClient;

    await assert.doesNotReject(async () => {
      const result = await importAuthorizedCurrencyReference(prisma, snapshot);
      assert.deepEqual(result, {
        releaseId: snapshot.release.id,
        version: snapshot.release.version,
        recordCount: snapshot.recordCount,
        status: "active",
        duplicate: false,
      });
    });
    assert.equal(transactionCount, 1);
    assert.deepEqual(calls, [
      "release:create:staged",
      "currency:create-many",
      "release:supersede-active",
      "release:activate",
    ]);
    assert.deepEqual(supersedeWhere, {
      authority: "SIX",
      datasetCode: "ISO_4217_LIST_ONE",
      status: "active",
      id: { not: snapshot.release.id },
    });
  });

  it("rejects synthetic input before opening a transaction", async () => {
    let transactionCount = 0;
    const prisma = {
      $transaction: async () => {
        transactionCount += 1;
      },
    } as unknown as PrismaClient;

    await assert.rejects(
      importAuthorizedCurrencyReference(prisma, syntheticSnapshot()),
      /CURRENCY_REFERENCE_IMPORT_REQUIRES_AUTHORIZED_OFFICIAL/,
    );
    assert.equal(transactionCount, 0);
  });

  it("stops before activation when inserted count does not match", async () => {
    const snapshot = officialSnapshot();
    let activated = false;
    const transaction = {
      referenceDataRelease: {
        findUnique: async () => null,
        create: async () => undefined,
        updateMany: async () => undefined,
        update: async () => {
          activated = true;
        },
      },
      currencyCodeReference: {
        createMany: async () => ({ count: snapshot.recordCount - 1 }),
        findMany: async () => snapshot.records,
      },
    };
    const prisma = transactionClient(transaction);

    await assert.rejects(
      importAuthorizedCurrencyReference(prisma, snapshot),
      /CURRENCY_REFERENCE_COUNT_MISMATCH/,
    );
    assert.equal(activated, false);
  });

  it("rejects an existing conflicting release before changing active state", async () => {
    const snapshot = officialSnapshot();
    let activeStateChanged = false;
    const transaction = {
      referenceDataRelease: {
        findUnique: async () => ({
          ...storedRelease(snapshot),
          sourceSha256: "f".repeat(64),
        }),
        create: async () => undefined,
        updateMany: async () => {
          activeStateChanged = true;
        },
        update: async () => {
          activeStateChanged = true;
        },
      },
      currencyCodeReference: {
        createMany: async () => ({ count: snapshot.recordCount }),
        findMany: async () => snapshot.records,
      },
    };

    await assert.rejects(
      importAuthorizedCurrencyReference(
        transactionClient(transaction),
        snapshot,
      ),
      /CURRENCY_REFERENCE_RELEASE_CONFLICT/,
    );
    assert.equal(activeStateChanged, false);
  });
});

describe("currency reference verifier", () => {
  it("rebuilds and validates the only active authorized release", async () => {
    const snapshot = officialSnapshot();
    let activeWhere: unknown;
    const prisma = {
      referenceDataRelease: {
        findMany: async (args: { where: unknown }) => {
          activeWhere = args.where;
          return [storedRelease(snapshot)];
        },
      },
    } as unknown as PrismaClient;

    await assert.doesNotReject(async () => {
      const result = await verifyCurrencyReferenceData(prisma);
      assert.deepEqual(result, {
        releaseId: snapshot.release.id,
        version: snapshot.release.version,
        recordCount: snapshot.recordCount,
      });
    });
    assert.deepEqual(activeWhere, {
      authority: "SIX",
      datasetCode: "ISO_4217_LIST_ONE",
      status: "active",
    });
  });

  it("reports unavailable when no official release is active", async () => {
    const prisma = {
      referenceDataRelease: { findMany: async () => [] },
    } as unknown as PrismaClient;

    await assert.rejects(
      verifyCurrencyReferenceData(prisma),
      /REFERENCE_CURRENCY_RELEASE_UNAVAILABLE/,
    );
  });
});

function transactionClient(transaction: object): PrismaClient {
  return {
    $transaction: async (operation: (client: object) => Promise<unknown>) =>
      operation(transaction),
  } as unknown as PrismaClient;
}

function officialSnapshot(): AuthorizedCurrencySnapshot {
  const input = sourceInput();
  input.fixtureKind = "authorized_official";
  input.release.status = "active";
  input.release.license = "Authorized official List One deployment evidence";
  return generateCurrencyReferenceSnapshot(input) as AuthorizedCurrencySnapshot;
}

function syntheticSnapshot() {
  return generateCurrencyReferenceSnapshot(sourceInput());
}

function sourceInput() {
  return {
    schemaVersion: "1.0.0",
    fixtureKind: "synthetic_rehearsal",
    release: {
      authority: "SIX",
      datasetCode: "ISO_4217_LIST_ONE",
      version: "2026-09-17",
      publishedAt: "2026-09-17",
      sourceUrl: ISO_4217_LIST_ONE_URL,
      retrievedAt: "2026-10-04T00:00:00.000Z",
      sourceSha256: "0".repeat(64),
      license: "Synthetic test data; not licensed official List One data",
      status: "staged",
    },
    records: [
      {
        alphaCode: "EUR",
        numericCode: "978",
        minorUnit: 2,
        currencyName: "Euro",
      },
      {
        alphaCode: "USD",
        numericCode: "840",
        minorUnit: 2,
        currencyName: "US Dollar",
      },
    ],
  };
}

function storedRelease(snapshot: AuthorizedCurrencySnapshot) {
  return {
    id: snapshot.release.id,
    authority: snapshot.release.authority,
    datasetCode: snapshot.release.datasetCode,
    version: snapshot.release.version,
    publishedAt: new Date(`${snapshot.release.publishedAt}T00:00:00.000Z`),
    sourceUrl: snapshot.release.sourceUrl,
    retrievedAt: new Date(snapshot.release.retrievedAt),
    sourceSha256: snapshot.release.sourceSha256,
    recordsSha256: snapshot.release.recordsSha256,
    license: snapshot.release.license,
    filterRule: "authorized_official",
    status: "active",
    createdAt: new Date("2026-10-05T00:00:00.000Z"),
    currencyCodes: snapshot.records.map((record) => ({
      ...record,
      releaseId: snapshot.release.id,
      createdAt: new Date("2026-10-05T00:00:00.000Z"),
    })),
  };
}
