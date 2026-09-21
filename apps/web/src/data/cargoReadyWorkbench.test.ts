import { describe, expect, it } from "vitest";
import type { CargoReadyComplianceAssessment } from "../api/cargoReadyCompliance";
import type { ContainerCargoScope } from "../api/containers";
import type { NodeTaskDetail } from "../api/nodeTasks";
import {
  buildCargoReadyQueue,
  buildCargoReadySkuReadiness,
  filterCargoReadyQueue,
} from "./cargoReadyWorkbench";

describe("cargo-ready workbench presentation", () => {
  it("orders overdue work first and exposes business filters", () => {
    const items = buildCargoReadyQueue({
      tasks: [
        task("later", "2026-09-26T00:00:00.000Z"),
        task("late", "2026-09-20T00:00:00.000Z"),
      ],
      containers: [container("c1")],
      actorId: "dev-operator",
      now: new Date("2026-09-21T00:00:00.000Z"),
    });

    expect(items.map((item) => item.task.id)).toEqual(["late", "later"]);
    expect(items[0]?.urgencyLabel).toBe("已逾期");
    expect(filterCargoReadyQueue(items, "mine")).toHaveLength(2);
    expect(filterCargoReadyQueue(items, "executable")).toHaveLength(2);
  });

  it("does not infer readiness without a current assessment snapshot", () => {
    const readiness = buildCargoReadySkuReadiness({
      cargo,
      assessment: null,
      remediationItems: [],
    });

    expect(readiness[0]).toMatchObject({
      overall: "unreviewed",
      battery: { state: "unreviewed", label: "未评审" },
      responsibleRole: "合规评审岗",
    });
  });

  it("maps verified findings to per-SKU blockers and next responsibility", () => {
    const readiness = buildCargoReadySkuReadiness({
      cargo,
      assessment: assessment({
        findings: [
          {
            code: "BATTERY_CLASSIFICATION_UNDETERMINED",
            productSkuId: "sku-1",
            ruleVersionId: null,
            detail: "unknown",
          },
        ],
      }),
      remediationItems: [
        {
          id: "wi-1",
          sourceModule: "compliance-management",
          sourceType: "cargo_ready_assessment",
          sourceRecordId: "assessment-1",
          sourceVersion: 1,
          containerId: "c1",
          taskDefinitionKey: "cargo-ready-remediation",
          title: "确认电池属性",
          detail: "电池属性未知",
          priority: "high",
          state: "open",
          assignedRoleCode: "compliance_operator",
          evidenceRefs: [],
          dueAt: null,
          createdAt: "2026-09-21T00:00:00.000Z",
        },
      ],
    });

    expect(readiness[0]).toMatchObject({
      overall: "missing",
      battery: { state: "attention", label: "待确认" },
      dangerousGoods: { state: "ready", label: "已确认" },
      responsibleRole: "合规整改责任岗",
      nextAction: "确认电池属性",
    });
  });
});

const cargo: ContainerCargoScope = {
  containerRecordId: "c1",
  allocationSetId: "allocation-1",
  allocationSetVersion: 2,
  items: [
    {
      replenishmentOrderLineId: "line-1",
      productSkuId: "sku-1",
      productNumber: "833-066V00BK",
      allocatedQuantity: "50",
      quantityUnit: "carton",
    },
  ],
};

function task(id: string, dueAt: string): NodeTaskDetail {
  return {
    id,
    flowInstanceId: "flow-1",
    nodeInstanceId: `node-${id}`,
    nodeCode: "cargo_ready",
    containerId: "c1",
    taskDefinitionKey: "node-cargo_ready",
    state: "pending",
    applicability: "required",
    readinessState: "ready",
    completionEligibility: "eligible",
    conditionFactRefs: [],
    workOrders: [],
    outcome: null,
    nextAction: {
      actionCode: "work_execution.complete_work_order",
      workOrderId: `wo-${id}`,
      workOrderDefinitionKey: "wo-cargo_ready",
      assignmentState: "assigned",
      assigneeId: "dev-operator",
      dueAt,
    },
  };
}

function container(id: string) {
  return {
    id,
    orderNumber: "26DSS00033",
    containerNumber: "KOCU4960726",
    currentStatus: "not_shipped" as const,
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
}

function assessment(
  override: Partial<CargoReadyComplianceAssessment> = {},
): CargoReadyComplianceAssessment {
  return {
    assessmentId: "assessment-1",
    containerRecordId: "c1",
    version: 1,
    state: "action_required",
    jurisdictionCountryCode: "ES",
    assessmentDate: "2026-09-21",
    allocationSetId: "allocation-1",
    allocationSetVersion: 2,
    items: [
      {
        replenishmentOrderLineId: "line-1",
        productSkuId: "sku-1",
        productNumber: "833-066V00BK",
        complianceProfileId: "profile-1",
        complianceProfileVersion: 1,
      },
    ],
    findings: [],
    applicableRules: [],
    evidenceRefs: [],
    actorId: "reviewer",
    reasonCode: "initial",
    currentDecision: null,
    createdAt: "2026-09-21T00:00:00.000Z",
    ...override,
  };
}
