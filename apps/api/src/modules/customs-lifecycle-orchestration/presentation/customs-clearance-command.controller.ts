import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  CustomsClearanceCaseDto,
  ReplaceCustomsClearanceCaseRequestDto,
} from "../../../contracts/customs-clearance.dto";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { ReplaceCustomsClearanceAndReplayService } from "../application/replace-customs-clearance-and-replay.service";

@ApiTags("containers")
@Controller("containers/:containerId/customs-clearance-case")
export class CustomsClearanceCommandController {
  constructor(
    private readonly replaceCase: ReplaceCustomsClearanceAndReplayService,
  ) {}

  @Post()
  @RequireCapabilities("container.operate")
  @ApiOkResponse({ type: CustomsClearanceCaseDto })
  replace(
    @Param("containerId") containerRecordId: string,
    @Body() body: ReplaceCustomsClearanceCaseRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<CustomsClearanceCaseDto> {
    return this.replaceCase.execute({
      tenantId: request.identity.tenantId,
      containerRecordId,
      expectedVersion: body.expectedVersion,
      jurisdictionCountryCode: body.jurisdictionCountryCode,
      customsBrokerPartyId: body.customsBrokerPartyId,
      declarationNumber: body.declarationNumber,
      filingState: body.filingState,
      decisionState: body.decisionState,
      activeHoldCodes: body.activeHoldCodes,
      ingestionChannel: "manual_ui",
      sourceSystem: "logix.web",
      evidenceRefs: body.evidenceRefs,
      actorId: request.identity.actorId,
      reasonCode: body.reasonCode,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
