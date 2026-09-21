import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DevIdentityMiddleware, IdentityModule } from "../identity";
import { DocumentRecordsModule } from "../document-records";
import { MasterDataModule } from "../master-data";
import { ShipmentRegistryModule } from "../shipment-registry";
import { AssessCargoReadyComplianceService } from "./application/assess-cargo-ready-compliance.service";
import { DecideCargoReadyComplianceService } from "./application/decide-cargo-ready-compliance.service";
import { EvaluateCargoReadyComplianceService } from "./application/evaluate-cargo-ready-compliance.service";
import { GetCargoReadyComplianceAssessmentService } from "./application/get-cargo-ready-compliance-assessment.service";
import { PublishComplianceRuleVersionService } from "./application/publish-compliance-rule-version.service";
import { ASSESS_CARGO_READY_COMPLIANCE } from "./assess-cargo-ready-compliance.port";
import { DECIDE_CARGO_READY_COMPLIANCE } from "./decide-cargo-ready-compliance.port";
import { CARGO_READY_COMPLIANCE_REPOSITORY } from "./domain/cargo-ready-compliance.repository";
import { COMPLIANCE_RULE_REPOSITORY } from "./domain/compliance-rule.repository";
import { EVALUATE_CARGO_READY_COMPLIANCE } from "./evaluate-cargo-ready-compliance.port";
import { GET_CARGO_READY_COMPLIANCE_ASSESSMENT } from "./get-cargo-ready-compliance-assessment.port";
import { PrismaCargoReadyComplianceRepository } from "./infrastructure/prisma-cargo-ready-compliance.repository";
import { PrismaComplianceRuleRepository } from "./infrastructure/prisma-compliance-rule.repository";
import { PUBLISH_COMPLIANCE_RULE_VERSION } from "./publish-compliance-rule-version.port";
import { CargoReadyComplianceController } from "./presentation/cargo-ready-compliance.controller";
import { ComplianceRuleController } from "./presentation/compliance-rule.controller";

@Module({
  imports: [
    DocumentRecordsModule,
    IdentityModule,
    MasterDataModule,
    ShipmentRegistryModule,
  ],
  controllers: [CargoReadyComplianceController, ComplianceRuleController],
  providers: [
    AssessCargoReadyComplianceService,
    DecideCargoReadyComplianceService,
    EvaluateCargoReadyComplianceService,
    GetCargoReadyComplianceAssessmentService,
    PublishComplianceRuleVersionService,
    {
      provide: CARGO_READY_COMPLIANCE_REPOSITORY,
      useClass: PrismaCargoReadyComplianceRepository,
    },
    {
      provide: COMPLIANCE_RULE_REPOSITORY,
      useClass: PrismaComplianceRuleRepository,
    },
    {
      provide: ASSESS_CARGO_READY_COMPLIANCE,
      useExisting: AssessCargoReadyComplianceService,
    },
    {
      provide: DECIDE_CARGO_READY_COMPLIANCE,
      useExisting: DecideCargoReadyComplianceService,
    },
    {
      provide: EVALUATE_CARGO_READY_COMPLIANCE,
      useExisting: EvaluateCargoReadyComplianceService,
    },
    {
      provide: GET_CARGO_READY_COMPLIANCE_ASSESSMENT,
      useExisting: GetCargoReadyComplianceAssessmentService,
    },
    {
      provide: PUBLISH_COMPLIANCE_RULE_VERSION,
      useExisting: PublishComplianceRuleVersionService,
    },
  ],
  exports: [
    ASSESS_CARGO_READY_COMPLIANCE,
    DECIDE_CARGO_READY_COMPLIANCE,
    EVALUATE_CARGO_READY_COMPLIANCE,
    GET_CARGO_READY_COMPLIANCE_ASSESSMENT,
    PUBLISH_COMPLIANCE_RULE_VERSION,
  ],
})
export class ComplianceManagementModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(DevIdentityMiddleware)
      .forRoutes(CargoReadyComplianceController, ComplianceRuleController);
  }
}
