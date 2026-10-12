import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { correctWorkbookV051 } from "./full-chain-sample/business-data-correction.mjs";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) continue;
    options[argument.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

export async function run(argv = process.argv.slice(2), fsOps = {}) {
  const access = fsOps.access ?? fs.access;
  const readFile = fsOps.readFile ?? fs.readFile;
  const writeFile = fsOps.writeFile ?? fs.writeFile;
  const link = fsOps.link ?? fs.link;
  const rm = fsOps.rm ?? fs.rm;
  const options = parseArgs(argv);
  if (!options.source || !options.output || !options["correction-manifest"])
    throw new Error("ARGUMENTS_INVALID");
  const source = path.resolve(options.source);
  const output = path.resolve(options.output);
  if (source === output) throw new Error("OUTPUT_SOURCE_CONFLICT");
  try {
    await access(output);
    throw new Error("OUTPUT_EXISTS");
  } catch (error) {
    if (error.message === "OUTPUT_EXISTS") throw error;
    if (error.code !== "ENOENT")
      throw new Error("OUTPUT_ACCESS_FAILED", { cause: error });
  }
  const sourceBuffer = await readFile(source);
  let correctionManifest;
  try {
    correctionManifest = JSON.parse(
      await readFile(path.resolve(options["correction-manifest"]), "utf8"),
    );
  } catch (error) {
    throw new Error("BUSINESS_DATA_CORRECTION_MANIFEST_INVALID", {
      cause: error,
    });
  }
  const corrected = await correctWorkbookV051(sourceBuffer, correctionManifest);
  const staging = path.join(
    path.dirname(output),
    `.${path.basename(output)}.staging-${randomUUID()}`,
  );
  try {
    await writeFile(staging, corrected.buffer, { flag: "wx" });
    await link(staging, output);
  } catch (error) {
    await rm(staging, { force: true }).catch(() => undefined);
    throw new Error(`OUTPUT_PUBLISH_FAILED: ${error.message}`, {
      cause: error,
    });
  }
  await rm(staging, { force: true }).catch(() => undefined);
  process.stdout.write(
    `receipt=FULL_CHAIN_BUSINESS_DATA_CORRECTION version=${corrected.summary.version} hblGroups=${corrected.summary.correctedHblGroups} stuffingGroups=${corrected.summary.aggregatedStuffingGroups} removedRows=${corrected.summary.removedStuffingRows}\n`,
  );
  return 0;
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
        `receipt=FULL_CHAIN_BUSINESS_DATA_CORRECTION_FAILED code=${error.message.split(":")[0]}\n`,
      );
      process.exitCode = 2;
    });
}
