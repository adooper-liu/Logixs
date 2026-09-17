/**
 * Logix module plugin manifest helpers (Odoo __manifest__ analogue).
 * Not a bounded context — composition/convention support only.
 */

export type ModuleKind = "base" | "incremental";

export interface ModuleManifest {
  /** Must equal the directory name under apps/api/src/modules/. */
  id: string;
  kind: ModuleKind;
  version: string;
  /** Sibling module ids this module may import via public entries. */
  depends: readonly string[];
  /** Capability codes this module declares or requires (IDENTITY_ACCESS_MODEL_V1). */
  permissions: readonly string[];
  /** Human-readable public port / export notes for reviewers. */
  publicPorts?: readonly string[];
  /** Whether apps/web/src/modules/<id>/ contributes routes/nav. */
  webNavContribution?: boolean;
}

export function defineModuleManifest<T extends ModuleManifest>(manifest: T): T {
  return manifest;
}
