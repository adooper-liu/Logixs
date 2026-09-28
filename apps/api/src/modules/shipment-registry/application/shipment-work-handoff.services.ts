import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  ShipmentWorkHandoffClaimCommandV1,
  ShipmentWorkHandoffCloseCommandV1,
  ShipmentWorkHandoffQueuePageV1,
  ShipmentWorkHandoffRaiseCommandV1,
  ShipmentWorkHandoffV1,
  WorkHandoffRecipientV1,
} from "@logix/contracts";
import {
  prepareWorkHandoffClaim,
  prepareWorkHandoffClose,
  prepareWorkHandoffRaise,
  WORK_HANDOFF_RECIPIENTS,
  type CurrentWorkHandoff,
} from "../domain/shipment-work-handoff";
import {
  SHIPMENT_WORK_HANDOFF_REPOSITORY,
  type ShipmentWorkHandoffRepository,
  type WorkHandoffRecord,
} from "../domain/shipment-work-handoff.repository";
import {
  throwWorkHandoffHttpError,
  WorkHandoffNotFoundError,
} from "./work-handoff-errors";

/**
 * 把票级事项交给某个**专业岗位队列**。
 *
 * 出运运营只需判断交给哪个岗位，不必知道今天谁在班 —— 这是「拉」而不是「指派」：
 * 指派到人要维护排班，人不在就卡住；交给岗位则谁在班谁领。
 */
@Injectable()
export class RaiseWorkHandoffService {
  constructor(
    @Inject(SHIPMENT_WORK_HANDOFF_REPOSITORY)
    private readonly repository: ShipmentWorkHandoffRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    command: ShipmentWorkHandoffRaiseCommandV1;
  }): Promise<ShipmentWorkHandoffV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const prepared = prepareWorkHandoffRaise(input.actorId, input.command);
      // 先判重放再落库：重试的期望是拿回原来那条，不是再交一次。
      const replay = await this.repository.findByIdempotencyKey(
        input.tenantId,
        prepared.idempotencyKey,
      );
      if (replay) return toWorkHandoffV1(replay);

      const result = await this.repository.raiseHandoff({
        tenantId: input.tenantId,
        actorId: input.actorId,
        command: {
          shipmentId: input.command.shipmentId,
          containerRecordId: input.command.containerRecordId ?? null,
          ...prepared,
        },
      });
      return toWorkHandoffV1(result.record);
    } catch (error) {
      throwWorkHandoffHttpError(error);
    }
  }
}

/** 领取：把队列里的一件接到自己名下。岗位内的人都能领，不必事先指派。 */
@Injectable()
export class ClaimWorkHandoffService {
  constructor(
    @Inject(SHIPMENT_WORK_HANDOFF_REPOSITORY)
    private readonly repository: ShipmentWorkHandoffRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    command: ShipmentWorkHandoffClaimCommandV1;
  }): Promise<ShipmentWorkHandoffV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const replayed = await this.replayOf(
        input.tenantId,
        input.command.idempotencyKey,
      );
      if (replayed) return replayed;

      const current = await this.requireHandoff(
        input.tenantId,
        input.handoffId,
      );
      const result = await this.repository.appendAction({
        tenantId: input.tenantId,
        handoffId: input.handoffId,
        actorId: input.actorId,
        action: "claim",
        command: prepareWorkHandoffClaim(
          currentStateOf(current),
          input.actorId,
          input.command,
        ),
      });
      return toWorkHandoffV1(result.record);
    } catch (error) {
      throwWorkHandoffHttpError(error);
    }
  }

  private async replayOf(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<ShipmentWorkHandoffV1 | null> {
    const replay = await this.repository.findActionByIdempotencyKey(
      tenantId,
      idempotencyKey,
    );
    if (!replay) return null;
    const existing = await this.repository.findById(tenantId, replay.handoffId);
    return existing ? toWorkHandoffV1(existing) : null;
  }

  private async requireHandoff(
    tenantId: string,
    handoffId: string,
  ): Promise<WorkHandoffRecord> {
    const record = await this.repository.findById(tenantId, handoffId);
    if (!record) {
      throw new WorkHandoffNotFoundError("SHIPMENT_WORK_HANDOFF_NOT_FOUND");
    }
    return record;
  }
}

/**
 * 了结：**必须给结论**，且**只有领取人本人能结**。
 * 交出去的人靠这句话判断这一票能不能往下走；不写等于把人晾在半路。
 */
@Injectable()
export class CloseWorkHandoffService {
  constructor(
    @Inject(SHIPMENT_WORK_HANDOFF_REPOSITORY)
    private readonly repository: ShipmentWorkHandoffRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    command: ShipmentWorkHandoffCloseCommandV1;
  }): Promise<ShipmentWorkHandoffV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const replay = await this.repository.findActionByIdempotencyKey(
        input.tenantId,
        input.command.idempotencyKey,
      );
      if (replay) {
        const existing = await this.repository.findById(
          input.tenantId,
          replay.handoffId,
        );
        if (existing) return toWorkHandoffV1(existing);
      }

      const current = await this.repository.findById(
        input.tenantId,
        input.handoffId,
      );
      if (!current) {
        throw new WorkHandoffNotFoundError("SHIPMENT_WORK_HANDOFF_NOT_FOUND");
      }
      const result = await this.repository.appendAction({
        tenantId: input.tenantId,
        handoffId: input.handoffId,
        actorId: input.actorId,
        action: "close",
        command: prepareWorkHandoffClose(
          currentStateOf(current),
          input.actorId,
          input.command,
        ),
      });
      return toWorkHandoffV1(result.record);
    } catch (error) {
      throwWorkHandoffHttpError(error);
    }
  }
}

/** 岗位队列：一个岗位一个队列，一套实现服务所有岗位。 */
@Injectable()
export class ListWorkHandoffQueueService {
  constructor(
    @Inject(SHIPMENT_WORK_HANDOFF_REPOSITORY)
    private readonly repository: ShipmentWorkHandoffRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    recipientQueueCode?: string;
    pageSize?: string;
    cursor?: string;
  }): Promise<ShipmentWorkHandoffQueuePageV1> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    if (
      !WORK_HANDOFF_RECIPIENTS.includes(
        input.recipientQueueCode as WorkHandoffRecipientV1,
      )
    ) {
      throw new HttpException(
        "VALIDATION_FORMAT: recipientQueueCode",
        HttpStatus.BAD_REQUEST,
      );
    }
    const recipientQueueCode =
      input.recipientQueueCode as WorkHandoffRecipientV1;
    const pageSize = parsePageSize(input.pageSize);
    const after = input.cursor
      ? decodeCursor(input.cursor, input.tenantId)
      : undefined;
    const rows = await this.repository.listQueue({
      tenantId: input.tenantId,
      recipientQueueCode,
      ...(after ? { after } : {}),
      take: pageSize + 1,
    });
    const hasNext = rows.length > pageSize;
    const items = hasNext ? rows.slice(0, pageSize) : rows;
    const last = items.at(-1);

    return {
      contractVersion: "shipment-work-handoff-queue.v1",
      recipientQueueCode,
      items: items.map(toWorkHandoffV1),
      pageSize,
      nextCursor:
        hasNext && last
          ? encodeCursor(input.tenantId, last.raisedAt, last.handoffId)
          : null,
    };
  }
}

/** 出运运营那一侧：这一票交给谁了、了没了。 */
@Injectable()
export class ListShipmentWorkHandoffsService {
  constructor(
    @Inject(SHIPMENT_WORK_HANDOFF_REPOSITORY)
    private readonly repository: ShipmentWorkHandoffRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    shipmentId: string;
  }): Promise<ShipmentWorkHandoffV1[]> {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const rows = await this.repository.listByShipment(
      input.tenantId,
      input.shipmentId,
    );
    return rows.map(toWorkHandoffV1);
  }
}

export function currentStateOf(record: WorkHandoffRecord): CurrentWorkHandoff {
  return {
    state: record.state,
    version: record.version,
    claimedByActorId: record.claimedByActorId,
  };
}

export function toWorkHandoffV1(
  record: WorkHandoffRecord,
): ShipmentWorkHandoffV1 {
  return {
    contractVersion: "shipment-work-handoff.v1",
    handoffId: record.handoffId,
    shipmentId: record.shipmentId,
    containerRecordId: record.containerRecordId,
    recipientQueueCode: record.recipientQueueCode,
    title: record.title,
    detail: record.detail,
    state: record.state,
    version: record.version,
    raisedBy: record.raisedBy,
    raisedAt: record.raisedAt.toISOString(),
    claimedByActorId: record.claimedByActorId,
    claimedAt: record.claimedAt?.toISOString() ?? null,
    closedByActorId: record.closedByActorId,
    closedAt: record.closedAt?.toISOString() ?? null,
    conclusion: record.conclusion,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined || value === "") return 50;
  if (!/^\d+$/.test(value)) invalid("pageSize");
  const parsed = Number(value);
  if (parsed < 1 || parsed > 200) invalid("pageSize");
  return parsed;
}

function encodeCursor(tenantId: string, at: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ tenantId, at: at.toISOString(), id }),
  ).toString("base64url");
}

function decodeCursor(
  value: string,
  tenantId: string,
): { raisedAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      tenantId?: unknown;
      at?: unknown;
      id?: unknown;
    };
    if (
      parsed.tenantId !== tenantId ||
      typeof parsed.at !== "string" ||
      typeof parsed.id !== "string"
    ) {
      invalid("cursor");
    }
    const at = new Date(parsed.at as string);
    if (Number.isNaN(at.getTime())) invalid("cursor");
    return { raisedAt: at, id: parsed.id as string };
  } catch (error) {
    if (error instanceof HttpException) throw error;
    invalid("cursor");
  }
}

function invalid(field: string): never {
  throw new HttpException(
    `VALIDATION_FORMAT: ${field}`,
    HttpStatus.BAD_REQUEST,
  );
}
