import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ComputeOverdueDeadlinesService } from "../application/compute-overdue-deadlines.service";
import { ReplaceOverdueStandardsService } from "../application/replace-overdue-standards.service";
import type { OverdueStandardWrite } from "../domain/overdue-standard.repository";
import {
  ComputeOverdueDeadlinesRequestDto,
  OverdueDeadlinesResponseDto,
  ReplaceOverdueStandardsRequestDto,
  ReplaceOverdueStandardsResponseDto,
} from "./overdue-deadlines.dto";

const HTTP_BY_CODE: Record<string, HttpStatus> = {
  VALIDATION_REQUIRED: HttpStatus.BAD_REQUEST,
  BUSINESS_PRECONDITION_FAILED: HttpStatus.UNPROCESSABLE_ENTITY,
};

@ApiTags("charges-settlement")
@Controller()
export class OverdueDeadlinesController {
  constructor(
    private readonly replaceStandards: ReplaceOverdueStandardsService,
    private readonly computeDeadlines: ComputeOverdueDeadlinesService,
  ) {}

  @Put("overdue-charge-standards")
  @ApiOkResponse({ type: ReplaceOverdueStandardsResponseDto })
  async replace(
    @Body() body: ReplaceOverdueStandardsRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ReplaceOverdueStandardsResponseDto> {
    if (!request.identity.tenantId || !request.identity.actorId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户或操作者",
        HttpStatus.FORBIDDEN,
      );
    }
    return this.replaceStandards.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      standards: body.standards.map(toStandard),
    });
  }

  @Post("overdue-deadlines/compute")
  @ApiOkResponse({ type: OverdueDeadlinesResponseDto })
  async compute(
    @Body() body: ComputeOverdueDeadlinesRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<OverdueDeadlinesResponseDto> {
    if (!request.identity.tenantId || !request.identity.actorId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户或操作者",
        HttpStatus.FORBIDDEN,
      );
    }
    const decision = await this.computeDeadlines.execute({
      tenantId: request.identity.tenantId,
      query: {
        portId: body.portId,
        shippingCompanyId: body.shippingCompanyId,
        freightForwarderId: body.freightForwarderId,
        transportMode: body.transportMode ?? null,
        terminalId: body.terminalId ?? null,
        referenceAt: parseTime(body.referenceAt),
      },
      clocks: {
        arrivalAt: parseOptional(body.arrivalAt),
        dischargeAt: parseOptional(body.dischargeAt),
        pickupAt: parseOptional(body.pickupAt),
      },
    });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.code}: ${decision.message}`,
        HTTP_BY_CODE[decision.code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return {
      latestPickupAt: toIso(decision.deadlines.latestPickupAt),
      latestReturnAt: toIso(decision.deadlines.latestReturnAt),
      matchedStandardIds: decision.deadlines.matchedStandardIds,
      returnClampedToPickup: decision.deadlines.returnClampedToPickup,
    };
  }
}

function toStandard(
  item: ReplaceOverdueStandardsRequestDto["standards"][number],
): OverdueStandardWrite {
  return {
    id: item.id ?? "",
    portId: item.portId,
    shippingCompanyId: item.shippingCompanyId,
    freightForwarderId: item.freightForwarderId,
    chargeType: item.chargeType,
    freeDays: item.freeDays,
    freeDaysBasis: item.freeDaysBasis,
    calculationBasis: item.calculationBasis,
    includeStartDay: item.includeStartDay,
    effectiveFrom: parseTime(item.effectiveFrom),
    effectiveTo: item.effectiveTo ? parseTime(item.effectiveTo) : null,
    transportMode: item.transportMode ?? null,
    terminalId: item.terminalId ?? null,
    tiers: (item.tiers ?? []).map((tier) => ({
      fromDay: tier.fromDay,
      toDay: tier.toDay ?? null,
      amount: tier.amount,
      currency: tier.currency,
    })),
  };
}

function parseOptional(value: string | null | undefined): Date | null {
  if (!value) return null;
  return parseTime(value);
}

function parseTime(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpException(
      "VALIDATION_FORMAT: 时刻不是合法 ISO 8601",
      HttpStatus.BAD_REQUEST,
    );
  }
  return parsed;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
