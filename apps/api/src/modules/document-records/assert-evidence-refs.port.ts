import type { AssertEvidenceRefsService } from "./application/assert-evidence-refs.service";

export const ASSERT_EVIDENCE_REFS = Symbol.for("logix.AssertEvidenceRefs");

export type AssertEvidenceRefsPort = Pick<AssertEvidenceRefsService, "execute">;
