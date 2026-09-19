import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { BlockNodeService } from "../application/block-node.service";
import { ResolveNodeBlockService } from "../application/resolve-node-block.service";
import {
  BlockNodeRequestDto,
  BlockNodeResponseDto,
  ResolveNodeBlockRequestDto,
  ResolveNodeBlockResponseDto,
} from "./lifecycle.dto";

@ApiTags("lifecycle")
@Controller("lifecycle-flows/:flowInstanceId/node-blocks")
export class LifecycleNodeBlocksController {
  constructor(
    private readonly blockNode: BlockNodeService,
    private readonly resolveNodeBlock: ResolveNodeBlockService,
  ) {}

  @Post()
  @RequireCapabilities("lifecycle.operate")
  @ApiOkResponse({ type: BlockNodeResponseDto })
  create(
    @Param("flowInstanceId") flowInstanceId: string,
    @Body() body: BlockNodeRequestDto,
    @Req()
    request: { identity: { tenantId: string; actorId: string } },
  ): Promise<BlockNodeResponseDto> {
    return this.blockNode.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      flowInstanceId,
      blockId: body.block.blockId,
      blockType: body.block.blockType,
      sourceFactId: body.block.sourceFactId,
      occurredAt: body.block.occurredAt,
      nodeInstanceId: body.block.nodeInstanceId,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      traceId: body.traceId,
    });
  }

  @Post(":blockId/resolve")
  @RequireCapabilities("lifecycle.operate")
  @ApiOkResponse({ type: ResolveNodeBlockResponseDto })
  resolve(
    @Param("flowInstanceId") flowInstanceId: string,
    @Param("blockId") blockId: string,
    @Body() body: ResolveNodeBlockRequestDto,
    @Req()
    request: { identity: { tenantId: string; actorId: string } },
  ): Promise<ResolveNodeBlockResponseDto> {
    return this.resolveNodeBlock.execute({
      tenantId: request.identity.tenantId,
      actorId: request.identity.actorId,
      flowInstanceId,
      blockId,
      resolvedAt: body.resolvedAt,
      reasonCode: body.reasonCode,
      expectedVersion: body.expectedVersion,
      idempotencyKey: body.idempotencyKey,
      traceId: body.traceId,
    });
  }
}
