import type { WarehouseDeliveryInstruction } from "@logix/contracts";
import {
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
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

export function useWarehouseDeliveryCommands(
  reload: () => Promise<void>,
  currentContainerId: Readonly<Ref<string>>,
) {
  const instructionSubmitting = shallowRef(false);
  const factSubmitting = shallowRef<DeliveryFactKind | null>(null);
  const error = shallowRef("");
  const instructionResult = ref<WarehouseDeliveryInstruction | null>(null);
  const factResults = ref<
    Partial<Record<DeliveryFactKind, RecordLifecycleDateFactResult>>
  >({});
  const keys = new Map<string, { value: string; owner: symbol }>();
  let generation = 0;
  let activeRequest: symbol | null = null;
  function resetContext() {
    generation++;
    activeRequest = null;
    instructionSubmitting.value = false;
    factSubmitting.value = null;
    instructionResult.value = null;
    factResults.value = {};
    error.value = "";
  }
  const stop = watch(currentContainerId, resetContext, { flush: "sync" });
  if (getCurrentScope())
    onScopeDispose(() => {
      stop();
      resetContext();
    });
  function begin(containerId: string, scope: string) {
    if (
      !containerId ||
      currentContainerId.value !== containerId ||
      activeRequest
    )
      return null;
    const owner = Symbol("delivery-command");
    const requestGeneration = generation;
    activeRequest = owner;
    const idempotencyKey = keys.get(scope)?.value ?? crypto.randomUUID();
    keys.set(scope, { value: idempotencyKey, owner });
    error.value = "";
    return {
      idempotencyKey,
      owns: () =>
        activeRequest === owner &&
        generation === requestGeneration &&
        currentContainerId.value === containerId,
      committed: () => {
        if (keys.get(scope)?.owner === owner) keys.delete(scope);
      },
      finish: () => {
        activeRequest = null;
        instructionSubmitting.value = false;
        factSubmitting.value = null;
      },
    };
  }

  async function saveInstruction(
    containerId: string,
    expectedVersion: number,
    draft: DeliveryInstructionDraft,
  ): Promise<void> {
    const scope = `instruction:${containerId}`;
    const request = begin(containerId, scope);
    if (!request) return;
    const input = { ...draft, evidenceInputs: [...draft.evidenceInputs] };
    instructionSubmitting.value = true;
    try {
      const appointment = appointmentWindow(input);
      const evidenceRefs = await resolveEvidence(
        containerId,
        input.evidenceInputs,
        "instruction",
      );
      const result = await replaceWarehouseDeliveryInstruction(containerId, {
        expectedVersion,
        warehouseLocationId: input.warehouseLocationId.trim(),
        warehouseCode: input.warehouseCode.trim() || null,
        warehouseName: input.warehouseName.trim(),
        unlocode: input.unlocode.trim().toUpperCase() || null,
        timezone: input.timezone.trim(),
        appointmentStartAt: appointment.start,
        appointmentEndAt: appointment.end,
        appointmentReference: input.appointmentReference.trim() || null,
        evidenceRefs,
        reasonCode:
          expectedVersion === 0
            ? "delivery_instruction_confirmed"
            : "delivery_instruction_corrected",
        idempotencyKey: request.idempotencyKey,
      });
      request.committed();
      if (request.owns()) {
        instructionResult.value = result;
        await reload();
      }
    } catch (cause) {
      if (request.owns())
        error.value =
          cause instanceof Error ? cause.message : "送仓指令没有保存";
    } finally {
      if (request.owns()) request.finish();
    }
  }

  async function submitFact(
    containerId: string,
    expectedVersion: number,
    instruction: WarehouseDeliveryInstruction,
    draft: DeliveryFactDraft,
  ): Promise<void> {
    if (instruction.containerRecordId !== containerId) return;
    const scope = `${draft.kind}:${containerId}`;
    const request = begin(containerId, scope);
    if (!request) return;
    const input = { ...draft, evidenceInputs: [...draft.evidenceInputs] };
    const destination = { ...instruction };
    factSubmitting.value = input.kind;
    try {
      const { occurredAt, sourceUtcOffset } = parseZonedDateTime(
        input.localDateTime,
        destination.timezone,
      );
      const evidenceRefs = await resolveEvidence(
        containerId,
        input.evidenceInputs,
        input.kind,
      );
      const result = await recordLifecycleDateFact(containerId, {
        nodeCode: "warehouse_delivery",
        eventCode: input.kind,
        timeKind: "actual",
        occurredAt: occurredAt.toISOString(),
        rawValue: input.localDateTime,
        sourceUtcOffset,
        authoritySystem:
          input.kind === "delivered" ? "warehouse-receiving" : "warehouse-wms",
        location: {
          locationType: "warehouse",
          locationId: destination.warehouseLocationId,
          ...(destination.unlocode ? { unlocode: destination.unlocode } : {}),
          timezone: destination.timezone,
        },
        evidenceRefs,
        reasonCode:
          input.kind === "delivered"
            ? "DELIVERY_RECEIPT_RECORDED"
            : "WAREHOUSE_ARRIVAL_RECORDED",
        expectedVersion,
        ...(input.supersedesFactId
          ? { supersedesFactId: input.supersedesFactId }
          : {}),
        idempotencyKey: request.idempotencyKey,
      });
      request.committed();
      if (request.owns()) {
        factResults.value = { ...factResults.value, [input.kind]: result };
        await reload();
      }
    } catch (cause) {
      if (request.owns())
        error.value =
          cause instanceof Error ? cause.message : "实际送仓事实没有提交";
    } finally {
      if (request.owns()) request.finish();
    }
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
