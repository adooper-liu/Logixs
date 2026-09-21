import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AiGovernanceModule } from "./modules/ai-governance";
import { AuditModule } from "./modules/audit";
import { BookingOriginModule } from "./modules/booking-origin";
import { ChargesSettlementModule } from "./modules/charges-settlement";
import { ComplianceManagementModule } from "./modules/compliance-management";
import { ComplianceLifecycleOrchestrationModule } from "./modules/compliance-lifecycle-orchestration";
import { CustomsComplianceModule } from "./modules/customs-compliance";
import { CustomsLifecycleOrchestrationModule } from "./modules/customs-lifecycle-orchestration";
import { DocumentRecordsModule } from "./modules/document-records";
import { ExceptionManagementModule } from "./modules/exception-management";
import { IdentityModule } from "./modules/identity";
import { InlandFulfillmentModule } from "./modules/inland-fulfillment";
import { InlandLifecycleOrchestrationModule } from "./modules/inland-lifecycle-orchestration";
import { IntegrationImportModule } from "./modules/integration-import";
import { LifecycleControlModule } from "./modules/lifecycle-control";
import { MasterDataModule } from "./modules/master-data";
import { NotificationModule } from "./modules/notification";
import { OceanPortVisibilityModule } from "./modules/ocean-port-visibility";
import { OpsAssistantModule } from "./modules/ops-assistant";
import { PerformanceImprovementModule } from "./modules/performance-improvement";
import { ShipmentRegistryModule } from "./modules/shipment-registry";
import { ShipmentLifecycleOrchestrationModule } from "./modules/shipment-lifecycle-orchestration";
import { WorkExecutionModule } from "./modules/work-execution";
import { WorkflowModule } from "./modules/workflow";

@Module({
  imports: [
    PrismaModule,
    AiGovernanceModule,
    AuditModule,
    BookingOriginModule,
    ChargesSettlementModule,
    ComplianceManagementModule,
    ComplianceLifecycleOrchestrationModule,
    CustomsComplianceModule,
    CustomsLifecycleOrchestrationModule,
    DocumentRecordsModule,
    ExceptionManagementModule,
    IdentityModule,
    InlandFulfillmentModule,
    InlandLifecycleOrchestrationModule,
    IntegrationImportModule,
    LifecycleControlModule,
    MasterDataModule,
    NotificationModule,
    OceanPortVisibilityModule,
    OpsAssistantModule,
    PerformanceImprovementModule,
    ShipmentRegistryModule,
    ShipmentLifecycleOrchestrationModule,
    WorkExecutionModule,
    WorkflowModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
