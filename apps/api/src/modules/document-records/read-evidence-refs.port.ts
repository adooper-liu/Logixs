import type { ReadEvidenceRefsService } from "./application/read-evidence-refs.service";

export const READ_EVIDENCE_REFS = Symbol.for("logix.ReadEvidenceRefs");

export type ReadEvidenceRefsPort = Pick<
  ReadEvidenceRefsService,
  "execute" | "executeDetails"
>;
