import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/index.js";
import { seedOceanReferenceV11 } from "../../database/seeds/seed-ocean-reference-v1.1.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => arg !== "--apply"))
    throw new Error("Usage: internal-ocean-directory.mts [--apply]");
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://logix:logix@localhost:5433/logix?schema=public";
  const url = new URL(connectionString);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/logix" ||
    (url.searchParams.get("schema") ?? "public") !== "public"
  )
    throw new Error("LOCAL_LOGIX_PUBLIC_ONLY");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    if (args.includes("--apply"))
      console.log(JSON.stringify(await seedOceanReferenceV11(db)));
    const release = await db.referenceDataRelease.findUnique({
      where: { id: "00000000-0000-5000-8000-000000000002" },
    });
    if (!release) {
      console.log(JSON.stringify({ status: "not_installed" }));
      return;
    }
    const groups = await db.oceanCarrierReference.groupBy({
      by: ["status"],
      where: { releaseId: release.id },
      _count: true,
    });
    const types = await db.containerTypeReference.count({
      where: { releaseId: release.id },
    });
    console.log(
      JSON.stringify(
        {
          release: {
            id: release.id,
            version: release.version,
            status: release.status,
            sourceUrl: release.sourceUrl,
            sourceSha256: release.sourceSha256,
          },
          carrierCounts: groups.map((group) => ({
            status: group.status,
            count: group._count,
          })),
          containerTypes: types,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "OCEAN_DIRECTORY_FAILED",
  );
  process.exitCode = 1;
});
