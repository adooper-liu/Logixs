import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LEGACY_MIGRATION = "20260913011044_inbox";
const SCHEMA_PATH = "database/schema.prisma";
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

export function isKnownEmptyDatabaseFailure(output) {
  return (
    output.includes(`Migration name: ${LEGACY_MIGRATION}`) &&
    output.includes("Database error code: 42P01") &&
    /relation [\\"']outbox_replay_request[\\"'] does not exist/.test(output)
  );
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  return result;
}

function exitCode(result) {
  if (typeof result.status === "number") return result.status;
  if (result.error) console.error(result.error.message);
  return 1;
}

export function deployMigrations() {
  const deployArgs = ["migrate", "deploy", "--schema", SCHEMA_PATH];
  const firstAttempt = runPrisma(deployArgs);
  if (firstAttempt.status === 0) return 0;

  const output = `${firstAttempt.stdout ?? ""}\n${firstAttempt.stderr ?? ""}`;
  if (!isKnownEmptyDatabaseFailure(output)) return exitCode(firstAttempt);

  console.warn(
    `Recovering immutable legacy migration ${LEGACY_MIGRATION}; its first statement applied before the known missing-table failure.`,
  );
  const resolved = runPrisma([
    "migrate",
    "resolve",
    "--applied",
    LEGACY_MIGRATION,
    "--schema",
    SCHEMA_PATH,
  ]);
  if (resolved.status !== 0) return exitCode(resolved);

  return exitCode(runPrisma(deployArgs));
}

const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) process.exitCode = deployMigrations();
