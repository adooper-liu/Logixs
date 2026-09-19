import type { RegisterEvidenceService } from "./application/register-evidence.service";

export const REGISTER_EVIDENCE = Symbol.for("logix.RegisterEvidence");

export type RegisterEvidencePort = Pick<RegisterEvidenceService, "execute">;
