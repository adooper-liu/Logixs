import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import {
  DocumentRecordsModule,
  TASK_COLLABORATION_EVIDENCE,
  TASK_COLLABORATION_EVIDENCE_WRITE,
} from "../document-records";
import * as documentRecordsEntry from "../document-records";
import {
  TASK_COLLABORATION_CONTEXT,
  TASK_COLLABORATION_WRITE_CONTEXT,
  WorkExecutionModule,
} from "../work-execution";
import * as workExecutionEntry from "../work-execution";

describe("task collaboration public ports", () => {
  it("exports the work-execution context token without its resolver", () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      WorkExecutionModule,
    ) as unknown[];

    expect(exports).toContain(TASK_COLLABORATION_CONTEXT);
    expect(workExecutionEntry).toHaveProperty(
      "TASK_COLLABORATION_CONTEXT",
      TASK_COLLABORATION_CONTEXT,
    );
    expect(workExecutionEntry).not.toHaveProperty(
      "WorkExecutionTaskCollaborationContext",
    );
    expect(exports).toContain(TASK_COLLABORATION_WRITE_CONTEXT);
    expect(workExecutionEntry).toHaveProperty(
      "TASK_COLLABORATION_WRITE_CONTEXT",
      TASK_COLLABORATION_WRITE_CONTEXT,
    );
    expect(workExecutionEntry).not.toHaveProperty(
      "PrismaTaskCollaborationWriteContext",
    );
  });

  it("exports the document-records evidence token without its service", () => {
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      DocumentRecordsModule,
    ) as unknown[];

    expect(exports).toContain(TASK_COLLABORATION_EVIDENCE);
    expect(documentRecordsEntry).toHaveProperty(
      "TASK_COLLABORATION_EVIDENCE",
      TASK_COLLABORATION_EVIDENCE,
    );
    expect(documentRecordsEntry).not.toHaveProperty(
      "ResolveTaskCollaborationEvidenceService",
    );
    expect(exports).toContain(TASK_COLLABORATION_EVIDENCE_WRITE);
    expect(documentRecordsEntry).toHaveProperty(
      "TASK_COLLABORATION_EVIDENCE_WRITE",
      TASK_COLLABORATION_EVIDENCE_WRITE,
    );
    expect(documentRecordsEntry).not.toHaveProperty(
      "PrismaTaskCollaborationEvidenceWrite",
    );
  });
});
