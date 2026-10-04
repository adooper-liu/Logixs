import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiProperty, ApiTags } from "@nestjs/swagger";
import type {
  MarketSelectionReturnTakebackCommandV1,
  ProductInitiativeV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { TakeBackSelectionReturnService } from "../application/take-back-selection-return.service";
import { ProductInitiativeResponseDto } from "./product-initiative.dto";

class SelectionReturnTakebackRequestDto implements MarketSelectionReturnTakebackCommandV1 {
  @ApiProperty({ enum: ["market-selection-return-takeback.v1"] })
  contractVersion!: "market-selection-return-takeback.v1";
  @ApiProperty() expectedSignalVersion!: number;
  @ApiProperty() idempotencyKey!: string;
}

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

@ApiTags("market-signals")
@Controller("market-signals")
export class SelectionReturnTakebackController {
  constructor(private readonly takeBack: TakeBackSelectionReturnService) {}

  @Post(":signalId/selection-return/takeback")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ProductInitiativeResponseDto })
  execute(
    @Req() request: IdentityRequest,
    @Param("signalId") signalId: string,
    @Body() body: SelectionReturnTakebackRequestDto,
  ): Promise<ProductInitiativeV1> {
    return this.takeBack.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      signalId: parseSignalId(signalId),
      command: body,
    });
  }
}

function parseSignalId(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException("VALIDATION_FORMAT: signalId");
  }
  return value.toLowerCase();
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
