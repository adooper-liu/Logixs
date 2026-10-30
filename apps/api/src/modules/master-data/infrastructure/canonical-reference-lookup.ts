import type { PrismaClient } from "../../../../../../generated/prisma";
import type { ReferenceDataset } from "../domain/provider-profile";

// Shared by the plain seed importer and Nest query adapter; no framework runtime imports.
export async function canonicalExists(
  db: Pick<
    PrismaClient,
    | "referenceDataRelease"
    | "oceanCarrierReference"
    | "containerTypeReference"
    | "portCodeReference"
  >,
  dataset: ReferenceDataset,
  releaseId: string,
  code: string,
): Promise<boolean> {
  const release = await db.referenceDataRelease.findUnique({
    where: { id: releaseId },
  });
  if (!release || !["active", "superseded"].includes(release.status))
    return false;
  if (dataset === "port") {
    if (release.authority !== "UNECE" || release.datasetCode !== "UNLOCODE")
      return false;
    return Boolean(
      await db.portCodeReference.findUnique({
        where: { releaseId_unlocode: { releaseId, unlocode: code } },
      }),
    );
  }
  if (
    release.authority !== "Logix" ||
    release.datasetCode !== "ocean_internal_baseline"
  )
    return false;
  const where = { releaseId_canonicalCode: { releaseId, canonicalCode: code } };
  const row =
    dataset === "carrier"
      ? await db.oceanCarrierReference.findUnique({ where })
      : await db.containerTypeReference.findUnique({ where });
  return row?.status === "active";
}
