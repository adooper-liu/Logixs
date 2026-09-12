import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AiGovernanceModule } from "./modules/ai-governance";
import { AuditModule } from "./modules/audit";
import { BookingOriginModule } from "./modules/booking-origin";
import { ChargesSettlementModule } from "./modules/charges-settlement";
import { CustomsComplianceModule } from "./modules/customs-compliance";
import { DocumentRecordsModule } from "./modules/document-records";
import { ExceptionManagementModule } from "./modules/exception-management";
import { IdentityModule } from "./modules/identity";
import { InlandFulfillmentModule } from "./modules/inland-fulfillment";
import { IntegrationImportModule } from "./modules/integration-import";
import { LifecycleControlModule } from "./modules/lifecycle-control";
import { MasterDataModule } from "./modules/master-data";
import { NotificationModule } from "./modules/notification";
import { OceanPortVisibilityModule } from "./modules/ocean-port-visibility";
import { PerformanceImprovementModule } from "./modules/performance-improvement";
import { ShipmentRegistryModule } from "./modules/shipment-registry";
import { WorkExecutionModule } from "./modules/work-execution";
import { WorkflowModule } from "./modules/workflow";

@Module({
  imports: [
    PrismaModule,
    AiGovernanceModule,
    AuditModule,
    BookingOriginModule,
    ChargesSettlementModule,
    CustomsComplianceModule,
    DocumentRecordsModule,
    ExceptionManagementModule,
    IdentityModule,
    InlandFulfillmentModule,
    IntegrationImportModule,
    LifecycleControlModule,
    MasterDataModule,
    NotificationModule,
    OceanPortVisibilityModule,
    PerformanceImprovementModule,
    ShipmentRegistryModule,
    WorkExecutionModule,
    WorkflowModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
