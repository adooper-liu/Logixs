import { readFile } from "node:fs/promises";
import { PrismaClient } from "../../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { importProviderProfile } from "../../apps/api/src/modules/master-data/infrastructure/provider-profile-import.js";
import { PrismaExternalOceanMappingRepository } from "../../apps/api/src/modules/master-data/infrastructure/prisma-external-ocean-mapping.repository.js";
import type { MappingQuery } from "../../apps/api/src/modules/master-data/reference-external-ocean-mapping.port.js";

async function main() {
  const [command, ...args] = process.argv.slice(2);
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
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    if (command === "import") {
      const file = args[0];
      if (!file || args.slice(1).some((arg) => arg !== "--apply"))
        throw new Error("Usage: import <config.json> [--apply]");
      const input: unknown = JSON.parse(await readFile(file, "utf8"));
      console.log(
        JSON.stringify(
          await importProviderProfile(prisma, input, args.includes("--apply")),
          null,
          2,
        ),
      );
    } else {
      const [provider, profileVersion] = args;
      if (!provider || !profileVersion)
        throw new Error(
          "Usage: inspect <provider> <version> | resolve <provider> <version> <dataset> <namespace> <code>",
        );
      const repo = new PrismaExternalOceanMappingRepository(prisma as never);
      if (command === "inspect" && args.length === 2)
        console.log(
          JSON.stringify(
            await repo.inspectProfile(provider, profileVersion),
            null,
            2,
          ),
        );
      else if (
        command === "resolve" &&
        args.length === 5 &&
        ["carrier", "container_type", "port"].includes(args[2]!)
      ) {
        const query: MappingQuery = {
          provider,
          profileVersion,
          dataset: args[2] as MappingQuery["dataset"],
          namespace: args[3]!,
          sourceCode: args[4]!,
        };
        console.log(JSON.stringify(await repo.resolve(query), null, 2));
      } else throw new Error("INVALID_COMMAND");
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "PROVIDER_PROFILE_COMMAND_FAILED",
  );
  process.exitCode = 1;
});
