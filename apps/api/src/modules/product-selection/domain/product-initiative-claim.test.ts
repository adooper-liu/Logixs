import { describe, expect, it } from "vitest";
import {
  prepareProductInitiativeClaim,
  ProductInitiativeClaimConflictError,
  ProductInitiativeClaimValidationError,
} from "./product-initiative-claim";

const UNCLAIMED = { claimVersion: 0, productOwnerActorId: null };
const COMMAND = {
  contractVersion: "product-initiative-claim.v1",
  expectedClaimVersion: 0,
  idempotencyKey: "claim-1",
} as const;

describe("prepareProductInitiativeClaim 边界校验", () => {
  it("拒绝别的契约版本，避免用旧命令写新事实", () => {
    expect(() =>
      prepareProductInitiativeClaim(UNCLAIMED, "product-owner", {
        ...COMMAND,
        contractVersion: "product-initiative-decision.v1" as never,
      }),
    ).toThrow(ProductInitiativeClaimValidationError);
  });

  it.each([
    ["空的 actorId", ""],
    ["只有空白的 actorId", "   "],
  ])("拒绝%s —— 领取必须留下一个具体负责人", (_label, actorId) => {
    expect(() =>
      prepareProductInitiativeClaim(UNCLAIMED, actorId, COMMAND),
    ).toThrow(ProductInitiativeClaimValidationError);
  });

  it("拒绝空的幂等键，否则重复提交会写出第二条回执", () => {
    expect(() =>
      prepareProductInitiativeClaim(UNCLAIMED, "product-owner", {
        ...COMMAND,
        idempotencyKey: " ",
      }),
    ).toThrow(ProductInitiativeClaimValidationError);
  });

  it.each([-1, 1.5, Number.NaN])(
    "拒绝非法的期望版本 %s",
    (expectedClaimVersion) => {
      expect(() =>
        prepareProductInitiativeClaim(UNCLAIMED, "product-owner", {
          ...COMMAND,
          expectedClaimVersion,
        }),
      ).toThrow(ProductInitiativeClaimValidationError);
    },
  );
});

describe("prepareProductInitiativeClaim 并发与重复领取", () => {
  it("已被领走时冲突，且错误码说的是被领走了 —— 版本旧只是伴随现象", () => {
    // 典型现场：页面读到时还没人接（版本 0），点下去时别人已经接了（版本 1）。
    // 这时提示「已被领走」才有用；报「版本冲突」会让人以为自己点错了地方。
    expect(() =>
      prepareProductInitiativeClaim(
        { claimVersion: 1, productOwnerActorId: "someone-else" },
        "product-owner",
        { ...COMMAND, expectedClaimVersion: 0 },
      ),
    ).toThrow("PRODUCT_INITIATIVE_ALREADY_CLAIMED");
  });

  it("还没人接但版本对不上时冲突，不覆盖", () => {
    expect(() =>
      prepareProductInitiativeClaim(UNCLAIMED, "product-owner", {
        ...COMMAND,
        expectedClaimVersion: 1,
      }),
    ).toThrow(ProductInitiativeClaimConflictError);
  });
});

describe("prepareProductInitiativeClaim 成功路径", () => {
  it("未领取时领取：版本加一，负责人是操作人", () => {
    const prepared = prepareProductInitiativeClaim(
      UNCLAIMED,
      "product-owner",
      COMMAND,
    );

    expect(prepared).toMatchObject({
      expectedClaimVersion: 0,
      claimVersion: 1,
      productOwnerActorId: "product-owner",
      idempotencyKey: "claim-1",
    });
  });

  it("操作人前后空白被裁掉，同一人不会因为空格变成两个人", () => {
    const prepared = prepareProductInitiativeClaim(
      UNCLAIMED,
      "  product-owner  ",
      COMMAND,
    );

    expect(prepared.productOwnerActorId).toBe("product-owner");
  });

  it("同一请求产生同一载荷哈希，供幂等比较", () => {
    const first = prepareProductInitiativeClaim(UNCLAIMED, "a", COMMAND);
    const second = prepareProductInitiativeClaim(UNCLAIMED, "a", COMMAND);

    expect(first.payloadHash).toBe(second.payloadHash);
  });

  it("换了人就是另一笔，载荷哈希不同", () => {
    const first = prepareProductInitiativeClaim(UNCLAIMED, "a", COMMAND);
    const second = prepareProductInitiativeClaim(UNCLAIMED, "b", COMMAND);

    expect(first.payloadHash).not.toBe(second.payloadHash);
  });
});
