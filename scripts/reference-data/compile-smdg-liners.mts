import { readFile, writeFile } from "node:fs/promises";
import { parseSmdgWorkbook } from "../../database/seeds/smdg-liner-directory.js";

const source = new URL(
  "../../database/seeds/reference-data/smdg-liner-codes-20261028.xlsx",
  import.meta.url,
);
const target = new URL(
  "../../database/seeds/reference-data/smdg-liner-codes-20261028.json",
  import.meta.url,
);
const output = await parseSmdgWorkbook(await readFile(source), "2026-10-30");
const text = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== text)
    throw new Error("SMDG_SNAPSHOT_DRIFT");
} else await writeFile(target, text);
console.log(
  JSON.stringify({
    rows: output.rows.length,
    active: output.rows.filter((row) => row.status === "active").length,
    sourceSha256: output.source.sourceSha256,
  }),
);
