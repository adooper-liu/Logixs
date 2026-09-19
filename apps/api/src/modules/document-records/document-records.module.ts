import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { AssertEvidenceRefsService } from "./application/assert-evidence-refs.service";
import { DecideEvidenceService } from "./application/decide-evidence.service";
import { RegisterEvidenceService } from "./application/register-evidence.service";
import { ReadEvidenceAuthorityContextService } from "./application/read-evidence-authority-context.service";
import { ASSERT_EVIDENCE_REFS } from "./assert-evidence-refs.port";
import { READ_EVIDENCE_AUTHORITY_CONTEXT } from "./read-evidence-authority-context.port";
import { REGISTER_EVIDENCE } from "./register-evidence.port";
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
    ReadEvidenceAuthorityContextService,
    { provide: EVIDENCE_REPOSITORY, useClass: PrismaEvidenceRepository },
    { provide: ASSERT_EVIDENCE_REFS, useExisting: AssertEvidenceRefsService },
    {
      provide: READ_EVIDENCE_AUTHORITY_CONTEXT,
      useExisting: ReadEvidenceAuthorityContextService,
    },
    { provide: REGISTER_EVIDENCE, useExisting: RegisterEvidenceService },
  ],
  exports: [
    AssertEvidenceRefsService,
    ASSERT_EVIDENCE_REFS,
    READ_EVIDENCE_AUTHORITY_CONTEXT,
    REGISTER_EVIDENCE,
  ],
})
export class DocumentRecordsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(EvidenceController);
  }
}
