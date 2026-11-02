import { pathToFileURL } from "node:url";
import { runReferenceCase } from "./ocean-reference-case";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const option = (name: string) =>
    args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const result = await runReferenceCase({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://logix:logix@localhost:5433/logix?schema=public",
    mode: apply ? "apply" : "audit",
    confirm: option("--confirm"),
    expectedAuditHash: option("--audit-hash"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
