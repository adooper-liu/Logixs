import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { ProductIdentityV1 } from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { DraftProductIdentityService } from "../application/draft-product-identity.service";
import { GetProductIdentityService } from "../application/get-product-identity.service";
import { ListProductIdentityQueueService } from "../application/list-product-identity-queue.service";
import { ReleaseSellableSkuService } from "../application/release-sellable-sku.service";
import {
  ProductIdentityDraftRequestDto,
  ProductIdentityQueuePageResponseDto,
  ProductIdentityResponseDto,
  SellableSkuReleaseRequestDto,
} from "./product-identity.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

/**
 * 商品与物料主数据工作台的服务端入口。
 *
 * **按发布快照寻址**（`releaseId` 就是那份 `released_product_design` 的 id）——
 * 运营是在"这一票已发布的设计"上下文里建档，不是在产品 id 上下文里。
 */
@ApiTags("product-identities")
@Controller("product-identities")
export class ProductIdentitiesController {
  constructor(
    private readonly listQueue: ListProductIdentityQueueService,
    private readonly getIdentity: GetProductIdentityService,
    private readonly draftIdentity: DraftProductIdentityService,
    private readonly releaseIdentity: ReleaseSellableSkuService,
  ) {}

  @Get("queue")
  @RequireCapabilities("planning.read")
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiOkResponse({ type: ProductIdentityQueuePageResponseDto })
  queue(
    @Req() request: IdentityRequest,
    @Query("pageSize") pageSize?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.listQueue.execute({
      tenantId: request.identity.tenantId,
      pageSize,
      cursor,
    });
  }

  @Get(":releaseId")
  @RequireCapabilities("planning.read")
  @ApiOkResponse({ type: ProductIdentityResponseDto })
  get(
    @Req() request: IdentityRequest,
    @Param("releaseId") releaseId: string,
  ): Promise<ProductIdentityV1 | null> {
    return this.getIdentity.execute({
      tenantId: request.identity.tenantId,
      releaseId,
    });
  }

  @Post(":releaseId/drafts")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ProductIdentityResponseDto })
  draft(
    @Req() request: IdentityRequest,
    @Param("releaseId") releaseId: string,
    @Body() body: ProductIdentityDraftRequestDto,
  ): Promise<ProductIdentityV1> {
    return this.draftIdentity.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      releaseId,
      command: body,
    });
  }

  @Post(":releaseId/releases")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ProductIdentityResponseDto })
  release(
    @Req() request: IdentityRequest,
    @Param("releaseId") releaseId: string,
    @Body() body: SellableSkuReleaseRequestDto,
  ): Promise<ProductIdentityV1> {
    return this.releaseIdentity.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      releaseId,
      command: body,
    });
  }
}
