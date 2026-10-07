import type {
  ProductInitiativeCompletionV1,
  ProductInitiativeDestinationV1,
  ProductInitiativeStoredOutcomeV1,
  ProductInitiativePendingFieldCodeV1,
  ProductInitiativeReturnBasisV1,
  ProductInitiativeUnitEconomicsDraftV1,
  ProductInitiativeUnitEconomicsSnapshotV1,
  ProductInitiativeBusinessCaseDimensionDraftV1,
  ProductInitiativeV1,
  ProductInitiativeHandoffV1,
} from "@logix/contracts";
import type { PreparedProductInitiativeClaim } from "./product-initiative-claim";
import type { PreparedProductInitiativeNpiReturn } from "./product-initiative-npi-return";
import type {
  PreparedProductInitiativeDecision,
  PreparedSelectionReturnTakeback,
  ProductInitiativeReviewPoint,
} from "./product-initiative";

export const PRODUCT_INITIATIVE_REPOSITORY = Symbol(
  "ProductInitiativeRepository",
);

export interface ProductInitiativeRecord {
  initiativeId: string;
  handoffId: string;
  signalId: string;
  version: number;
  outcome: ProductInitiativeStoredOutcomeV1;
  completion: ProductInitiativeCompletionV1;
  currentDestination: ProductInitiativeDestinationV1;
  responsibleActorId: string;
  responsibilityAccepted: boolean | null;
  receivingTeamOrRole: string | null;
  resourceDescription: string | null;
  targetDate: Date | null;
  nextDecisionDate: Date | null;
  nextDecisionQuestion: string | null;
  validationFocus: string | null;
  reconsiderationDate: Date | null;
  unitEconomicsDraft: ProductInitiativeUnitEconomicsDraftV1 | null;
  unitEconomicsSnapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null;
  negativeConservativeReason: string | null;
  objective: string | null;
  reviewPoints: ProductInitiativeReviewPoint[];
  businessCaseDraft?: ProductInitiativeBusinessCaseDimensionDraftV1[];
  businessCaseSnapshot?: ProductInitiativeV1["businessCaseSnapshot"];
  reason: string | null;
  returnBasis?: ProductInitiativeReturnBasisV1 | null;
  pendingFieldCodes: ProductInitiativePendingFieldCodeV1[];
  createdAt: Date;
  updatedAt: Date;
}

/** 交给产品侧的不可变快照。NPI 侧只读它，不改写立项阶段的任何结论。 */
export interface ProductInitiativeHandoffRecord {
  handoffId: string;
  initiativeId: string;
  signalId: string;
  version: number;
  marketCode: string | null;
  userProblem: string | null;
  objective: string;
  responsibleActorId: string;
  responsibilityAccepted: boolean | null;
  receivingTeamOrRole: string | null;
  resourceDescription: string | null;
  targetDate: Date | null;
  nextDecisionDate: Date | null;
  nextDecisionQuestion: string | null;
  unitEconomicsSnapshot: ProductInitiativeUnitEconomicsSnapshotV1 | null;
  negativeConservativeReason: string | null;
  reviewPoints: ProductInitiativeReviewPoint[];
  businessCaseSnapshot?: ProductInitiativeHandoffV1["businessCaseSnapshot"];
  evidenceRefs: string[];
  createdBy: string;
  createdAt: Date;
  idempotencyKey: string;
}

export interface ProductInitiativeClaimRecord {
  claimId: string;
  handoffId: string;
  claimVersion: number;
  productOwnerActorId: string;
  claimedAt: Date;
}

/** NPI 侧的一条待办：不可变快照 + 当前领取状态（`null` = 还没人接）。 */
export interface ProductInitiativeNpiEntryRecord {
  handoff: ProductInitiativeHandoffRecord;
  claim: ProductInitiativeClaimRecord | null;
  initiativeVersion: number;
  initiativeDestination: ProductInitiativeDestinationV1;
}

export interface ProductInitiativeRepository {
  /** 该机会上已有的立项版本；没有立项判断时返回 0。 */
  currentVersion(tenantId: string, handoffId: string): Promise<number>;
  findByHandoffId(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductInitiativeRecord | null>;
  findById(
    tenantId: string,
    initiativeId: string,
  ): Promise<ProductInitiativeRecord | null>;
  list(input: {
    tenantId: string;
    todayUtc: Date;
    after?: {
      group: "defer_reconsideration_due" | "standard";
      reconsiderationDate: Date | null;
      updatedAt: Date;
      id: string;
    };
    take: number;
  }): Promise<ProductInitiativeRecord[]>;
  /**
   * 落库一次立项判断。
   *
   * 立项成立时，在同一事务内追加不可变交接快照与 Outbox；其余去向只更新当前态。
   */
  persistDecision(input: {
    tenantId: string;
    handoffId: string;
    actorId: string;
    command: PreparedProductInitiativeDecision;
  }): Promise<{ record: ProductInitiativeRecord; duplicate: boolean }>;
  takeBackSelectionReturn(input: {
    tenantId: string;
    signalId: string;
    actorId: string;
    command: PreparedSelectionReturnTakeback;
  }): Promise<{ record: ProductInitiativeRecord; duplicate: boolean }>;
  /**
   * NPI 待办队列：交到产品侧的不可变快照，左连当前领取状态。
   *
   * 队列取自**快照**而不是立项当前态：立项是终态（已交接不再接受新判断），
   * 快照即承诺，不必再去回看立项行。
   */
  listNpiQueue(input: {
    tenantId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<ProductInitiativeNpiEntryRecord[]>;
  /** 单条待办；不属于本租户或未交到产品侧时返回 `null`。 */
  findNpiEntry(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductInitiativeNpiEntryRecord | null>;
  /**
   * 落库一次领取：把立项接到某个产品负责人名下。
   * 同一幂等键重复提交返回原回执，不写第二条。
   */
  appendClaim(input: {
    tenantId: string;
    handoffId: string;
    command: PreparedProductInitiativeClaim;
  }): Promise<{ record: ProductInitiativeClaimRecord; duplicate: boolean }>;
  /**
   * NPI 退回选品：把已交接立项改回 `returned_from_npi`，理由必填。
   * 旧 handoff 快照与 claim 行保留可审计；选品侧靠 destination 投影可见。
   */
  persistNpiReturn(input: {
    tenantId: string;
    initiativeHandoffId: string;
    actorId: string;
    command: PreparedProductInitiativeNpiReturn;
  }): Promise<{ record: ProductInitiativeRecord; duplicate: boolean }>;
}
