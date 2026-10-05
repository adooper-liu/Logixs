import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateCurrencyReferenceSnapshot,
  ISO_4217_LIST_ONE_URL,
  validateAuthorizedCurrencyReferenceSnapshot,
  validateCurrencyReferenceSnapshot,
} from "./generate-currency-reference-snapshot.mjs";

describe("currency reference snapshot generator", () => {
  it("folds duplicate territory rows and generates deterministic currency identities", () => {
    const snapshot = generateCurrencyReferenceSnapshot(
      fixture([
        currency("USD", "840", 2, "US Dollar"),
        currency("USD", "840", 2, "US Dollar"),
        currency("XUA", "965", null, "ADB Unit of Account"),
      ]),
    );
    assert.equal(snapshot.recordCount, 2);
    assert.deepEqual(
      snapshot.records.map(({ alphaCode }) => alphaCode),
      ["USD", "XUA"],
    );
    assert.equal(snapshot.records[1].minorUnit, null);
    assert.match(snapshot.release.recordsSha256, /^[0-9a-f]{64}$/);
  });

  it("rejects conflicting duplicate currency metadata", () => {
    assert.throws(
      () =>
        generateCurrencyReferenceSnapshot(
          fixture([
            currency("USD", "840", 2, "US Dollar"),
            currency("USD", "840", 3, "US Dollar"),
          ]),
        ),
      /Conflicting currency metadata: USD/,
    );
  });

  it("never accepts a synthetic rehearsal as active", () => {
    const input = fixture([currency("USD", "840", 2, "US Dollar")]);
    input.release.status = "active";
    assert.throws(
      () => generateCurrencyReferenceSnapshot(input),
      /must remain staged/,
    );
  });

  it("strictly validates a generated authorized snapshot and its hashes", () => {
    const input = fixture([currency("USD", "840", 2, "US Dollar")]);
    input.fixtureKind = "authorized_official";
    input.release.status = "active";
    input.release.license = "Authorized deployment evidence";
    const snapshot = generateCurrencyReferenceSnapshot(input);

    assert.deepEqual(validateCurrencyReferenceSnapshot(snapshot), snapshot);
    assert.deepEqual(
      validateAuthorizedCurrencyReferenceSnapshot(snapshot),
      snapshot,
    );

    const corrupted = structuredClone(snapshot);
    corrupted.records[0].currencyName = "Corrupted";
    assert.throws(
      () => validateCurrencyReferenceSnapshot(corrupted),
      /Currency records hash mismatch/,
    );
  });

  it("never authorizes a synthetic snapshot for import", () => {
    const snapshot = generateCurrencyReferenceSnapshot(
      fixture([currency("USD", "840", 2, "US Dollar")]),
    );
    assert.throws(
      () => validateAuthorizedCurrencyReferenceSnapshot(snapshot),
      /REQUIRES_AUTHORIZED_OFFICIAL/,
    );
  });
});

function fixture(records) {
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
    records,
  };
}

function currency(alphaCode, numericCode, minorUnit, currencyName) {
  return { alphaCode, numericCode, minorUnit, currencyName };
}
