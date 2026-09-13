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
import { ShipmentRegistryModule } from "../shipment-registry";
import { WorkExecutionModule } from "../work-execution";
import { APPLY_LIFECYCLE_EVENT } from "./apply-lifecycle-event.port";
import {
  OUTBOX_DELIVERY,
  PublishOutboxBatchService,
} from "./application/publish-outbox-batch.service";
import { ApplyLifecycleEventService } from "./application/apply-lifecycle-event.service";
import { DrainDueOutboxService } from "./application/drain-due-outbox.service";
import { DrainDueSystemOutboxService } from "./application/drain-due-system-outbox.service";
import { ListDeadLettersService } from "./application/list-dead-letters.service";
import { ClaimInboxBatchService } from "./application/claim-inbox-batch.service";
import { GetClientOperationService } from "./application/get-client-operation.service";
import {
  INBOX_CONSUMPTION,
  ProcessInboxBatchService,
} from "./application/process-inbox-batch.service";
import { ReceiveInboxMessageService } from "./application/receive-inbox-message.service";
import { SubmitClientOperationService } from "./application/submit-client-operation.service";
import { ReplayDeadLetterService } from "./application/replay-dead-letter.service";
import { SetNodeApplicabilityService } from "./application/set-node-applicability.service";
import { LIFECYCLE_REPOSITORY } from "./domain/lifecycle.repository";
import { CLIENT_OPERATION_REPOSITORY } from "./domain/client-operation.repository";
import { INBOX_REPOSITORY } from "./domain/inbox.repository";
import { OUTBOX_REPOSITORY } from "./domain/outbox.repository";
import { PrismaClientOperationRepository } from "./infrastructure/prisma-client-operation.repository";
import { PrismaInboxRepository } from "./infrastructure/prisma-inbox.repository";
import { LifecycleInboxConsumption } from "./infrastructure/lifecycle-inbox-consumption";
import { PrismaLifecycleRepository } from "./infrastructure/prisma-lifecycle.repository";
import { PrismaOutboxRepository } from "./infrastructure/prisma-outbox.repository";
import { StubOutboxDelivery } from "./infrastructure/stub-outbox-delivery";
import { LifecycleController } from "./presentation/lifecycle.controller";
import { NodeApplicabilityController } from "./presentation/node-applicability.controller";
import { OutboxController } from "./presentation/outbox.controller";
import { ClientOperationController } from "./presentation/client-operation.controller";
import { InboxController } from "./presentation/inbox.controller";
import { OutboxSystemController } from "./presentation/outbox-system.controller";

@Module({
  imports: [
    IdentityModule,
    DocumentRecordsModule,
    ShipmentRegistryModule,
    forwardRef(() => WorkExecutionModule),
  ],
  controllers: [
    LifecycleController,
    NodeApplicabilityController,
    OutboxController,
    OutboxSystemController,
    InboxController,
    ClientOperationController,
  ],
  providers: [
    ApplyLifecycleEventService,
    SetNodeApplicabilityService,
    SubmitClientOperationService,
    GetClientOperationService,
    PublishOutboxBatchService,
    DrainDueOutboxService,
    DrainDueSystemOutboxService,
    ReplayDeadLetterService,
    ListDeadLettersService,
    ReceiveInboxMessageService,
    ClaimInboxBatchService,
    ProcessInboxBatchService,
    { provide: LIFECYCLE_REPOSITORY, useClass: PrismaLifecycleRepository },
    { provide: OUTBOX_REPOSITORY, useClass: PrismaOutboxRepository },
    { provide: INBOX_REPOSITORY, useClass: PrismaInboxRepository },
    {
      provide: CLIENT_OPERATION_REPOSITORY,
      useClass: PrismaClientOperationRepository,
    },
    { provide: OUTBOX_DELIVERY, useClass: StubOutboxDelivery },
    { provide: INBOX_CONSUMPTION, useClass: LifecycleInboxConsumption },
    {
      provide: APPLY_LIFECYCLE_EVENT,
      useExisting: ApplyLifecycleEventService,
    },
  ],
  exports: [ApplyLifecycleEventService, APPLY_LIFECYCLE_EVENT],
})
export class LifecycleControlModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(
        LifecycleController,
        NodeApplicabilityController,
        OutboxController,
        ClientOperationController,
      );
    consumer
      .apply(DevServiceIdentityMiddleware)
      .forRoutes(OutboxSystemController, InboxController);
  }
}
