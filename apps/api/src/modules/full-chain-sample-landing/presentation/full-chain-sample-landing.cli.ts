import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  readFullChainPackageDirectory,
  type FullChainPackageArtifacts,
} from "@logix/full-chain-sample-contracts";

export type FullChainLandingCliDependencies = {
  fetch: typeof fetch;
  readPackage: typeof readFullChainPackageDirectory;
  output(value: string): void;
  repositoryRoot: string;
  env: NodeJS.ProcessEnv;
};

type CliArguments = {
  packagePath: string;
  approvedRoot: string;
  apiUrl: string;
  idempotencyKey: string;
};

function parse(argv: string[]): CliArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value)
      throw new Error("FULL_CHAIN_CLI_ARGUMENTS_INVALID");
    values.set(key, value);
  }
  const result = {
    packagePath: values.get("--package"),
    approvedRoot: values.get("--approved-root"),
    apiUrl: values.get("--api-url"),
    idempotencyKey: values.get("--idempotency-key"),
  };
  if (Object.values(result).some((value) => !value) || values.size !== 4)
    throw new Error("FULL_CHAIN_CLI_ARGUMENTS_INVALID");
  return result as CliArguments;
}
function assertApiUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error("FULL_CHAIN_CLI_API_URL_INVALID", { cause: error });
  }
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))
    throw new Error("FULL_CHAIN_CLI_API_URL_INVALID");
}

export async function run(
  argv: string[],
  deps: FullChainLandingCliDependencies,
): Promise<void> {
  const input = parse(argv);
  const token = deps.env.FULL_CHAIN_LANDING_TOKEN;
  if (!token) throw new Error("FULL_CHAIN_CLI_TOKEN_REQUIRED");
  assertApiUrl(input.apiUrl);
  const artifacts: FullChainPackageArtifacts = await deps.readPackage({
    packagePath: input.packagePath,
    approvedRoot: input.approvedRoot,
    repositoryRoot: deps.repositoryRoot,
  });
  const traceId = randomUUID();
  const response = await deps.fetch(
    new URL("/full-chain-sample-landings", input.apiUrl),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        artifacts,
        idempotencyKey: input.idempotencyKey,
        traceId,
      }),
    },
  );
  if (!response.ok) throw new Error("FULL_CHAIN_CLI_APPLY_FAILED");
  const body = (await response.json()) as {
    runId: string;
    state: string;
    counts: Record<string, number>;
    gapCount: number;
  };
  deps.output(
    JSON.stringify({
      runId: body.runId,
      state: body.state,
      counts: body.counts,
      gapCount: body.gapCount,
    }),
  );
}

if (require.main === module) {
  run(process.argv.slice(2), {
    fetch,
    readPackage: readFullChainPackageDirectory,
    output: (value) => process.stdout.write(`${value}\n`),
    repositoryRoot: resolve(__dirname, "../../../../../.."),
    env: process.env,
  }).catch((error: unknown) => {
    const code =
      error instanceof Error
        ? error.message.split(":", 1)[0]
        : "FULL_CHAIN_CLI_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
