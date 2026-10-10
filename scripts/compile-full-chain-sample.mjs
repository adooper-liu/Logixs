import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scanWorkbook } from "./full-chain-sample/xlsx-security.mjs";
import { buildProvenanceIndexes } from "./full-chain-sample/classification.mjs";
import { compilePilotRecords } from "./full-chain-sample/compile-records.mjs";
import { loadCompilerPolicy } from "./full-chain-sample/policy.mjs";
import {
  buildPackageArtifacts,
  writePackageAtomically,
} from "./full-chain-sample/package-writer.mjs";
import { validateSourceManifest } from "./full-chain-sample/contracts.mjs";

function args(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1)
    if (argv[index].startsWith("--"))
      result[argv[index].slice(2)] = argv[index + 1];
  return result;
}
export async function run(argv = process.argv.slice(2)) {
  const options = args(argv);
  if (!options.source || !options["source-manifest"] || !options.output)
    throw new Error("ARGUMENTS_INVALID");
  const policyPath =
    options.policy ??
    fileURLToPath(
      new URL("./full-chain-sample/policies/v0.5.json", import.meta.url),
    );
  const [buffer, manifestText] = await Promise.all([
    fs.readFile(options.source),
    fs.readFile(options["source-manifest"], "utf8"),
  ]);
  const sourceManifest = validateSourceManifest(JSON.parse(manifestText));
  const policy = loadCompilerPolicy(policyPath);
  const scan = await scanWorkbook({ buffer, sourceManifest, policy });
  const indexes = buildProvenanceIndexes(scan, policy);
  const compileResult = compilePilotRecords({ scan, policy, indexes });
  const artifacts = buildPackageArtifacts(compileResult, {
    sourceManifest,
    policy,
    sheetCount: scan.sheets.length,
    gitCommit: options["git-commit"] ?? "not-provided",
  });
  await writePackageAtomically({ artifacts, outputDir: options.output });
  process.stdout.write(
    `receipt=FULL_CHAIN_COMPILE publishable=${artifacts.manifest.publishable} records=${artifacts.records.length} gaps=${artifacts.gaps.length} checks=${artifacts.checks.length}\n`,
  );
  return artifacts.manifest.publishable ? 0 : 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(
        `receipt=FULL_CHAIN_COMPILE_FAILED code=${error.message.split(":")[0]}\n`,
      );
      process.exitCode = error.message.startsWith("OUTPUT_")
        ? 4
        : error.message.startsWith("XLSX_") ||
            error.message.startsWith("SOURCE_")
          ? 3
          : 2;
    });
}
