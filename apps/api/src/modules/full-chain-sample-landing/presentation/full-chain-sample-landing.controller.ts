import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ApplyFullChainPackageService } from "../application/apply-full-chain-package.service";
import { GetFullChainChainService } from "../application/get-full-chain-chain.service";
import { GetFullChainLandingService } from "../application/get-full-chain-landing.service";
import {
  FullChainLandingApplyRequestDto,
  FullChainLandingChainDto,
  FullChainLandingResultDto,
  FullChainLandingStatusDto,
} from "./full-chain-sample-landing.dto";

type IdentityRequest = {
  identity: Parameters<ApplyFullChainPackageService["execute"]>[0]["identity"];
};

@ApiTags("full-chain-sample-landings")
@Controller("full-chain-sample-landings")
export class FullChainSampleLandingController {
  constructor(
    private readonly applyPackage: ApplyFullChainPackageService,
    private readonly getLanding: GetFullChainLandingService,
    private readonly getChain: GetFullChainChainService,
  ) {}

  @Post()
  @RequireCapabilities("import.execute")
  @ApiOkResponse({ type: FullChainLandingResultDto })
  apply(
    @Req() request: IdentityRequest,
    @Body() body: FullChainLandingApplyRequestDto,
  ) {
    return this.applyPackage.execute({
      identity: request.identity,
      artifacts: body.artifacts,
      idempotencyKey: body.idempotencyKey,
      traceId: body.traceId,
    });
  }

  @Get(":runId")
  @RequireCapabilities("import.read")
  @ApiOkResponse({ type: FullChainLandingStatusDto })
  status(@Req() request: IdentityRequest, @Param("runId") runId: string) {
    return this.getLanding.execute(request.identity, runId);
  }

  @Get(":runId/chains/:planNumber")
  @RequireCapabilities("import.read")
  @ApiOkResponse({ type: FullChainLandingChainDto })
  chain(
    @Req() request: IdentityRequest,
    @Param("runId") runId: string,
    @Param("planNumber") planNumber: string,
  ) {
    return this.getChain.execute(request.identity, runId, planNumber);
  }
}
