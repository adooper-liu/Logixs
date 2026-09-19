import catalog from "@logix/contracts/import-fields.json";
import canonicalEvents from "@logix/contracts/canonical-events.json";
import type { ShipmentTimeFactImport } from "./apply-replenishment-order-import";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;

export function assertValidShipmentTimeFacts(
  facts: ShipmentTimeFactImport[],
  sourceRowIds: Set<string>,
): void {
  const seenCodes = new Set<string>();
  for (const fact of facts) {
    const definition = catalog.timeFacts.find(
      (candidate) => candidate.code === fact.factCode,
    );
    const event = definition?.eventCode
      ? canonicalEvents.find(
          (candidate) => candidate.eventCode === definition.eventCode,
        )
      : null;
    if (
      !definition ||
      seenCodes.has(fact.factCode) ||
      !sourceRowIds.has(fact.sourceRowId) ||
      fact.timeKind !== definition.timeKind ||
      fact.captureSource !== definition.captureSource ||
      fact.eventCode !== definition.eventCode ||
      fact.nodeCode !== (event?.defaultNodeCode ?? null) ||
      !fact.rawValue.trim() ||
      !fact.sourceSystem.trim() ||
      fact.sourceSystem.length > 64 ||
      !fact.authoritySystem.trim() ||
      fact.authoritySystem.length > 64 ||
      !fact.mappingVersion.trim() ||
      !validOffset(fact.sourceUtcOffset) ||
      Number.isNaN(fact.occurredAtUtc.getTime())
    ) {
      throw new Error("INVALID_SHIPMENT_TIME_FACT");
    }
    seenCodes.add(fact.factCode);

    if (definition.timeKind === "actual") {
      const normalizedStatus = fact.sourceStatus?.trim().toLowerCase() ?? "";
      const completed = definition.completedStatusAliases.some(
        (alias) => alias.trim().toLowerCase() === normalizedStatus,
      );
      if (
        !completed ||
        !fact.evidenceRef ||
        !UUID_PATTERN.test(fact.evidenceRef) ||
        fact.derivationRuleVersion !== null
      ) {
        throw new Error("INVALID_ACTUAL_TIME_PROVENANCE");
      }
    } else if (
      fact.sourceStatus !== null ||
      fact.evidenceRef !== null ||
      !fact.derivationRuleVersion?.trim()
    ) {
      throw new Error("INVALID_DERIVED_TIME_PROVENANCE");
    }
  }
}

function validOffset(value: string): boolean {
  const match = value.match(OFFSET_PATTERN);
  if (!match) return false;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return hours < 14 || (hours === 14 && minutes === 0);
}
