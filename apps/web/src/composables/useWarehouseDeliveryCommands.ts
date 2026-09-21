import type { WarehouseDeliveryInstruction } from "@logix/contracts";
import { readonly, ref, shallowRef } from "vue";
import {
  isEvidenceUuid,
  registerAndVerifyFloorEvidence,
} from "../api/evidence";
import {
  recordLifecycleDateFact,
  type RecordLifecycleDateFactResult,
} from "../api/lifecycleDateFacts";
import { replaceWarehouseDeliveryInstruction } from "../api/warehouseDelivery";
import { parseZonedDateTime } from "../utils/zonedDateTime";

export interface DeliveryInstructionDraft {
  warehouseLocationId: string;
  warehouseCode: string;
  warehouseName: string;
  unlocode: string;
  timezone: string;
  appointmentStartLocal: string;
  appointmentEndLocal: string;
  appointmentReference: string;
  evidenceInputs: string[];
}

export type DeliveryFactKind = "delivered" | "warehouse_arrival";

export interface DeliveryFactDraft {
  kind: DeliveryFactKind;
  localDateTime: string;
  evidenceInputs: string[];
  supersedesFactId?: string;
}

export function useWarehouseDeliveryCommands(reload: () => Promise<void>) {
  const instructionSubmitting = shallowRef(false);
  const factSubmitting = shallowRef<DeliveryFactKind | null>(null);
  const error = shallowRef("");
  const instructionResult = ref<WarehouseDeliveryInstruction | null>(null);
  const factResults = ref<
    Partial<Record<DeliveryFactKind, RecordLifecycleDateFactResult>>
  >({});
  const keys = new Map<string, string>();

  async function saveInstruction(
    containerId: string,
    expectedVersion: number,
    draft: DeliveryInstructionDraft,
  ): Promise<void> {
    if (instructionSubmitting.value) return;
    instructionSubmitting.value = true;
    error.value = "";
    const scope = `instruction:${containerId}`;
    try {
      const evidenceRefs = await resolveEvidence(
        containerId,
        draft.evidenceInputs,
        "instruction",
      );
      const appointment = appointmentWindow(draft);
      instructionResult.value = await replaceWarehouseDeliveryInstruction(
        containerId,
        {
          expectedVersion,
          warehouseLocationId: draft.warehouseLocationId.trim(),
          warehouseCode: draft.warehouseCode.trim() || null,
          warehouseName: draft.warehouseName.trim(),
          unlocode: draft.unlocode.trim().toUpperCase() || null,
          timezone: draft.timezone.trim(),
          appointmentStartAt: appointment.start,
          appointmentEndAt: appointment.end,
          appointmentReference: draft.appointmentReference.trim() || null,
          evidenceRefs,
          reasonCode:
            expectedVersion === 0
              ? "delivery_instruction_confirmed"
              : "delivery_instruction_corrected",
          idempotencyKey: key(scope),
        },
      );
      keys.delete(scope);
      await reload();
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "送仓指令没有保存";
    } finally {
      instructionSubmitting.value = false;
    }
  }

  async function submitFact(
    containerId: string,
    expectedVersion: number,
    instruction: WarehouseDeliveryInstruction,
    draft: DeliveryFactDraft,
  ): Promise<void> {
    if (factSubmitting.value) return;
    factSubmitting.value = draft.kind;
    error.value = "";
    const scope = `${draft.kind}:${containerId}`;
    try {
      const { occurredAt, sourceUtcOffset } = parseZonedDateTime(
        draft.localDateTime,
        instruction.timezone,
      );
      const evidenceRefs = await resolveEvidence(
        containerId,
        draft.evidenceInputs,
        draft.kind,
      );
      const result = await recordLifecycleDateFact(containerId, {
        nodeCode: "warehouse_delivery",
        eventCode: draft.kind,
        timeKind: "actual",
        occurredAt: occurredAt.toISOString(),
        rawValue: draft.localDateTime,
        sourceUtcOffset,
        authoritySystem:
          draft.kind === "delivered" ? "warehouse-receiving" : "warehouse-wms",
        location: {
          locationType: "warehouse",
          locationId: instruction.warehouseLocationId,
          ...(instruction.unlocode ? { unlocode: instruction.unlocode } : {}),
          timezone: instruction.timezone,
        },
        evidenceRefs,
        reasonCode:
          draft.kind === "delivered"
            ? "DELIVERY_RECEIPT_RECORDED"
            : "WAREHOUSE_ARRIVAL_RECORDED",
        expectedVersion,
        ...(draft.supersedesFactId
          ? { supersedesFactId: draft.supersedesFactId }
          : {}),
        idempotencyKey: key(scope),
      });
      factResults.value = { ...factResults.value, [draft.kind]: result };
      keys.delete(scope);
      await reload();
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : "实际送仓事实没有提交";
    } finally {
      factSubmitting.value = null;
    }
  }

  function key(scope: string): string {
    const existing = keys.get(scope);
    if (existing) return existing;
    const created = crypto.randomUUID();
    keys.set(scope, created);
    return created;
  }

  return {
    instructionSubmitting: readonly(instructionSubmitting),
    factSubmitting: readonly(factSubmitting),
    error: readonly(error),
    instructionResult: readonly(instructionResult),
    factResults: readonly(factResults),
    saveInstruction,
    submitFact,
  };
}

function appointmentWindow(draft: DeliveryInstructionDraft): {
  start: string | null;
  end: string | null;
} {
  if (!draft.appointmentStartLocal && !draft.appointmentEndLocal) {
    return { start: null, end: null };
  }
  if (!draft.appointmentStartLocal || !draft.appointmentEndLocal) {
    throw new Error("VALIDATION_FORMAT: 预约窗口必须同时填写开始与结束");
  }
  const start = parseZonedDateTime(
    draft.appointmentStartLocal,
    draft.timezone,
  ).occurredAt;
  const end = parseZonedDateTime(
    draft.appointmentEndLocal,
    draft.timezone,
  ).occurredAt;
  if (end.getTime() <= start.getTime()) {
    throw new Error("VALIDATION_RANGE: 预约结束必须晚于开始");
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

async function resolveEvidence(
  containerId: string,
  values: readonly string[],
  kind: "instruction" | DeliveryFactKind,
): Promise<string[]> {
  const normalized = [...new Set(values.map((value) => value.trim()))].filter(
    Boolean,
  );
  const refs: string[] = [];
  for (const value of normalized) {
    refs.push(
      isEvidenceUuid(value)
        ? value
        : await registerAndVerifyFloorEvidence(containerId, value, {
            evidenceType:
              kind === "delivered"
                ? "receipt"
                : kind === "warehouse_arrival"
                  ? "system_record"
                  : "document",
            authorityLevel: "operational",
            sourceType:
              kind === "warehouse_arrival" ? "system" : "organization",
            authoritySystem:
              kind === "warehouse_arrival"
                ? "warehouse-wms"
                : kind === "delivered"
                  ? "warehouse-receiving"
                  : "inland-operations",
            captureSource: "manual_backfill",
          }),
    );
  }
  if (refs.length === 0) throw new Error("EVIDENCE_REQUIRED: 缺少合格证据");
  return refs;
}
