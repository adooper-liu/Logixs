import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export interface FreightowerCarrierReference {
  sourceCode: string;
  chineseName: string;
  scac: string;
  apiCarrierCode: string | null;
  apiSupportNote?: string;
  billCondition?: string;
  booking: boolean;
  bill: boolean;
  container: boolean;
}
export interface FreightowerReferenceFixture {
  sourceUrl: string;
  capturedAt: string;
  license: string;
  scope: { carrierRows: number; portRows: number; containerTypeRows: number; carrierCoverageClaim: number };
  carriers: FreightowerCarrierReference[];
  ports: Array<{ sourceCode: string; name: string; region: string; exportSupported: boolean; importSupported: boolean }>;
  containerTypes: Array<{ code: string; size: number; category: string; englishName: string }>;
}
export interface FreightowerValidationResult {
  carrierCount: number;
  portCount: number;
  containerTypeCount: number;
  scacCollisions: string[];
  apiCarrierCollisions: string[];
}

export async function readFreightowerReferenceFixture(): Promise<FreightowerReferenceFixture> {
  const path = fileURLToPath(new URL("./fixtures/freightower-container-reference-v1.json", import.meta.url));
  return JSON.parse(await readFile(path, "utf8")) as FreightowerReferenceFixture;
}

export function validateFreightowerReferenceFixture(
  fixture: FreightowerReferenceFixture,
): FreightowerValidationResult {
  if (!fixture.sourceUrl || !fixture.capturedAt) throw new Error("source metadata");
  if (fixture.scope.carrierRows !== 49) throw new Error("carrierRows");
  if (fixture.scope.portRows !== 17) throw new Error("portRows");
  if (fixture.scope.containerTypeRows !== 12) throw new Error("containerTypeRows");
  if (fixture.carriers.length !== fixture.scope.carrierRows) throw new Error("carrierRows length");
  if (fixture.ports.length !== fixture.scope.portRows) throw new Error("portRows length");
  if (fixture.containerTypes.length !== fixture.scope.containerTypeRows) throw new Error("containerTypeRows length");
  const sourceCodes = new Set<string>();
  for (const carrier of fixture.carriers) {
    if (sourceCodes.has(carrier.sourceCode)) throw new Error(`sourceCode:${carrier.sourceCode}`);
    sourceCodes.add(carrier.sourceCode);
    if (carrier.apiCarrierCode === "AUTO") throw new Error("AUTO is query mode, not a carrier code");
    if (carrier.apiCarrierCode === "暂不支持") throw new Error("暂不支持 is not a carrier code");
    if (carrier.apiSupportNote === "暂不支持" && carrier.apiCarrierCode !== null)
      throw new Error(`unsupported carrier has code:${carrier.sourceCode}`);
  }
  const scacCollisions = collisions(fixture.carriers.map((carrier) => carrier.scac));
  const apiCarrierCollisions = collisions(
    fixture.carriers.flatMap((carrier) => carrier.apiCarrierCode ? [carrier.apiCarrierCode] : []),
  );
  return {
    carrierCount: fixture.carriers.length,
    portCount: fixture.ports.length,
    containerTypeCount: fixture.containerTypes.length,
    scacCollisions,
    apiCarrierCollisions,
  };
}

function collisions(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort();
}
