import { Inject, Injectable } from "@nestjs/common";
import type { StartPostDepartureLifecycleCommandV2 } from "@logix/contracts";
import {
  POST_DEPARTURE_LIFECYCLE_REPOSITORY,
  type InitializePostDepartureLifecycleResult,
  type PostDepartureLifecycleRepository,
} from "../domain/post-departure-lifecycle.repository";

export interface InitializePostDepartureLifecycleInput {
  tenantId: string;
  command: StartPostDepartureLifecycleCommandV2;
  completeInbox: {
    id: string;
    owner: string;
    processedAt: Date;
  };
}

@Injectable()
export class InitializePostDepartureLifecycleService {
  constructor(
    @Inject(POST_DEPARTURE_LIFECYCLE_REPOSITORY)
    private readonly repository: PostDepartureLifecycleRepository,
  ) {}

  execute(
    input: InitializePostDepartureLifecycleInput,
  ): Promise<InitializePostDepartureLifecycleResult> {
    return this.repository.initialize(input);
  }
}
