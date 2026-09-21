import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ComplianceReviewForm from "./ComplianceReviewForm.vue";

const assessment = {
  assessmentId: "00000000-0000-4000-8000-000000000001",
  containerRecordId: "container-1",
  version: 2,
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

describe("ComplianceReviewForm", () => {
  it("normalizes assessment input and emits one assessment request", async () => {
    const wrapper = mount(ComplianceReviewForm, {
      props: { assessment: null, submitting: false },
    });

    await wrapper.get('[name="jurisdictionCountryCode"]').setValue("us");
    await wrapper.get('[name="assessmentDate"]').setValue("2026-09-20");
    await wrapper
      .get('[name="assessmentEvidenceRefs"]')
      .setValue("evidence-1\nevidence-2, evidence-1");
    await wrapper
      .get('[name="assessmentReasonCode"]')
      .setValue("scheduled_review");
    await wrapper.get('[data-testid="assessment-form"]').trigger("submit");

    expect(wrapper.emitted("assess")?.[0]).toEqual([
      {
        jurisdictionCountryCode: "US",
        assessmentDate: "2026-09-20",
        evidenceRefs: ["evidence-1", "evidence-2"],
        reasonCode: "scheduled_review",
      },
    ]);
  });

  it("requires and emits condition references only for conditional approval", async () => {
    const wrapper = mount(ComplianceReviewForm, {
      props: { assessment, submitting: false },
    });

    await wrapper
      .get('[name="decisionCode"]')
      .setValue("approved_with_conditions");
    expect(wrapper.find('[name="conditionRefs"]').exists()).toBe(true);
    await wrapper.get('[name="conditionRefs"]').setValue("obligation-1");
    await wrapper
      .get('[name="decisionEvidenceRefs"]')
      .setValue("decision-evidence-1");
    await wrapper
      .get('[name="decisionReasonCode"]')
      .setValue("review_completed");
    await wrapper.get('[data-testid="decision-form"]').trigger("submit");

    expect(wrapper.emitted("decide")?.[0]).toEqual([
      {
        decisionCode: "approved_with_conditions",
        conditionRefs: ["obligation-1"],
        evidenceRefs: ["decision-evidence-1"],
        reasonCode: "review_completed",
      },
    ]);

    await wrapper.get('[name="decisionCode"]').setValue("blocked");
    expect(wrapper.find('[name="conditionRefs"]').exists()).toBe(false);
  });

  it("does not allow a decision before an assessment exists", () => {
    const wrapper = mount(ComplianceReviewForm, {
      props: { assessment: null, submitting: false },
    });

    expect(
      wrapper
        .get('[data-testid="decision-form"] button')
        .attributes("disabled"),
    ).toBeDefined();
  });
});
