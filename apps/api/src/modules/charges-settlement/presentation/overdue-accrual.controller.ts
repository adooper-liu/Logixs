import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ComputeOverdueAccrualService } from "../application/compute-overdue-accrual.service";
import {
  ComputeOverdueAccrualRequestDto,
  OverdueAccrualResponseDto,
} from "./overdue-accrual.dto";

const HTTP_BY_CODE: Record<string, HttpStatus> = {
  VALIDATION_REQUIRED: HttpStatus.BAD_REQUEST,
  BUSINESS_PRECONDITION_FAILED: HttpStatus.UNPROCESSABLE_ENTITY,
};

@ApiTags("charges-settlement")
@Controller()
export class OverdueAccrualController {
  constructor(private readonly computeAccrual: ComputeOverdueAccrualService) {}

  @Post("overdue-accrual/compute")
  @ApiOkResponse({ type: OverdueAccrualResponseDto })
  async compute(
    @Body() body: ComputeOverdueAccrualRequestDto,
    @Req() request: { identity: { tenantId: string; actorId: string } },
  ): Promise<OverdueAccrualResponseDto> {
    if (!request.identity.tenantId || !request.identity.actorId) {
      throw new HttpException(
        "AUTHORIZATION_SCOPE_DENIED: 缺少租户或操作者",
        HttpStatus.FORBIDDEN,
      );
    }
    const decision = await this.computeAccrual.execute({
      tenantId: request.identity.tenantId,
      purpose: body.purpose,
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
      asOf: parseTime(body.asOf),
    });
    if (decision.kind === "reject") {
      throw new HttpException(
        `${decision.code}: ${decision.message}`,
        HTTP_BY_CODE[decision.code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return {
      purpose: decision.purpose,
      lines: decision.lines.map((line) => ({
        standardId: line.standardId,
        chargeType: line.chargeType,
        lastFreeDay: line.lastFreeDay.toISOString(),
        firstChargeDay: toIso(line.firstChargeDay),
        lastChargeDay: toIso(line.lastChargeDay),
        chargeDays: line.chargeDays,
        currency: line.currency,
        amount: line.amount,
        daily: line.daily.map((item) => ({
          date: item.date.toISOString(),
          dayNumber: item.dayNumber,
          rate: item.rate,
          amount: item.amount,
        })),
      })),
      totals: decision.totals,
    };
  }
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
