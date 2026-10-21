import { Module } from "@nestjs/common";
import { AiGatewayService } from "./ai-gateway.service";
import { TASK_CLAIM_EXPLANATION } from "./ai-governance.port";

@Module({
  providers: [
    AiGatewayService,
    { provide: TASK_CLAIM_EXPLANATION, useExisting: AiGatewayService },
  ],
  exports: [AiGatewayService, TASK_CLAIM_EXPLANATION],
})
export class AiGovernanceModule {}
