import type {
  ShipmentWorkHandoffStateV1,
  WorkHandoffRecipientV1,
} from "@logix/contracts";
import type {
  PreparedWorkHandoffClaim,
  PreparedWorkHandoffClose,
  PreparedWorkHandoffRaise,
} from "./shipment-work-handoff";

export const SHIPMENT_WORK_HANDOFF_REPOSITORY = Symbol(
  "ShipmentWorkHandoffRepository",
);

export interface WorkHandoffRecord {
  handoffId: string;
  shipmentId: string;
  containerRecordId: string | null;
  recipientQueueCode: WorkHandoffRecipientV1;
  title: string;
  detail: string | null;
  state: ShipmentWorkHandoffStateV1;
  version: number;
  raisedBy: string;
  raisedAt: Date;
  claimedByActorId: string | null;
  claimedAt: Date | null;
  closedByActorId: string | null;
  closedAt: Date | null;
  conclusion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 交出去那一步的完整入参：领域规则算出来的部分 + 它不认识的目标对象。 */
export interface WorkHandoffRaiseInput extends PreparedWorkHandoffRaise {
  shipmentId: string;
  containerRecordId: string | null;
}

/** 已落库的动作（用于重放）。 */
export interface WorkHandoffActionRecord {
  handoffId: string;
  action: "claim" | "close";
  payloadHash: string;
}

export interface ShipmentWorkHandoffRepository {
  findById(
    tenantId: string,
    handoffId: string,
  ): Promise<WorkHandoffRecord | null>;
  /**
   * 岗位队列：默认只列**还没了结**的（已了结的留在票上可回看，不占队列）。
   * 按岗位码参数化，一套实现服务所有岗位。
   */
  listQueue(input: {
    tenantId: string;
    recipientQueueCode: WorkHandoffRecipientV1;
    after?: { raisedAt: Date; id: string };
    take: number;
  }): Promise<WorkHandoffRecord[]>;
  /** 按交接自己的幂等键找 —— 交出去那一步的重试走这条。 */
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<WorkHandoffRecord | null>;
  /** 出运运营那一侧：这一票交给谁了、了没了。 */
  listByShipment(
    tenantId: string,
    shipmentId: string,
  ): Promise<WorkHandoffRecord[]>;
  /**
   * 按幂等键找已落库的动作。**重放必须先查它** —— 客户端重试时期望版本
   * 已经过期，先判版本会把一次成功的动作报成「版本冲突」。
   */
  findActionByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<WorkHandoffActionRecord | null>;
  raiseHandoff(input: {
    tenantId: string;
    actorId: string;
    command: WorkHandoffRaiseInput;
  }): Promise<{ record: WorkHandoffRecord; duplicate: boolean }>;
  /** 领取或了结：同一事务内更新当前态并追加一条不可变动作留痕。 */
  appendAction(input: {
    tenantId: string;
    handoffId: string;
    actorId: string;
    action: "claim" | "close";
    command: PreparedWorkHandoffClaim | PreparedWorkHandoffClose;
  }): Promise<{ record: WorkHandoffRecord; duplicate: boolean }>;
}
