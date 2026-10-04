import { Body, Controller, Param, Post, Req } from "@nestjs/common";
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
      signalId,
      command: body,
    });
  }
}
