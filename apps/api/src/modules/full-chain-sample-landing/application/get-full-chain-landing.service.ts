import { Injectable } from "@nestjs/common";
import type { AuthenticatedUserIdentity } from "../../identity";
import type { FullChainLandingRepository } from "../domain/full-chain-landing.repository";
import { FullChainLandingPolicy } from "./full-chain-landing-policy";

@Injectable()
export class GetFullChainLandingService {
  constructor(
    private readonly policy: FullChainLandingPolicy,
    private readonly repository: FullChainLandingRepository,
  ) {}

  async execute(identity: AuthenticatedUserIdentity, runId: string) {
    this.policy.assertCanRead(identity);
    const result = await this.repository.getStatus({
      tenantId: identity.tenantId,
      runId,
    });
    if (!result) throw new Error("FULL_CHAIN_LANDING_NOT_FOUND");
    return result;
  }
}
