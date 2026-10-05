import { describe, expect, it, vi } from "vitest";
import { ClaimProductInitiativeService } from "./claim-product-initiative.service";
import { ListNpiQueueService, toQueueEntry } from "./list-npi-queue.service";
import { encodeKeysetCursor } from "./keyset-cursor";
import type {
  ProductInitiativeNpiEntryRecord,
  ProductInitiativeRepository,
} from "../domain/product-initiative.repository";

const TENANT = "11111111-1111-4111-8111-111111111111";
const HANDOFF = "aaaaaaaa-0000-4000-8000-000000000001";
const INITIATIVE = "cccccccc-0000-4000-8000-000000000001";
const SIGNAL = "bbbbbbbb-0000-4000-8000-000000000001";

function entry(
  overrides: {
    handoffId?: string;
    createdAt?: Date;
    claim?: ProductInitiativeNpiEntryRecord["claim"];
  } = {},
): ProductInitiativeNpiEntryRecord {
  return {
    handoff: {
      handoffId: overrides.handoffId ?? HANDOFF,
      initiativeId: INITIATIVE,
      signalId: SIGNAL,
      version: 1,
      marketCode: "CA",
      userProblem: "宠物出行用品在加拿大复购低",
      objective: "验证宠物出行品类是否值得立项",
      responsibleActorId: "selector-1",
      responsibilityAccepted: null,
      receivingTeamOrRole: null,
      resourceDescription: null,
      targetDate: null,
      nextDecisionDate: null,
      nextDecisionQuestion: null,
      unitEconomicsSnapshot: null,
      negativeConservativeReason: null,
      reviewPoints: [
        {
          code: "target_user_and_market",
          evidenceRefs: [],
          conclusion: "加拿大养宠家庭",
        },
      ],
      evidenceRefs: [],
      createdBy: "selector-1",
      createdAt: overrides.createdAt ?? new Date("2026-09-27T10:00:00.000Z"),
      idempotencyKey: "handoff-1",
    },
    claim: overrides.claim ?? null,
    initiativeVersion: 1,
    initiativeDestination: "handed_off",
  };
}

function repository(
  overrides: Partial<ProductInitiativeRepository> = {},
): ProductInitiativeRepository {
  return {
    currentVersion: vi.fn(),
    findByHandoffId: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    persistDecision: vi.fn(),
    listNpiQueue: vi.fn().mockResolvedValue([]),
    findNpiEntry: vi.fn().mockResolvedValue(null),
    appendClaim: vi.fn(),
    persistNpiReturn: vi.fn(),
    ...overrides,
  } as unknown as ProductInitiativeRepository;
}

describe("ListNpiQueueService", () => {
  it("缺租户时拒绝，不返回任何人的待办", async () => {
    const service = new ListNpiQueueService(repository());

    await expect(service.execute({ tenantId: "" })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("多取一条判断还有没有下一页，并给出下一游标", async () => {
    const rows = [
      entry({ handoffId: "aaaaaaaa-0000-4000-8000-000000000001" }),
      entry({ handoffId: "aaaaaaaa-0000-4000-8000-000000000002" }),
      entry({ handoffId: "aaaaaaaa-0000-4000-8000-000000000003" }),
    ];
    const repo = repository({ listNpiQueue: vi.fn().mockResolvedValue(rows) });
    const service = new ListNpiQueueService(repo);

    const page = await service.execute({ tenantId: TENANT, pageSize: "2" });

    expect(repo.listNpiQueue).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toEqual(expect.any(String));
    expect(page.contractVersion).toBe("product-initiative-npi-queue.v1");
  });

  it("最后一页不给游标", async () => {
    const service = new ListNpiQueueService(
      repository({ listNpiQueue: vi.fn().mockResolvedValue([entry()]) }),
    );

    const page = await service.execute({ tenantId: TENANT, pageSize: "5" });

    expect(page.nextCursor).toBeNull();
  });

  it("别的租户的游标被拒绝", async () => {
    const service = new ListNpiQueueService(repository());
    const cursor = encodeKeysetCursor(
      "22222222-2222-4222-8222-222222222222",
      new Date("2026-09-27T10:00:00.000Z"),
      HANDOFF,
    );

    await expect(
      service.execute({ tenantId: TENANT, cursor }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("非整数页大小被拒绝，而不是取整", async () => {
    const service = new ListNpiQueueService(repository());

    await expect(
      service.execute({ tenantId: TENANT, pageSize: "10.5" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("未领取的票 claim 为 null —— 界面据此分清有没有人接", () => {
    expect(toQueueEntry(entry()).claim).toBeNull();

    const claimed = toQueueEntry(
      entry({
        claim: {
          claimId: "dddddddd-0000-4000-8000-000000000001",
          handoffId: HANDOFF,
          claimVersion: 1,
          productOwnerActorId: "product-owner",
          claimedAt: new Date("2026-09-27T11:00:00.000Z"),
        },
      }),
    );
    expect(claimed.claim).toMatchObject({
      productOwnerActorId: "product-owner",
      claimedAt: "2026-09-27T11:00:00.000Z",
    });
  });

  it("快照原样带出，不夹带立项阶段之外的状态", () => {
    const { handoff } = toQueueEntry(entry());

    expect(handoff).toMatchObject({
      contractVersion: "product_initiative_handoff.v1",
      objective: "验证宠物出行品类是否值得立项",
      responsibleActorId: "selector-1",
    });
    expect(Object.keys(handoff).sort()).toEqual(
      [
        "contractVersion",
        "createdAt",
        "evidenceRefs",
        "handoffId",
        "idempotencyKey",
        "initiativeId",
        "marketCode",
        "negativeConservativeReason",
        "nextDecisionDate",
        "nextDecisionQuestion",
        "objective",
        "receivingTeamOrRole",
        "resourceDescription",
        "responsibilityAccepted",
        "responsibleActorId",
        "reviewPoints",
        "signalId",
        "targetDate",
        "unitEconomicsSnapshot",
        "userProblem",
        "version",
      ].sort(),
    );
  });
});

describe("ClaimProductInitiativeService", () => {
  const command = {
    contractVersion: "product-initiative-claim.v1",
    expectedClaimVersion: 0,
    idempotencyKey: "claim-1",
  } as const;

  it("缺操作人时拒绝 —— 领取必须落在具体某个人头上", async () => {
    const service = new ClaimProductInitiativeService(repository());

    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: "",
        handoffId: HANDOFF,
        command,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("待办不存在时 404，而不是凭空造一条领取", async () => {
    const service = new ClaimProductInitiativeService(repository());

    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: "product-owner",
        handoffId: HANDOFF,
        command,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("未领取时领取：落库并返回整条待办，就地显示已由我负责", async () => {
    const appendClaim = vi.fn().mockResolvedValue({
      record: {
        claimId: "dddddddd-0000-4000-8000-000000000001",
        handoffId: HANDOFF,
        claimVersion: 1,
        productOwnerActorId: "product-owner",
        claimedAt: new Date("2026-09-27T11:00:00.000Z"),
      },
      duplicate: false,
    });
    const service = new ClaimProductInitiativeService(
      repository({
        findNpiEntry: vi.fn().mockResolvedValue(entry()),
        appendClaim,
      }),
    );

    const result = await service.execute({
      tenantId: TENANT,
      actorId: "product-owner",
      handoffId: HANDOFF,
      command,
    });

    expect(appendClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        handoffId: HANDOFF,
        command: expect.objectContaining({
          claimVersion: 1,
          productOwnerActorId: "product-owner",
        }),
      }),
    );
    expect(result.claim).toMatchObject({
      productOwnerActorId: "product-owner",
      claimVersion: 1,
    });
    expect(result.handoff.handoffId).toBe(HANDOFF);
  });

  it("已被别人领走时 409，不覆盖他人领取", async () => {
    const service = new ClaimProductInitiativeService(
      repository({
        findNpiEntry: vi.fn().mockResolvedValue(
          entry({
            claim: {
              claimId: "dddddddd-0000-4000-8000-000000000002",
              handoffId: HANDOFF,
              claimVersion: 1,
              productOwnerActorId: "someone-else",
              claimedAt: new Date("2026-09-27T10:30:00.000Z"),
            },
          }),
        ),
      }),
    );

    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: "product-owner",
        handoffId: HANDOFF,
        command,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "PRODUCT_INITIATIVE_ALREADY_CLAIMED",
    });
  });

  it("页面停在旧版本上再点领取时也是 409 被领走，不让调用方猜", async () => {
    // 典型现场：读到时还没人接（版本 0），点下去时别人已经接了。
    const service = new ClaimProductInitiativeService(
      repository({
        findNpiEntry: vi.fn().mockResolvedValue(
          entry({
            claim: {
              claimId: "dddddddd-0000-4000-8000-000000000003",
              handoffId: HANDOFF,
              claimVersion: 1,
              productOwnerActorId: "someone-else",
              claimedAt: new Date("2026-09-27T10:30:00.000Z"),
            },
          }),
        ),
      }),
    );

    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: "product-owner",
        handoffId: HANDOFF,
        command: { ...command, expectedClaimVersion: 0 },
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "PRODUCT_INITIATIVE_ALREADY_CLAIMED",
    });
  });

  it("非法契约版本时 400，不用旧命令写新事实", async () => {
    const service = new ClaimProductInitiativeService(
      repository({ findNpiEntry: vi.fn().mockResolvedValue(entry()) }),
    );

    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: "product-owner",
        handoffId: HANDOFF,
        command: { ...command, contractVersion: "nope" as never },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
