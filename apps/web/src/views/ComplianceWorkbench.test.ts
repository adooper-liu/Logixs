import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ComplianceWorkbench from "./ComplianceWorkbench.vue";

const listContainers = vi.fn();
const getCargoReadyCompliance = vi.fn();
const assessCargoReadyCompliance = vi.fn();
const decideCargoReadyCompliance = vi.fn();

vi.mock("../api/containers", () => ({
  listContainers: (...args: unknown[]) => listContainers(...args),
}));
vi.mock("../api/cargoReadyCompliance", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../api/cargoReadyCompliance")>();
  return {
    ...original,
    getCargoReadyCompliance: (...args: unknown[]) =>
      getCargoReadyCompliance(...args),
    assessCargoReadyCompliance: (...args: unknown[]) =>
      assessCargoReadyCompliance(...args),
    decideCargoReadyCompliance: (...args: unknown[]) =>
      decideCargoReadyCompliance(...args),
  };
});

const container = {
  id: "container-1",
  orderNumber: "SO-1",
  containerNumber: "MSCU1234567",
  currentStatus: "preparing",
  updatedAt: "2026-09-20T08:00:00.000Z",
};
const assessment = {
  assessmentId: "00000000-0000-4000-8000-000000000001",
  containerRecordId: "container-1",
  version: 1,
  state: "ready_for_decision",
  jurisdictionCountryCode: "US",
  assessmentDate: "2026-09-20",
  allocationSetId: "allocation-1",
  allocationSetVersion: 1,
  items: [],
  findings: [],
  applicableRules: [],
  evidenceRefs: ["evidence-1"],
  actorId: "reviewer-1",
  reasonCode: "scheduled_review",
  currentDecision: null,
  createdAt: "2026-09-20T08:00:00.000Z",
};

describe("ComplianceWorkbench", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "request-key-1" });
    listContainers.mockReset();
    getCargoReadyCompliance.mockReset();
    assessCargoReadyCompliance.mockReset();
    decideCargoReadyCompliance.mockReset();
    listContainers.mockResolvedValue({ items: [container] });
    getCargoReadyCompliance.mockResolvedValue(assessment);
  });

  it("loads the selected container assessment and shows its result", async () => {
    const { wrapper } = await mountPage("/compliance?containerId=container-1");

    expect(listContainers).toHaveBeenCalledWith({ pageSize: 100 });
    expect(getCargoReadyCompliance).toHaveBeenCalledWith(
      "container-1",
      expect.any(AbortSignal),
    );
    expect(wrapper.text()).toContain("MSCU1234567");
    expect(wrapper.text()).toContain("待决定");
  });

  it("submits a decision and reports pending-fact replay", async () => {
    decideCargoReadyCompliance.mockResolvedValue({
      assessmentId: assessment.assessmentId,
      version: 1,
      state: "decided",
      duplicate: false,
      replay: {
        status: "completed",
        reasonCode: "REPLAY_COMPLETED",
        claimed: 1,
        applied: 1,
        pending: 0,
        rejected: 0,
      },
    });
    const { wrapper } = await mountPage("/compliance?containerId=container-1");
    await wrapper.get('[name="decisionCode"]').setValue("approved");
    await wrapper
      .get('[name="decisionEvidenceRefs"]')
      .setValue("decision-evidence-1");
    await wrapper
      .get('[name="decisionReasonCode"]')
      .setValue("review_completed");
    await wrapper.get('[data-testid="decision-form"]').trigger("submit");
    await flushPromises();

    expect(decideCargoReadyCompliance).toHaveBeenCalledWith("container-1", {
      assessmentId: assessment.assessmentId,
      expectedDecisionVersion: 0,
      decisionCode: "approved",
      conditionRefs: [],
      evidenceRefs: ["decision-evidence-1"],
      reasonCode: "review_completed",
      idempotencyKey: "request-key-1",
    });
    expect(wrapper.get('[data-testid="replay-result"]').text()).toContain(
      "待应用日期事实已完成重放",
    );
  });
});

async function mountPage(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/compliance", component: ComplianceWorkbench }],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(ComplianceWorkbench, {
    global: {
      plugins: [router],
      stubs: { PageHeader: { template: "<header />" } },
    },
  });
  await flushPromises();
  return { wrapper, router };
}
