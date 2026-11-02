import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "../../generated/prisma";
import { importProviderProfile } from "../../apps/api/src/modules/master-data/infrastructure/provider-profile-import";

export async function seedExternalOceanReferenceMappings(prisma: PrismaClient) {
  let profileCount = 0;
  let mappingCount = 0;
  for (const file of [
    "freightower-reference-v2.json",
    "logix-legacy-v1.json",
  ]) {
    const input: unknown = JSON.parse(
      await readFile(
        fileURLToPath(new URL(`./provider-profiles/${file}`, import.meta.url)),
        "utf8",
      ),
    );
    const result = await importProviderProfile(prisma, input, true);
    profileCount += result.profilesToCreate;
    mappingCount += result.mappingsToCreate;
  }
  return { profileCount, mappingCount };
}
