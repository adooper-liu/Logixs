import { Injectable } from "@nestjs/common";
import type {
  TaskCollaborationEvidenceWritePort,
  TaskCollaborationEvidenceWriteTransaction,
} from "../task-collaboration-evidence-write.port";

interface LockedEvidenceRow {
  id: string;
  tenantId: string;
  subjectType: string;
  subjectId: string;
  validity: string;
}

@Injectable()
export class PrismaTaskCollaborationEvidenceWrite implements TaskCollaborationEvidenceWritePort {
  async lockExact(
    transaction: TaskCollaborationEvidenceWriteTransaction,
    input: {
      tenantId: string;
      subjectRef: { kind: "container"; id: string };
      evidenceRecordIds: string[];
    },
  ): Promise<boolean> {
    const ids = [...new Set(input.evidenceRecordIds)].sort();
    if (ids.length === 0) return true;
    const rows = await transaction.$queryRaw<LockedEvidenceRow[]>`
      SELECT
        "id",
        "tenant_id" AS "tenantId",
        "subject_type" AS "subjectType",
        "subject_id" AS "subjectId",
        "validity"
      FROM "evidence_record"
      WHERE "id" = ANY(${ids}::text[])
      ORDER BY "id"
      FOR UPDATE
    `;
    return (
      rows.length === ids.length &&
      rows.every(
        (row) =>
          row.tenantId === input.tenantId &&
          row.subjectType === input.subjectRef.kind &&
          row.subjectId === input.subjectRef.id &&
          row.validity === "effective",
      )
    );
  }
}
