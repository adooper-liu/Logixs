import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type {
  SupplierNominationHandoffV1,
  SupplierQuotationV1,
  SupplierV1,
} from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import {
  ListSourcingQueueService,
  NominateSupplierService,
  RecordQuotationService,
  RegisterSupplierService,
} from "../application/supplier-nomination.services";
import {
  NominateSupplierRequestDto,
  RecordQuotationRequestDto,
  RegisterSupplierRequestDto,
  SourcingQueueResponseDto,
  SupplierNominationResponseDto,
  SupplierQuotationResponseDto,
  SupplierResponseDto,
} from "./supplier-nomination.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

/**
 * 寻源与供应商定点工作台的服务端入口。
 *
 * 队列**按发布逐 SKU 展开** —— 寻源的对象是"这一个 SKU 找谁做"，不是"这一票"。
 */
@ApiTags("sourcing")
@Controller("sourcing")
export class SourcingController {
  constructor(
    private readonly listQueue: ListSourcingQueueService,
    private readonly registerSupplier: RegisterSupplierService,
    private readonly recordQuotation: RecordQuotationService,
    private readonly nominateSupplier: NominateSupplierService,
  ) {}

  @Get("queue")
  @RequireCapabilities("planning.read")
  @ApiQuery({ name: "take", required: false, type: Number })
  @ApiOkResponse({ type: SourcingQueueResponseDto })
  queue(@Req() request: IdentityRequest, @Query("take") take?: string) {
    return this.listQueue.execute({
      tenantId: request.identity.tenantId,
      take,
    });
  }

  @Post("suppliers")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: SupplierResponseDto })
  register(
    @Req() request: IdentityRequest,
    @Body() body: RegisterSupplierRequestDto,
  ): Promise<SupplierV1> {
    return this.registerSupplier.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      command: body,
    });
  }

  // 报价寻址：**哪家供应商 · 哪份发布 · 哪个 SKU** —— 三者缺一不可，
  // 因为报价就是这三者的组合。
  @Post("suppliers/:supplierId/releases/:skuReleaseId/skus/:skuId/quotations")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: SupplierQuotationResponseDto })
  quote(
    @Req() request: IdentityRequest,
    @Param("supplierId") supplierId: string,
    @Param("skuReleaseId") skuReleaseId: string,
    @Param("skuId") skuId: string,
    @Body() body: RecordQuotationRequestDto,
  ): Promise<SupplierQuotationV1> {
    return this.recordQuotation.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      supplierId,
      skuReleaseId,
      skuId,
      command: body,
    });
  }

  @Post("nominations")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: SupplierNominationResponseDto })
  nominate(
    @Req() request: IdentityRequest,
    @Body() body: NominateSupplierRequestDto,
  ): Promise<SupplierNominationHandoffV1> {
    return this.nominateSupplier.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      command: body,
    });
  }
}
