import { describe, expect, it } from "vitest";
import {
  ExternalWorkItemValidationError,
  normalizeExternalWorkItemProjection,
} from "./external-work-item";

describe("normalizeExternalWorkItemProjection", () => {
  it("normalizes evidence and produces stable hashes", () => {
    const first = normalizeExternalWorkItemProjection(command());
    const second = normalizeExternalWorkItemProjection(command());

    expect(first.projectionHash).toBe(second.projectionHash);
    expect(first.items[0]?.evidenceRefs).toEqual(["evidence-1", "evidence-2"]);
    expect(first.items[0]?.dueAt?.toISOString()).toBe(
      "2026-09-21T08:00:00.000Z",
    );
  });

  it("rejects duplicate source keys and non-ISO instants", () => {
    const duplicate = command();
    duplicate.items.push({ ...duplicate.items[0]! });
    expect(() => normalizeExternalWorkItemProjection(duplicate)).toThrow(
      "VALIDATION_CONFLICT: sourceItemKey",
    );
    expect(() =>
      normalizeExternalWorkItemProjection({
        ...command(),
        items: [{ ...command().items[0]!, dueAt: "2026-09-21 08:00" }],
      }),
    ).toThrow(ExternalWorkItemValidationError);
  });

  it("accepts up to 5000 items and rejects larger projections", () => {
    const item = command().items[0]!;
    const items = Array.from({ length: 5000 }, (_, index) => ({
      ...item,
      sourceItemKey: `finding-${index}`,
    }));

    expect(
      normalizeExternalWorkItemProjection({ ...command(), items }).items,
    ).toHaveLength(5000);
    expect(() =>
      normalizeExternalWorkItemProjection({
        ...command(),
        items: [...items, { ...item, sourceItemKey: "finding-5000" }],
      }),
    ).toThrow("VALIDATION_RANGE: items");
  });
});

function command() {
  return {
    tenantId: "tenant-1",
    sourceModule: "compliance-management",
    sourceType: "cargo_ready_compliance_assessment",
    sourceScopeId: "container:container-1:cargo_ready",
    sourceRecordId: "assessment-1",
    sourceVersion: 1,
    containerId: "container-1",
    items: [
      {
        sourceItemKey: "MISSING_CERTIFICATE:sku-1:no-rule:0",
        taskDefinitionKey: "compliance-remediation:MISSING_CERTIFICATE",
        title: "补齐证书",
        detail: "certificate is missing",
        priority: "high" as const,
        assignedRoleCode: "review_supervisor",
        evidenceRefs: ["evidence-2", "evidence-1", "evidence-2"],
        dueAt: "2026-09-21T08:00:00.000Z",
      },
    ],
  };
}
