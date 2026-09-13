import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { AssertEvidenceRefsService } from "./application/assert-evidence-refs.service";
import { DecideEvidenceService } from "./application/decide-evidence.service";
import { RegisterEvidenceService } from "./application/register-evidence.service";
import { ASSERT_EVIDENCE_REFS } from "./assert-evidence-refs.port";
import { EVIDENCE_REPOSITORY } from "./domain/evidence.repository";
import { PrismaEvidenceRepository } from "./infrastructure/prisma-evidence.repository";
import { EvidenceController } from "./presentation/evidence.controller";

@Module({
  imports: [IdentityModule],
  controllers: [EvidenceController],
  providers: [
    RegisterEvidenceService,
    DecideEvidenceService,
    AssertEvidenceRefsService,
    { provide: EVIDENCE_REPOSITORY, useClass: PrismaEvidenceRepository },
    { provide: ASSERT_EVIDENCE_REFS, useExisting: AssertEvidenceRefsService },
  ],
  exports: [AssertEvidenceRefsService, ASSERT_EVIDENCE_REFS],
})
export class DocumentRecordsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(EvidenceController);
  }
}
