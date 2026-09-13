import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { SetNodeApplicabilityService } from "../application/set-node-applicability.service";
import {
  SetNodeApplicabilityRequestDto,
  SetNodeApplicabilityResponseDto,
} from "./lifecycle.dto";

@ApiTags("containers")
@Controller("containers/:containerId/node-applicability")
export class NodeApplicabilityController {
  constructor(
    private readonly setNodeApplicability: SetNodeApplicabilityService,
  ) {}

  @Post()
  @ApiOkResponse({ type: SetNodeApplicabilityResponseDto })
  apply(
    @Param("containerId") containerId: string,
    @Body() body: SetNodeApplicabilityRequestDto,
    @Req() request: { devIdentity: { tenantId: string; operatorId: string } },
  ): Promise<SetNodeApplicabilityResponseDto> {
    return this.setNodeApplicability.execute({
      containerId,
      tenantId: request.devIdentity.tenantId,
      nodeCode: body.nodeCode,
      applicability: body.applicability,
      evidenceRefs: body.evidenceRefs,
      reasonCode: body.reasonCode,
      actorId: request.devIdentity.operatorId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
