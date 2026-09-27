import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  MarketSignalDecisionResultV1,
  MarketSignalDetailV1,
  MarketSignalPageV1,
  MarketSignalV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { CreateMarketSignalService } from "../application/create-market-signal.service";
import { DecideMarketSignalService } from "../application/decide-market-signal.service";
import { ListMarketSignalsService } from "../application/list-market-signals.service";
import { GetMarketSignalService } from "../application/get-market-signal.service";
import { UpdateMarketSignalService } from "../application/update-market-signal.service";
import {
  MarketSignalCreateRequestDto,
  MarketSignalDecisionRequestDto,
  MarketSignalDecisionResponseDto,
  MarketSignalDetailResponseDto,
  MarketSignalPageResponseDto,
  MarketSignalResponseDto,
  MarketSignalUpdateRequestDto,
} from "./market-signal.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

@ApiTags("market-signals")
@Controller("market-signals")
export class MarketSignalsController {
  constructor(
    private readonly createSignal: CreateMarketSignalService,
    private readonly listSignals: ListMarketSignalsService,
    private readonly updateSignal: UpdateMarketSignalService,
    private readonly decideSignal: DecideMarketSignalService,
    private readonly getSignal: GetMarketSignalService,
  ) {}

  @Get()
  @RequireCapabilities("planning.read")
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiOkResponse({ type: MarketSignalPageResponseDto })
  list(
    @Req() request: IdentityRequest,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ): Promise<MarketSignalPageV1> {
    return this.listSignals.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
    });
  }

  @Get(":id")
  @RequireCapabilities("planning.read")
  @ApiOkResponse({ type: MarketSignalDetailResponseDto })
  get(
    @Req() request: IdentityRequest,
    @Param("id") signalId: string,
  ): Promise<MarketSignalDetailV1> {
    return this.getSignal.execute({
      tenantId: request.identity.tenantId,
      signalId,
    });
  }

  @Post()
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: MarketSignalResponseDto })
  create(
    @Req() request: IdentityRequest,
    @Body() body: MarketSignalCreateRequestDto,
  ): Promise<MarketSignalV1> {
    return this.createSignal.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      command: body,
    });
  }

  @Patch(":id")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: MarketSignalResponseDto })
  update(
    @Req() request: IdentityRequest,
    @Param("id") signalId: string,
    @Body() body: MarketSignalUpdateRequestDto,
  ): Promise<MarketSignalV1> {
    return this.updateSignal.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      signalId,
      command: body,
    });
  }

  @Post(":id/decisions")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: MarketSignalDecisionResponseDto })
  decide(
    @Req() request: IdentityRequest,
    @Param("id") signalId: string,
    @Body() body: MarketSignalDecisionRequestDto,
  ): Promise<MarketSignalDecisionResultV1> {
    return this.decideSignal.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      signalId,
      command: body,
    });
  }
}
