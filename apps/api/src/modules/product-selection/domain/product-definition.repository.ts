import type { NpiStageV1 } from "@logix/contracts";
import type {
  PreparedProductDefinitionRelease,
  PreparedProductDefinitionWrite,
  PreparedStageOutcome,
} from "./product-definition";

export const PRODUCT_DEFINITION_REPOSITORY = Symbol(
  "ProductDefinitionRepository",
);

export type ProductDefinitionReleaseState =
  "in_progress" | "released" | "deferred" | "terminated";

/** 已登记的阶段结论。`recordedBy/At` 由落库时补上，领域规则不管它。 */
export interface ProductDefinitionStageOutcome extends PreparedStageOutcome {
  recordedBy: string;
  recordedAt: Date;
}

export interface ProductDefinitionRecord {
  definitionId: string;
  initiativeHandoffId: string;
  productOwnerActorId: string;
  npiStage: NpiStageV1;
  version: number;
  releaseState: ProductDefinitionReleaseState;
  specification: string;
  complianceAssumptions: string[];
  stageOutcomes: ProductDefinitionStageOutcome[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDefinitionRepository {
  /** 按立项交接快照找产品定义；一票一行。 */
  findByInitiativeHandoffId(
    tenantId: string,
    initiativeHandoffId: string,
  ): Promise<ProductDefinitionRecord | null>;
  findById(
    tenantId: string,
    definitionId: string,
  ): Promise<ProductDefinitionRecord | null>;
  /**
   * 按幂等键找已落库的那一条。**重放必须先查它**：
   * 客户端重试（响应丢了再发一次同样的请求）时，期望版本已经过期，
   * 先判版本会把一次成功的保存报成"版本冲突"。
   */
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<ProductDefinitionRecord | null>;
  list(input: {
    tenantId: string;
    after?: { updatedAt: Date; id: string };
    take: number;
  }): Promise<ProductDefinitionRecord[]>;
  /**
   * 落库一次推进（规格 + 可选的阶段结论 + 可选的阶段前进）。
   * 同一幂等键重复提交返回原记录，不写第二条。
   */
  persistWrite(input: {
    tenantId: string;
    initiativeHandoffId: string;
    productOwnerActorId: string;
    actorId: string;
    command: PreparedProductDefinitionWrite;
  }): Promise<{ record: ProductDefinitionRecord; duplicate: boolean }>;
  /**
   * 落库一次发布决定。`release` 在同一事务内追加不可变交接快照；
   * `defer`/`terminate` 只改当前态。
   */
  persistRelease(input: {
    tenantId: string;
    definitionId: string;
    actorId: string;
    command: PreparedProductDefinitionRelease;
  }): Promise<{ record: ProductDefinitionRecord; duplicate: boolean }>;
}
