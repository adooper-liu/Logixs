import {
  Module,
  forwardRef,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import {
  IdentityModule,
  DevIdentityMiddleware,
  DevServiceIdentityMiddleware,
} from "../identity";
import { NotificationModule } from "../notification";
import { ShipmentRegistryModule } from "../shipment-registry";
import { WorkExecutionModule } from "../work-execution";
import { APPLY_LIFECYCLE_EVENT } from "./apply-lifecycle-event.port";
import {
  OUTBOX_DELIVERY,
  PublishOutboxBatchService,
} from "./application/publish-outbox-batch.service";
import { ApplyLifecycleEventService } from "./application/apply-lifecycle-event.service";
import { InitializeContainerFlowService } from "./application/initialize-container-flow.service";
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
import { LIFECYCLE_REPOSITORY } from "./domain/lifecycle.repository";
import { CLIENT_OPERATION_REPOSITORY } from "./domain/client-operation.repository";
import { COMPENSATION_REPOSITORY } from "./domain/compensation.repository";
import { INBOX_REPOSITORY } from "./domain/inbox.repository";
import { OUTBOX_REPOSITORY } from "./domain/outbox.repository";
import { PrismaClientOperationRepository } from "./infrastructure/prisma-client-operation.repository";
import { PrismaCompensationRepository } from "./infrastructure/prisma-compensation.repository";
import { PrismaInboxRepository } from "./infrastructure/prisma-inbox.repository";
import { LifecycleInboxConsumption } from "./infrastructure/lifecycle-inbox-consumption";
import { PrismaLifecycleRepository } from "./infrastructure/prisma-lifecycle.repository";
import { PrismaOutboxRepository } from "./infrastructure/prisma-outbox.repository";
import { StubOutboxDelivery } from "./infrastructure/stub-outbox-delivery";
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

@Module({
  imports: [
    IdentityModule,
    NotificationModule,
    DocumentRecordsModule,
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
  ],
  providers: [
    ApplyLifecycleEventService,
    InitializeContainerFlowService,
    SetNodeApplicabilityService,
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
    { provide: OUTBOX_REPOSITORY, useClass: PrismaOutboxRepository },
    { provide: INBOX_REPOSITORY, useClass: PrismaInboxRepository },
    {
      provide: CLIENT_OPERATION_REPOSITORY,
      useClass: PrismaClientOperationRepository,
    },
    {
      provide: COMPENSATION_REPOSITORY,
      useClass: PrismaCompensationRepository,
    },
    { provide: OUTBOX_DELIVERY, useClass: StubOutboxDelivery },
    { provide: INBOX_CONSUMPTION, useClass: LifecycleInboxConsumption },
    {
      provide: APPLY_LIFECYCLE_EVENT,
      useExisting: ApplyLifecycleEventService,
    },
  ],
  exports: [
    ApplyLifecycleEventService,
    InitializeContainerFlowService,
    APPLY_LIFECYCLE_EVENT,
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
      );
    consumer
      .apply(DevServiceIdentityMiddleware)
      .forRoutes(OutboxSystemController, InboxController);
  }
}
