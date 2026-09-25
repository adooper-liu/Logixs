import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  ShipmentHandoffPreflightResultV1,
  ShipmentHandoffResultV1,
  InternalShipmentHandoffAcceptResultV1,
  InternalShipmentHandoffBatchAcceptResultV1,
  InternalShipmentHandoffCandidatePageV1,
  ShipmentPendingFactCompletionResultV1,
  ShipmentPendingCargoCompletionResultV1,
  ShipmentPendingSkuBindingResultV1,
  ShipmentPendingDocumentCompletionResultV1,
} from "@logix/contracts";
import { AcceptInternalShipmentHandoffService } from "../application/accept-internal-shipment-handoff.service";
import { AcceptInternalShipmentHandoffBatchService } from "../application/accept-internal-shipment-handoff-batch.service";
import { ListInternalShipmentHandoffCandidatesService } from "../application/list-internal-shipment-handoff-candidates.service";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
import { AcceptShipmentHandoffService } from "../application/accept-shipment-handoff.service";
import { PreflightShipmentHandoffService } from "../application/preflight-shipment-handoff.service";
import { CompleteShipmentPendingFactsService } from "../application/complete-shipment-pending-facts.service";
import { CompleteShipmentPendingCargoService } from "../application/complete-shipment-pending-cargo.service";
import { BindShipmentPendingSkuService } from "../application/bind-shipment-pending-sku.service";
import { CompleteShipmentPendingDocumentsService } from "../application/complete-shipment-pending-documents.service";
import {
  ShipmentHandoffCommandRequestDto,
  ShipmentHandoffPreflightResponseDto,
  ShipmentHandoffResultResponseDto,
  InternalShipmentHandoffAcceptRequestDto,
  InternalShipmentHandoffBatchAcceptRequestDto,
  ShipmentPendingFactCompletionRequestDto,
  ShipmentPendingCargoCompletionRequestDto,
  ShipmentPendingSkuBindingRequestDto,
  ShipmentPendingDocumentCompletionRequestDto,
} from "./shipment-handoff.dto";

type IdentityRequest = {
  identity: { tenantId: string; actorId: string };
};

@ApiTags("shipment-handoffs")
@Controller("shipment-handoffs")
export class ShipmentHandoffController {
  constructor(
    private readonly preflightHandoff: PreflightShipmentHandoffService,
    private readonly acceptHandoff: AcceptShipmentHandoffService,
    private readonly listInternalCandidates: ListInternalShipmentHandoffCandidatesService,
    private readonly acceptInternalCandidate: AcceptInternalShipmentHandoffService,
    private readonly acceptInternalBatch: AcceptInternalShipmentHandoffBatchService,
    private readonly completePendingFacts: CompleteShipmentPendingFactsService,
    private readonly completePendingCargo: CompleteShipmentPendingCargoService,
    private readonly bindPendingSku: BindShipmentPendingSkuService,
    private readonly completePendingDocuments: CompleteShipmentPendingDocumentsService,
  ) {}

  @Get("internal-candidates")
  @RequireCapabilities("container.read", "lifecycle.read")
  listInternal(
    @Req() request: IdentityRequest,
  ): Promise<InternalShipmentHandoffCandidatePageV1> {
    return this.listInternalCandidates.execute(request.identity);
  }

  @Post("shipments/:shipmentId/pending-cargo")
  @RequireCapabilities("lifecycle.operate")
  completeShipmentPendingCargo(
    @Param("shipmentId") shipmentId: string,
    @Body() body: ShipmentPendingCargoCompletionRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<ShipmentPendingCargoCompletionResultV1> {
    return this.completePendingCargo.execute(
      shipmentId,
      body,
      request.identity,
    );
  }

  @Post("shipments/:shipmentId/pending-sku-binding")
  @RequireCapabilities("lifecycle.operate")
  bindShipmentPendingSku(
    @Param("shipmentId") shipmentId: string,
    @Body() body: ShipmentPendingSkuBindingRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<ShipmentPendingSkuBindingResultV1> {
    return this.bindPendingSku.execute(shipmentId, body, request.identity);
  }

  @Post("shipments/:shipmentId/pending-documents")
  @RequireCapabilities("lifecycle.operate")
  completeShipmentPendingDocuments(
    @Param("shipmentId") shipmentId: string,
    @Body() body: ShipmentPendingDocumentCompletionRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<ShipmentPendingDocumentCompletionResultV1> {
    return this.completePendingDocuments.execute(
      shipmentId,
      body,
      request.identity,
    );
  }

  @Post("shipments/:shipmentId/pending-facts")
  @RequireCapabilities("lifecycle.operate")
  completeShipmentPendingFacts(
    @Param("shipmentId") shipmentId: string,
    @Body() body: ShipmentPendingFactCompletionRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<ShipmentPendingFactCompletionResultV1> {
    return this.completePendingFacts.execute(
      shipmentId,
      body,
      request.identity,
    );
  }

  @Post("internal-candidates/accept")
  @RequireCapabilities("import.execute")
  acceptInternal(
    @Body() body: InternalShipmentHandoffAcceptRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<InternalShipmentHandoffAcceptResultV1> {
    return this.acceptInternalCandidate.execute(body, request.identity);
  }

  @Post("internal-candidates/accept-batch")
  @RequireCapabilities("import.execute")
  acceptInternalCandidates(
    @Body() body: InternalShipmentHandoffBatchAcceptRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<InternalShipmentHandoffBatchAcceptResultV1> {
    return this.acceptInternalBatch.execute(body, request.identity);
  }

  @Post("preflight")
  @RequireCapabilities("import.operate")
  @ApiOkResponse({ type: ShipmentHandoffPreflightResponseDto })
  preflight(
    @Body() body: ShipmentHandoffCommandRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<ShipmentHandoffPreflightResultV1> {
    return this.preflightHandoff.preflight(body, request.identity);
  }

  @Post("accept")
  @RequireCapabilities("import.execute")
  @ApiOkResponse({ type: ShipmentHandoffResultResponseDto })
  accept(
    @Body() body: ShipmentHandoffCommandRequestDto,
    @Req() request: IdentityRequest,
  ): Promise<ShipmentHandoffResultV1> {
    return this.acceptHandoff.accept(body, request.identity);
  }
}
