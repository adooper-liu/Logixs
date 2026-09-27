import type {
  ProductInitiativeCompletionV1,
  ProductInitiativeDestinationV1,
  ProductInitiativeOutcomeV1,
  ProductInitiativePendingFieldCodeV1,
} from "@logix/contracts";
import type {
  PreparedProductInitiativeDecision,
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
  outcome: ProductInitiativeOutcomeV1;
  completion: ProductInitiativeCompletionV1;
  currentDestination: ProductInitiativeDestinationV1;
  responsibleActorId: string;
  objective: string | null;
  reviewPoints: ProductInitiativeReviewPoint[];
  reason: string | null;
  pendingFieldCodes: ProductInitiativePendingFieldCodeV1[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInitiativeRepository {
  /** 该机会上已有的立项版本；没有立项判断时返回 0。 */
  currentVersion(tenantId: string, handoffId: string): Promise<number>;
  findByHandoffId(
    tenantId: string,
    handoffId: string,
  ): Promise<ProductInitiativeRecord | null>;
  list(input: {
    tenantId: string;
    after?: { updatedAt: Date; id: string };
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
}
