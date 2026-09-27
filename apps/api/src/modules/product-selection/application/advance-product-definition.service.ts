import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductDefinitionV1,
  ProductDefinitionWriteCommandV1,
} from "@logix/contracts";
import {
  prepareProductDefinitionWrite,
  productDefinitionPendingFieldCodes,
  type CurrentProductDefinition,
} from "../domain/product-definition";
import {
  PRODUCT_DEFINITION_REPOSITORY,
  type ProductDefinitionRecord,
  type ProductDefinitionRepository,
} from "../domain/product-definition.repository";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import {
  ProductDefinitionNotClaimedError,
  throwProductDefinitionHttpError,
} from "./product-definition-errors";

/**
 * 推进产品定义：登记规格与合规假设，登记本阶段结论，可选前进一段。
 *
 * **两道真实门槛**：
 * 1. **没领的立项不能建产品定义** —— 上一片的领取回执是这里的入口；
 * 2. **不是领取人本人不能改** —— 一票有人负责，别人不该动它。
 */
@Injectable()
export class AdvanceProductDefinitionService {
  constructor(
    @Inject(PRODUCT_DEFINITION_REPOSITORY)
    private readonly definitions: ProductDefinitionRepository,
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly initiatives: ProductInitiativeRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    initiativeHandoffId: string;
    command: ProductDefinitionWriteCommandV1;
  }): Promise<ProductDefinitionV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const owner = await this.requireOwner(
        input.tenantId,
        input.initiativeHandoffId,
        input.actorId,
      );
      const current = await this.definitions.findByInitiativeHandoffId(
        input.tenantId,
        input.initiativeHandoffId,
      );
      const result = await this.definitions.persistWrite({
        tenantId: input.tenantId,
        initiativeHandoffId: input.initiativeHandoffId,
        productOwnerActorId: owner,
        actorId: input.actorId,
        command: prepareProductDefinitionWrite(
          currentStateOf(current),
          input.actorId,
          input.command,
        ),
      });
      return toProductDefinitionV1(result.record);
    } catch (error) {
      throwProductDefinitionHttpError(error);
    }
  }

  private async requireOwner(
    tenantId: string,
    handoffId: string,
    actorId: string,
  ): Promise<string> {
    const entry = await this.initiatives.findNpiEntry(tenantId, handoffId);
    if (!entry) {
      throw new ProductDefinitionNotClaimedError(
        "PRODUCT_INITIATIVE_HANDOFF_NOT_FOUND",
      );
    }
    if (!entry.claim) {
      // 没领就建产品定义，等于替别人认领了这票。
      throw new ProductDefinitionNotClaimedError(
        "PRODUCT_INITIATIVE_NOT_CLAIMED",
      );
    }
    if (entry.claim.productOwnerActorId !== actorId) {
      throw new ForbiddenException("PRODUCT_DEFINITION_NOT_YOURS");
    }
    return entry.claim.productOwnerActorId;
  }
}

export function currentStateOf(
  record: ProductDefinitionRecord | null,
): CurrentProductDefinition {
  return {
    version: record?.version ?? 0,
    npiStage: record?.npiStage ?? "evt",
    specification: record?.specification ?? null,
    complianceAssumptions: record?.complianceAssumptions ?? [],
    // 阶段结论由库里的登记记录推导 —— 缺口是现算的，不另存一份状态。
    concludedStages: (record?.stageOutcomes ?? []).map(
      (outcome) => outcome.stage,
    ),
  };
}

export function toProductDefinitionV1(
  record: ProductDefinitionRecord,
): ProductDefinitionV1 {
  return {
    contractVersion: "product-definition.v1",
    definitionId: record.definitionId,
    initiativeHandoffId: record.initiativeHandoffId,
    productOwnerActorId: record.productOwnerActorId,
    npiStage: record.npiStage,
    version: record.version,
    releaseState: record.releaseState,
    specification: record.specification,
    complianceAssumptions: record.complianceAssumptions,
    stageOutcomes: record.stageOutcomes.map((outcome) => ({
      stage: outcome.stage,
      conclusion: outcome.conclusion,
      evidenceRefs: outcome.evidenceRefs,
      recordedBy: outcome.recordedBy,
      recordedAt: outcome.recordedAt.toISOString(),
    })),
    pendingFieldCodes: productDefinitionPendingFieldCodes(
      currentStateOf(record),
    ),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
