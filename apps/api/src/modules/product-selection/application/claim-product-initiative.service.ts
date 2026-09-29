import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ProductInitiativeClaimCommandV1,
  ProductInitiativeNpiQueuePageV1,
} from "@logix/contracts";
import { prepareProductInitiativeClaim } from "../domain/product-initiative-claim";
import { ProductInitiativeNotFoundError } from "../domain/product-initiative";
import {
  PRODUCT_INITIATIVE_REPOSITORY,
  type ProductInitiativeRepository,
} from "../domain/product-initiative.repository";
import { toQueueEntry } from "./list-npi-queue.service";
import { throwProductInitiativeHttpError } from "./product-initiative-errors";

type NpiQueueEntryV1 = ProductInitiativeNpiQueuePageV1["items"][number];

/**
 * 领取立项：把它接到操作人名下。
 *
 * 只改"谁负责推进"，不改立项阶段的任何结论 —— 那些在不可变快照里只读。
 * 领取后返回**整条待办**（快照 + 领取状态），界面据此就地显示"已由我负责"，
 * 不必再拉一次队列。
 */
@Injectable()
export class ClaimProductInitiativeService {
  constructor(
    @Inject(PRODUCT_INITIATIVE_REPOSITORY)
    private readonly repository: ProductInitiativeRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    handoffId: string;
    command: ProductInitiativeClaimCommandV1;
  }): Promise<NpiQueueEntryV1> {
    if (!input.tenantId || !input.actorId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    try {
      const current = await this.repository.findNpiEntry(
        input.tenantId,
        input.handoffId,
      );
      if (!current) {
        throw new ProductInitiativeNotFoundError(
          "PRODUCT_INITIATIVE_HANDOFF_NOT_FOUND",
        );
      }
      const result = await this.repository.appendClaim({
        tenantId: input.tenantId,
        handoffId: input.handoffId,
        command: prepareProductInitiativeClaim(
          {
            claimVersion: current.claim?.claimVersion ?? 0,
            productOwnerActorId: current.claim?.productOwnerActorId ?? null,
          },
          input.actorId,
          input.command,
        ),
      });
      return toQueueEntry({
        handoff: current.handoff,
        claim: result.record,
        initiativeVersion: current.initiativeVersion,
        initiativeDestination: current.initiativeDestination,
      });
    } catch (error) {
      throwProductInitiativeHttpError(error);
    }
  }
}
