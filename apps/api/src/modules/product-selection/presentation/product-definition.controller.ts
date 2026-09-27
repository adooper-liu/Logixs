import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { ProductDefinitionV1 } from "@logix/contracts";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { AdvanceProductDefinitionService } from "../application/advance-product-definition.service";
import { GetProductDefinitionService } from "../application/get-product-definition.service";
import { ReleaseProductDefinitionService } from "../application/release-product-definition.service";
import {
  ProductDefinitionReleaseRequestDto,
  ProductDefinitionResponseDto,
  ProductDefinitionWriteRequestDto,
} from "./product-definition.dto";

type IdentityRequest = { identity: { tenantId: string; actorId: string } };

/**
 * 产品定义的服务端入口。**按立项交接快照寻址**（一票一行）——
 * 运营是在"我领的那一票"上下文里推进，不是在产品定义 id 上下文里。
 */
@ApiTags("product-definitions")
@Controller("product-definitions")
export class ProductDefinitionController {
  constructor(
    private readonly getDefinition: GetProductDefinitionService,
    private readonly advanceDefinition: AdvanceProductDefinitionService,
    private readonly releaseDefinition: ReleaseProductDefinitionService,
  ) {}

  @Get(":initiativeHandoffId")
  @RequireCapabilities("planning.read")
  @ApiOkResponse({ type: ProductDefinitionResponseDto })
  get(
    @Req() request: IdentityRequest,
    @Param("initiativeHandoffId") initiativeHandoffId: string,
  ): Promise<ProductDefinitionV1 | null> {
    return this.getDefinition.execute({
      tenantId: request.identity.tenantId,
      initiativeHandoffId,
    });
  }

  @Post(":initiativeHandoffId/writes")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ProductDefinitionResponseDto })
  write(
    @Req() request: IdentityRequest,
    @Param("initiativeHandoffId") initiativeHandoffId: string,
    @Body() body: ProductDefinitionWriteRequestDto,
  ): Promise<ProductDefinitionV1> {
    return this.advanceDefinition.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      initiativeHandoffId,
      command: body,
    });
  }

  @Post(":initiativeHandoffId/releases")
  @RequireCapabilities("planning.draft")
  @ApiOkResponse({ type: ProductDefinitionResponseDto })
  release(
    @Req() request: IdentityRequest,
    @Param("initiativeHandoffId") initiativeHandoffId: string,
    @Body() body: ProductDefinitionReleaseRequestDto,
  ): Promise<ProductDefinitionV1> {
    return this.releaseDefinition.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      initiativeHandoffId,
      command: body,
    });
  }
}
