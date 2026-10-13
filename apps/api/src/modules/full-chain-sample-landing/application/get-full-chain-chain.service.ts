import { Injectable } from "@nestjs/common";
import type { AuthenticatedUserIdentity } from "../../identity";
import type { FullChainLandingRepository } from "../domain/full-chain-landing.repository";
import { FullChainLandingPolicy } from "./full-chain-landing-policy";

@Injectable()
export class GetFullChainChainService {
  constructor(
    private readonly policy: FullChainLandingPolicy,
    private readonly repository: FullChainLandingRepository,
  ) {}

  async execute(
    identity: AuthenticatedUserIdentity,
    runId: string,
    planNumber: string,
  ) {
    this.policy.assertCanRead(identity);
    const result = await this.repository.getChain({
      tenantId: identity.tenantId,
      runId,
      planNumber,
    });
    if (!result) throw new Error("FULL_CHAIN_LANDING_NOT_FOUND");
    return result;
  }
}
