import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  parseDrainRounds,
  shouldContinueOutboxDrain,
} from "../domain/outbox-publish";
import { PublishOutboxBatchService } from "./publish-outbox-batch.service";

export interface DrainDueOutboxInput {
  tenantId: string;
  operatorId: string;
  limit?: number | string;
  maxRounds?: number | string;
}

export interface DrainDueOutboxResult {
  rounds: number;
  emptied: boolean;
  claimed: number;
  published: number;
  retryWait: number;
  deadLetter: number;
  leftover: number;
}

@Injectable()
export class DrainDueOutboxService {
  constructor(
    @Inject(PublishOutboxBatchService)
    private readonly publishOutboxBatch: PublishOutboxBatchService,
  ) {}

  async execute(input: DrainDueOutboxInput): Promise<DrainDueOutboxResult> {
    if (!input.tenantId.trim()) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户",
        HttpStatus.FORBIDDEN,
      );
    }
    if (!input.operatorId.trim()) {
      throw new HttpException(
        "AUTHENTICATION_REQUIRED",
        HttpStatus.UNAUTHORIZED,
      );
    }

    let maxRounds: number;
    try {
      maxRounds = parseDrainRounds(input.maxRounds);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "VALIDATION_FORMAT",
        HttpStatus.BAD_REQUEST,
      );
    }

    const totals: DrainDueOutboxResult = {
      rounds: 0,
      emptied: false,
      claimed: 0,
      published: 0,
      retryWait: 0,
      deadLetter: 0,
      leftover: 0,
    };

    while (true) {
      const batch = await this.publishOutboxBatch.execute({
        tenantId: input.tenantId,
        operatorId: input.operatorId,
        limit: input.limit,
      });
      totals.rounds += 1;
      totals.claimed += batch.claimed;
      totals.published += batch.published;
      totals.retryWait += batch.retryWait;
      totals.deadLetter += batch.deadLetter;
      totals.leftover += batch.leftover;
      if (
        !shouldContinueOutboxDrain({
          claimed: batch.claimed,
          round: totals.rounds,
          maxRounds,
        })
      ) {
        totals.emptied = batch.claimed === 0;
        break;
      }
    }

    return totals;
  }
}
