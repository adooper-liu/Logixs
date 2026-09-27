import { describe, expect, it, vi } from "vitest";
import type {
  ProductDefinitionReleaseCommandV1,
  ProductDefinitionWriteCommandV1,
} from "@logix/contracts";
import {
  AdvanceProductDefinitionService,
  toProductDefinitionV1,
} from "./advance-product-definition.service";
import { GetProductDefinitionService } from "./get-product-definition.service";
import { ReleaseProductDefinitionService } from "./release-product-definition.service";
import type {
  ProductDefinitionRecord,
  ProductDefinitionRepository,
} from "../domain/product-definition.repository";
import type { ProductInitiativeRepository } from "../domain/product-initiative.repository";

const TENANT = "11111111-1111-4111-8111-111111111111";
const HANDOFF = "aaaaaaaa-0000-4000-8000-000000000001";
const OWNER = "product-owner";

const WRITE: ProductDefinitionWriteCommandV1 = {
  contractVersion: "product-definition-write.v1",
  expectedDefinitionVersion: 0,
  specification: "40HC 折叠宠物推车",
  complianceAssumptions: ["CE"],
  advanceStage: false,
  idempotencyKey: "write-1",
};

const RELEASE: ProductDefinitionReleaseCommandV1 = {
  contractVersion: "product-definition-release.v1",
  expectedDefinitionVersion: 1,
  decision: "release",
  idempotencyKey: "release-1",
};

function definition(
  overrides: Partial<ProductDefinitionRecord> = {},
): ProductDefinitionRecord {
  return {
    definitionId: "dddddddd-0000-4000-8000-000000000001",
    initiativeHandoffId: HANDOFF,
    productOwnerActorId: OWNER,
    npiStage: "evt",
    version: 1,
    releaseState: "in_progress",
    specification: "40HC 折叠宠物推车",
    complianceAssumptions: ["CE"],
    stageOutcomes: [],
    createdAt: new Date("2026-09-27T10:00:00.000Z"),
    updatedAt: new Date("2026-09-27T10:00:00.000Z"),
    ...overrides,
  };
}

function definitions(
  overrides: Partial<ProductDefinitionRepository> = {},
): ProductDefinitionRepository {
  return {
    findByInitiativeHandoffId: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    // 大多数用例没有重放；专门验重放的那条自己覆盖它。
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    persistWrite: vi.fn().mockResolvedValue({
      record: definition(),
      duplicate: false,
    }),
    persistRelease: vi.fn().mockResolvedValue({
      record: definition({ releaseState: "released", version: 2 }),
      duplicate: false,
    }),
    ...overrides,
  } as unknown as ProductDefinitionRepository;
}

function initiatives(
  claimed = true,
  owner = OWNER,
): ProductInitiativeRepository {
  return {
    findNpiEntry: vi.fn().mockResolvedValue({
      handoff: { handoffId: HANDOFF },
      claim: claimed
        ? {
            claimId: "c",
            handoffId: HANDOFF,
            claimVersion: 1,
            productOwnerActorId: owner,
            claimedAt: new Date("2026-09-27T09:00:00.000Z"),
          }
        : null,
    }),
  } as unknown as ProductInitiativeRepository;
}

const advance = (
  repo: ProductDefinitionRepository,
  initiativeRepo = initiatives(),
) => new AdvanceProductDefinitionService(repo, initiativeRepo);

describe("AdvanceProductDefinitionService 门槛", () => {
  it("缺租户或操作人时拒绝", async () => {
    const service = advance(definitions());

    await expect(
      service.execute({
        tenantId: "",
        actorId: OWNER,
        initiativeHandoffId: HANDOFF,
        command: WRITE,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: "",
        initiativeHandoffId: HANDOFF,
        command: WRITE,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("没领的立项建不了产品定义 —— 领取回执是这一片的入口", async () => {
    const service = advance(definitions(), initiatives(false));

    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: OWNER,
        initiativeHandoffId: HANDOFF,
        command: WRITE,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "PRODUCT_INITIATIVE_NOT_CLAIMED",
    });
  });

  it("不是领取人本人时拒绝 —— 一票有人负责，别人不该动它", async () => {
    const service = advance(definitions(), initiatives(true, "someone-else"));

    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: OWNER,
        initiativeHandoffId: HANDOFF,
        command: WRITE,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("AdvanceProductDefinitionService 推进", () => {
  it("首次推进用版本 0 起头，负责人取自领取回执", async () => {
    const repo = definitions();
    const service = advance(repo);

    await service.execute({
      tenantId: TENANT,
      actorId: OWNER,
      initiativeHandoffId: HANDOFF,
      command: WRITE,
    });

    expect(repo.persistWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        productOwnerActorId: OWNER,
        command: expect.objectContaining({ version: 1, npiStage: "evt" }),
      }),
    );
  });

  it("已有定义时按当前状态判阶段，而不是每次都从 EVT 起", async () => {
    const repo = definitions({
      findByInitiativeHandoffId: vi.fn().mockResolvedValue(
        definition({
          version: 2,
          npiStage: "dvt",
          stageOutcomes: [
            {
              stage: "evt",
              conclusion: "功能样机通过",
              evidenceRefs: [],
              recordedBy: OWNER,
              recordedAt: new Date("2026-09-27T09:30:00.000Z"),
            },
          ],
        }),
      ),
    });
    const service = advance(repo);

    await service.execute({
      tenantId: TENANT,
      actorId: OWNER,
      initiativeHandoffId: HANDOFF,
      command: {
        ...WRITE,
        expectedDefinitionVersion: 2,
        advanceStage: true,
        conclusion: { text: "设计冻结", evidenceRefs: [] },
      },
    });

    expect(repo.persistWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({ version: 3, npiStage: "pvt" }),
      }),
    );
  });

  it("版本不符时冲突，不覆盖别人刚写的", async () => {
    const service = advance(
      definitions({
        findByInitiativeHandoffId: vi
          .fn()
          .mockResolvedValue(definition({ version: 5 })),
      }),
    );

    await expect(
      service.execute({
        tenantId: TENANT,
        actorId: OWNER,
        initiativeHandoffId: HANDOFF,
        command: WRITE,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("toProductDefinitionV1 缺口现算", () => {
  it("刚起头时说明还缺规格吗 —— 已写规格就只剩当前阶段结论", () => {
    const view = toProductDefinitionV1(definition());

    expect(view.pendingFieldCodes).toEqual(["evt_conclusion"]);
    expect(view.contractVersion).toBe("product-definition.v1");
  });

  it("走到 DVT 之后不再提 EVT 结论", () => {
    const view = toProductDefinitionV1(
      definition({
        version: 2,
        npiStage: "dvt",
        stageOutcomes: [
          {
            stage: "evt",
            conclusion: "功能样机通过",
            evidenceRefs: [],
            recordedBy: OWNER,
            recordedAt: new Date("2026-09-27T09:30:00.000Z"),
          },
        ],
      }),
    );

    expect(view.pendingFieldCodes).toEqual(["dvt_conclusion"]);
    expect(view.stageOutcomes[0]).toMatchObject({
      stage: "evt",
      recordedAt: "2026-09-27T09:30:00.000Z",
    });
  });
});

describe("ReleaseProductDefinitionService", () => {
  const release = (repo: ProductDefinitionRepository) =>
    new ReleaseProductDefinitionService(repo);

  it("定义不存在时 404", async () => {
    await expect(
      release(definitions()).execute({
        tenantId: TENANT,
        actorId: OWNER,
        initiativeHandoffId: HANDOFF,
        command: RELEASE,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("不是负责人时拒绝，不让别人替这票做决定", async () => {
    await expect(
      release(
        definitions({
          findByInitiativeHandoffId: vi
            .fn()
            .mockResolvedValue(
              definition({ productOwnerActorId: "someone-else" }),
            ),
        }),
      ).execute({
        tenantId: TENANT,
        actorId: OWNER,
        initiativeHandoffId: HANDOFF,
        command: RELEASE,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("暂缓不写原因时 400，不产生一条说不清为什么的记录", async () => {
    await expect(
      release(
        definitions({
          findByInitiativeHandoffId: vi.fn().mockResolvedValue(definition()),
        }),
      ).execute({
        tenantId: TENANT,
        actorId: OWNER,
        initiativeHandoffId: HANDOFF,
        command: { ...RELEASE, decision: "defer" },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("发布按负责人落库并返回已发布状态", async () => {
    const repo = definitions({
      findByInitiativeHandoffId: vi.fn().mockResolvedValue(definition()),
    });

    const result = await release(repo).execute({
      tenantId: TENANT,
      actorId: OWNER,
      initiativeHandoffId: HANDOFF,
      command: RELEASE,
    });

    expect(repo.persistRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionId: "dddddddd-0000-4000-8000-000000000001",
        command: expect.objectContaining({
          decision: "release",
          releaseState: "released",
        }),
      }),
    );
    expect(result.releaseState).toBe("released");
  });
});

describe("GetProductDefinitionService", () => {
  it("还没推进时返回 null，而不是一条空定义", async () => {
    const service = new GetProductDefinitionService(definitions());

    await expect(
      service.execute({ tenantId: TENANT, initiativeHandoffId: HANDOFF }),
    ).resolves.toBeNull();
  });

  it("缺租户时拒绝", async () => {
    const service = new GetProductDefinitionService(definitions());

    await expect(
      service.execute({ tenantId: "", initiativeHandoffId: HANDOFF }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("有定义时返回契约形状", async () => {
    const service = new GetProductDefinitionService(
      definitions({
        findByInitiativeHandoffId: vi.fn().mockResolvedValue(definition()),
      }),
    );

    await expect(
      service.execute({ tenantId: TENANT, initiativeHandoffId: HANDOFF }),
    ).resolves.toMatchObject({
      initiativeHandoffId: HANDOFF,
      npiStage: "evt",
      releaseState: "in_progress",
    });
  });
});
