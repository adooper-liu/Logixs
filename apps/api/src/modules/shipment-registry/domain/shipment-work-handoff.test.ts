import { describe, expect, it } from "vitest";
import type {
  ShipmentWorkHandoffClaimCommandV1,
  ShipmentWorkHandoffCloseCommandV1,
  ShipmentWorkHandoffRaiseCommandV1,
} from "@logix/contracts";
import {
  prepareWorkHandoffClaim,
  prepareWorkHandoffClose,
  prepareWorkHandoffRaise,
  WorkHandoffConflictError,
  WorkHandoffValidationError,
  type CurrentWorkHandoff,
} from "./shipment-work-handoff";

const RAISED: CurrentWorkHandoff = {
  state: "raised",
  version: 1,
  claimedByActorId: null,
};
const CLAIMED: CurrentWorkHandoff = {
  state: "claimed",
  version: 2,
  claimedByActorId: "customs-operator",
};

const RAISE: ShipmentWorkHandoffRaiseCommandV1 = {
  contractVersion: "shipment-work-handoff-raise.v1",
  shipmentId: "11111111-1111-4111-8111-111111111111",
  recipientQueueCode: "customs",
  title: "这票缺随车单，请清关岗位补",
  idempotencyKey: "raise-1",
};

const CLAIM: ShipmentWorkHandoffClaimCommandV1 = {
  contractVersion: "shipment-work-handoff-claim.v1",
  expectedVersion: 1,
  idempotencyKey: "claim-1",
};

const CLOSE: ShipmentWorkHandoffCloseCommandV1 = {
  contractVersion: "shipment-work-handoff-close.v1",
  expectedVersion: 2,
  conclusion: "已补齐随车单并复核",
  idempotencyKey: "close-1",
};

describe("交给专业岗位（raise）", () => {
  it("只收四个专业岗位，别的岗位码明确失败", () => {
    expect(() =>
      prepareWorkHandoffRaise("ops", {
        ...RAISE,
        recipientQueueCode: "finance" as never,
      }),
    ).toThrow(WorkHandoffValidationError);
  });

  it("标题必填、说明可空 —— 说明是补充，不是门槛", () => {
    const prepared = prepareWorkHandoffRaise("ops", RAISE);

    expect(prepared).toMatchObject({
      recipientQueueCode: "customs",
      detail: null,
    });
  });

  it("同一请求载荷哈希稳定，供幂等比较", () => {
    expect(prepareWorkHandoffRaise("ops", RAISE).payloadHash).toBe(
      prepareWorkHandoffRaise("ops", RAISE).payloadHash,
    );
  });
});

describe("领取（claim）", () => {
  it("还没人接时可以领，版本加一", () => {
    const prepared = prepareWorkHandoffClaim(RAISED, "customs-operator", CLAIM);

    expect(prepared.version).toBe(2);
  });

  it("已被领走时说「被领走了」，而不是含糊报版本冲突", () => {
    // 典型现场：读到时还没人接，点下去已经被接了。
    expect(() =>
      prepareWorkHandoffClaim(CLAIMED, "someone-else", CLAIM),
    ).toThrow("SHIPMENT_WORK_HANDOFF_ALREADY_CLAIMED");
  });

  it("已了结的事不能再领", () => {
    expect(() =>
      prepareWorkHandoffClaim(
        { state: "closed", version: 3, claimedByActorId: "customs-operator" },
        "someone-else",
        { ...CLAIM, expectedVersion: 3 },
      ),
    ).toThrow(WorkHandoffConflictError);
  });

  it("期望版本对不上时冲突，不覆盖别人的领取", () => {
    expect(() =>
      prepareWorkHandoffClaim(RAISED, "customs-operator", {
        ...CLAIM,
        expectedVersion: 0,
      }),
    ).toThrow("SHIPMENT_WORK_HANDOFF_VERSION_CONFLICT");
  });
});

describe("了结（close）", () => {
  it("领取人给了结论才能了结", () => {
    const prepared = prepareWorkHandoffClose(
      CLAIMED,
      "customs-operator",
      CLOSE,
    );

    expect(prepared).toMatchObject({
      version: 3,
      conclusion: "已补齐随车单并复核",
    });
  });

  it("没给结论时明确失败 —— 交出去的人靠这句话判断下一步", () => {
    expect(() =>
      prepareWorkHandoffClose(CLAIMED, "customs-operator", {
        ...CLOSE,
        conclusion: "   ",
      }),
    ).toThrow(WorkHandoffValidationError);
  });

  it("没领就不能了结 —— 否则等于替别人把活记成做完了", () => {
    expect(() =>
      prepareWorkHandoffClose(RAISED, "customs-operator", {
        ...CLOSE,
        expectedVersion: 1,
      }),
    ).toThrow("SHIPMENT_WORK_HANDOFF_NOT_CLAIMED");
  });

  it("不是你领的就不能由你结", () => {
    expect(() =>
      prepareWorkHandoffClose(CLAIMED, "someone-else", CLOSE),
    ).toThrow("SHIPMENT_WORK_HANDOFF_NOT_YOURS");
  });

  it("已了结的不能再来一次", () => {
    expect(() =>
      prepareWorkHandoffClose(
        { state: "closed", version: 3, claimedByActorId: "customs-operator" },
        "customs-operator",
        { ...CLOSE, expectedVersion: 3 },
      ),
    ).toThrow("SHIPMENT_WORK_HANDOFF_ALREADY_CLOSED");
  });
});
