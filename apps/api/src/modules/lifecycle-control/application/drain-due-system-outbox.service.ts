import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { SERVICE_ACTOR_TYPE } from "../../identity";
import { lifecycleOutboxOwnerModule } from "../domain/outbox-publish";
import {
  parseMaxTenants,
  sliceDueTenants,
} from "../domain/outbox-system-drain";
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from "../domain/outbox.repository";
import {
  DrainDueOutboxService,
  type DrainDueOutboxResult,
} from "./drain-due-outbox.service";

export interface DrainDueSystemOutboxInput {
  actorType: string;
  actorId: string;
  limit?: number | string;
  maxRounds?: number | string;
  maxTenants?: number | string;
}

export interface DrainDueSystemTenantResult extends DrainDueOutboxResult {
  tenantId: string;
}

export interface DrainDueSystemOutboxResult {
  tenants: number;
  emptiedTenants: number;
  leftoverTenants: boolean;
  claimed: number;
  published: number;
  retryWait: number;
  deadLetter: number;
  leftover: number;
  items: DrainDueSystemTenantResult[];
}

@Injectable()
export class DrainDueSystemOutboxService {
  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outbox: OutboxRepository,
    @Inject(DrainDueOutboxService)
    private readonly drainDueOutbox: DrainDueOutboxService,
  ) {}

  async execute(
    input: DrainDueSystemOutboxInput,
  ): Promise<DrainDueSystemOutboxResult> {
    if (input.actorType !== SERVICE_ACTOR_TYPE || !input.actorId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 需要服务身份",
        HttpStatus.FORBIDDEN,
      );
    }

    let maxTenants: number;
    try {
      maxTenants = parseMaxTenants(input.maxTenants);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const dueTenantIds = await this.outbox.listDueTenantIds({
      ownerModule: lifecycleOutboxOwnerModule(),
      now: new Date(),
      take: maxTenants + 1,
    });
    const sliced = sliceDueTenants(dueTenantIds, maxTenants);
    const items: DrainDueSystemTenantResult[] = [];
    for (const tenantId of sliced.tenantIds) {
      const drained = await this.drainDueOutbox.execute({
        tenantId,
        operatorId: input.actorId,
        limit: input.limit,
        maxRounds: input.maxRounds,
      });
      items.push({ tenantId, ...drained });
    }

    return {
      tenants: items.length,
      emptiedTenants: items.filter((item) => item.emptied).length,
      leftoverTenants: sliced.leftoverTenants,
      claimed: items.reduce((sum, item) => sum + item.claimed, 0),
      published: items.reduce((sum, item) => sum + item.published, 0),
      retryWait: items.reduce((sum, item) => sum + item.retryWait, 0),
      deadLetter: items.reduce((sum, item) => sum + item.deadLetter, 0),
      leftover: items.reduce((sum, item) => sum + item.leftover, 0),
      items,
    };
  }
}
