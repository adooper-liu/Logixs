import {
  Module,
  forwardRef,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { ComplianceManagementModule } from "../compliance-management";
import { CustomsComplianceModule } from "../customs-compliance";
import { InlandFulfillmentModule } from "../inland-fulfillment";
import {
  IdentityModule,
  DevIdentityMiddleware,
  DevServiceIdentityMiddleware,
} from "../identity";
import { NotificationModule } from "../notification";
import { ShipmentRegistryModule } from "../shipment-registry";
import { WorkExecutionModule } from "../work-execution";
import { LIST_CONTAINER_CURRENT_NODES } from "./list-container-current-nodes.port";
import { APPLY_LIFECYCLE_EVENT_ONCE } from "./apply-lifecycle-event-once.port";
import { RECORD_LIFECYCLE_DATE_FACT } from "./record-lifecycle-date-fact.port";
import { REPLAY_PENDING_LIFECYCLE_DATE_FACTS } from "./replay-pending-lifecycle-date-facts.port";
import { ASSERT_LIFECYCLE_STATE_EVIDENCE } from "./assert-lifecycle-state-evidence.port";
import { EVALUATE_LIFECYCLE_DATE_AUTHORITY } from "./evaluate-lifecycle-date-authority.port";
import {
  OUTBOX_DELIVERY,
  PublishOutboxBatchService,
} from "./application/publish-outbox-batch.service";
import { ApplyLifecycleEventService } from "./application/apply-lifecycle-event.service";
import { AssertLifecycleStateEvidenceService } from "./application/assert-lifecycle-state-evidence.service";
import { EvaluateLifecycleDateAuthorityService } from "./application/evaluate-lifecycle-date-authority.service";
import { ReplayPendingLifecycleDateFactsService } from "./application/replay-pending-lifecycle-date-facts.service";
import { ListLifecycleDateFactsService } from "./application/list-lifecycle-date-facts.service";
import { RecordLifecycleDateFactService } from "./application/record-lifecycle-date-fact.service";
import { ApproveLifecycleDateFactReviewService } from "./application/approve-lifecycle-date-fact-review.service";
import { ListLifecycleDateFactReviewsService } from "./application/list-lifecycle-date-fact-reviews.service";
import { InitializeContainerFlowService } from "./application/initialize-container-flow.service";
import { InitializePostDepartureLifecycleService } from "./application/initialize-post-departure-lifecycle.service";
import { DrainDueOutboxService } from "./application/drain-due-outbox.service";
import { DrainDueSystemOutboxService } from "./application/drain-due-system-outbox.service";
import { ListDeadLettersService } from "./application/list-dead-letters.service";
import { ClaimInboxBatchService } from "./application/claim-inbox-batch.service";
import { GetClientOperationService } from "./application/get-client-operation.service";
import { GetCompensationService } from "./application/get-compensation.service";
import { ListClientOperationsService } from "./application/list-client-operations.service";
import { ListCompensationsService } from "./application/list-compensations.service";
import { ListLifecycleEventsService } from "./application/list-lifecycle-events.service";
import { ListLifecycleNodesService } from "./application/list-lifecycle-nodes.service";
import { ListContainerCurrentNodesService } from "./application/list-container-current-nodes.service";
import { ListContainerLifecycleNodesService } from "./application/list-container-lifecycle-nodes.service";
import { ListObjectActivitiesService } from "./application/list-object-activities.service";
import { ResolveNotificationTargetService } from "./application/resolve-notification-target.service";
import { RequestCompensationService } from "./application/request-compensation.service";
import { ResolveCompensationService } from "./application/resolve-compensation.service";
import {
  INBOX_CONSUMPTION,
  ProcessInboxBatchService,
} from "./application/process-inbox-batch.service";
import { ReceiveInboxMessageService } from "./application/receive-inbox-message.service";
import { SubmitClientOperationService } from "./application/submit-client-operation.service";
import { ListInboxDeadLettersService } from "./application/list-inbox-dead-letters.service";
import { ReplayInboxDeadLetterService } from "./application/replay-inbox-dead-letter.service";
import { ReplayDeadLetterService } from "./application/replay-dead-letter.service";
import { SetNodeApplicabilityService } from "./application/set-node-applicability.service";
import { BlockNodeService } from "./application/block-node.service";
import { ResolveNodeBlockService } from "./application/resolve-node-block.service";
import { ReplaceOceanRouteService } from "./application/replace-ocean-route.service";
import { GetCurrentOceanRouteService } from "./application/get-current-ocean-route.service";
import { LIFECYCLE_REPOSITORY } from "./domain/lifecycle.repository";
import { CLIENT_OPERATION_REPOSITORY } from "./domain/client-operation.repository";
import { COMPENSATION_REPOSITORY } from "./domain/compensation.repository";
import { INBOX_REPOSITORY } from "./domain/inbox.repository";
import { OUTBOX_REPOSITORY } from "./domain/outbox.repository";
import { POST_DEPARTURE_LIFECYCLE_REPOSITORY } from "./domain/post-departure-lifecycle.repository";
import { LIFECYCLE_DATE_FACT_REPOSITORY } from "./domain/lifecycle-date-fact.repository";
import { SOURCE_AUTHORITY_POLICY_REPOSITORY } from "./domain/source-authority-policy.repository";
import { PrismaClientOperationRepository } from "./infrastructure/prisma-client-operation.repository";
import { PrismaCompensationRepository } from "./infrastructure/prisma-compensation.repository";
import { PrismaInboxRepository } from "./infrastructure/prisma-inbox.repository";
import { PrismaLifecycleDateFactRepository } from "./infrastructure/prisma-lifecycle-date-fact.repository";
import { PrismaSourceAuthorityPolicyRepository } from "./infrastructure/prisma-source-authority-policy.repository";
import { LifecycleInboxConsumption } from "./infrastructure/lifecycle-inbox-consumption";
import { PrismaLifecycleRepository } from "./infrastructure/prisma-lifecycle.repository";
import { PrismaOutboxRepository } from "./infrastructure/prisma-outbox.repository";
import { PrismaPostDepartureLifecycleRepository } from "./infrastructure/prisma-post-departure-lifecycle.repository";
import { PrismaNodeBlockRepository } from "./infrastructure/prisma-node-block.repository";
import { StubOutboxDelivery } from "./infrastructure/stub-outbox-delivery";
import { WorkExecutionOutboxDelivery } from "./infrastructure/work-execution-outbox-delivery";
import { LifecycleController } from "./presentation/lifecycle.controller";
import { LifecycleNodesController } from "./presentation/lifecycle-nodes.controller";
import { LifecycleCurrentNodesController } from "./presentation/lifecycle-current-nodes.controller";
import { LifecycleNodesBatchController } from "./presentation/lifecycle-nodes-batch.controller";
import { NodeApplicabilityController } from "./presentation/node-applicability.controller";
import { OutboxController } from "./presentation/outbox.controller";
import { ClientOperationController } from "./presentation/client-operation.controller";
import { InboxController } from "./presentation/inbox.controller";
import { InboxDeadLetterController } from "./presentation/inbox-dead-letter.controller";
import { OutboxSystemController } from "./presentation/outbox-system.controller";
import { ObjectActivitiesController } from "./presentation/object-activities.controller";
import { LifecycleDateFactsController } from "./presentation/lifecycle-date-facts.controller";
import { LifecycleDateFactReviewsController } from "./presentation/lifecycle-date-fact-reviews.controller";
import { LifecycleNodeBlocksController } from "./presentation/lifecycle-node-blocks.controller";
import { NODE_BLOCK_REPOSITORY } from "./domain/node-block.repository";
import { OCEAN_ROUTE_REPOSITORY } from "./domain/ocean-route.repository";
import { PrismaOceanRouteRepository } from "./infrastructure/prisma-ocean-route.repository";
import { REPLACE_OCEAN_ROUTE } from "./replace-ocean-route.port";
import { OceanRoutesController } from "./presentation/ocean-routes.controller";

@Module({
  imports: [
    IdentityModule,
    NotificationModule,
    DocumentRecordsModule,
    ComplianceManagementModule,
    CustomsComplianceModule,
    InlandFulfillmentModule,
    ShipmentRegistryModule,
    forwardRef(() => WorkExecutionModule),
  ],
  controllers: [
    LifecycleController,
    LifecycleNodesController,
    LifecycleCurrentNodesController,
    LifecycleNodesBatchController,
    NodeApplicabilityController,
    OutboxController,
    OutboxSystemController,
    InboxController,
    InboxDeadLetterController,
    ClientOperationController,
    ObjectActivitiesController,
    LifecycleDateFactsController,
    LifecycleDateFactReviewsController,
    LifecycleNodeBlocksController,
    OceanRoutesController,
  ],
  providers: [
    ApplyLifecycleEventService,
    AssertLifecycleStateEvidenceService,
    EvaluateLifecycleDateAuthorityService,
    ReplayPendingLifecycleDateFactsService,
    RecordLifecycleDateFactService,
    ApproveLifecycleDateFactReviewService,
    ListLifecycleDateFactReviewsService,
    ListLifecycleDateFactsService,
    InitializeContainerFlowService,
    InitializePostDepartureLifecycleService,
    SetNodeApplicabilityService,
    BlockNodeService,
    ResolveNodeBlockService,
    ReplaceOceanRouteService,
    GetCurrentOceanRouteService,
    SubmitClientOperationService,
    GetClientOperationService,
    GetCompensationService,
    ListClientOperationsService,
    ListCompensationsService,
    ListLifecycleEventsService,
    ListLifecycleNodesService,
    ListContainerCurrentNodesService,
    ListContainerLifecycleNodesService,
    ListObjectActivitiesService,
    ResolveNotificationTargetService,
    RequestCompensationService,
    ResolveCompensationService,
    PublishOutboxBatchService,
    DrainDueOutboxService,
    DrainDueSystemOutboxService,
    ReplayDeadLetterService,
    ListDeadLettersService,
    ReceiveInboxMessageService,
    ClaimInboxBatchService,
    ProcessInboxBatchService,
    ListInboxDeadLettersService,
    ReplayInboxDeadLetterService,
    { provide: LIFECYCLE_REPOSITORY, useClass: PrismaLifecycleRepository },
    { provide: NODE_BLOCK_REPOSITORY, useClass: PrismaNodeBlockRepository },
    { provide: OCEAN_ROUTE_REPOSITORY, useClass: PrismaOceanRouteRepository },
    {
      provide: LIFECYCLE_DATE_FACT_REPOSITORY,
      useClass: PrismaLifecycleDateFactRepository,
    },
    {
      provide: SOURCE_AUTHORITY_POLICY_REPOSITORY,
      useClass: PrismaSourceAuthorityPolicyRepository,
    },
    { provide: OUTBOX_REPOSITORY, useClass: PrismaOutboxRepository },
    {
      provide: POST_DEPARTURE_LIFECYCLE_REPOSITORY,
      useClass: PrismaPostDepartureLifecycleRepository,
    },
    { provide: INBOX_REPOSITORY, useClass: PrismaInboxRepository },
    {
      provide: CLIENT_OPERATION_REPOSITORY,
      useClass: PrismaClientOperationRepository,
    },
    {
      provide: COMPENSATION_REPOSITORY,
      useClass: PrismaCompensationRepository,
    },
    StubOutboxDelivery,
    WorkExecutionOutboxDelivery,
    { provide: OUTBOX_DELIVERY, useExisting: WorkExecutionOutboxDelivery },
    { provide: INBOX_CONSUMPTION, useClass: LifecycleInboxConsumption },
    {
      provide: APPLY_LIFECYCLE_EVENT_ONCE,
      useExisting: ApplyLifecycleEventService,
    },
    {
      provide: ASSERT_LIFECYCLE_STATE_EVIDENCE,
      useExisting: AssertLifecycleStateEvidenceService,
    },
    {
      provide: EVALUATE_LIFECYCLE_DATE_AUTHORITY,
      useExisting: EvaluateLifecycleDateAuthorityService,
    },
    {
      provide: LIST_CONTAINER_CURRENT_NODES,
      useExisting: ListContainerCurrentNodesService,
    },
    {
      provide: RECORD_LIFECYCLE_DATE_FACT,
      useExisting: RecordLifecycleDateFactService,
    },
    {
      provide: REPLAY_PENDING_LIFECYCLE_DATE_FACTS,
      useExisting: ReplayPendingLifecycleDateFactsService,
    },
    {
      provide: REPLACE_OCEAN_ROUTE,
      useExisting: ReplaceOceanRouteService,
    },
  ],
  exports: [
    InitializeContainerFlowService,
    LIST_CONTAINER_CURRENT_NODES,
    RECORD_LIFECYCLE_DATE_FACT,
    REPLAY_PENDING_LIFECYCLE_DATE_FACTS,
    REPLACE_OCEAN_ROUTE,
    ListContainerCurrentNodesService,
    RecordLifecycleDateFactService,
  ],
})
export class LifecycleControlModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(
        LifecycleController,
        LifecycleNodesController,
        LifecycleCurrentNodesController,
        LifecycleNodesBatchController,
        NodeApplicabilityController,
        OutboxController,
        InboxDeadLetterController,
        ClientOperationController,
        ObjectActivitiesController,
        LifecycleDateFactsController,
        LifecycleDateFactReviewsController,
        LifecycleNodeBlocksController,
        OceanRoutesController,
      );
    consumer
      .apply(DevServiceIdentityMiddleware)
      .forRoutes(OutboxSystemController, InboxController);
  }
}
