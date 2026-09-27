import { computed, reactive, readonly, shallowRef } from "vue";
import {
  createManualDepartedShipment,
  getShipmentIntakeReferenceData,
  searchShipmentIntakePorts,
  type ManualDepartedShipmentCreateCommandV1,
  type ShipmentHandoffResultV1,
  type ShipmentIntakePortV1,
  type ShipmentIntakeReferenceDataV1,
} from "../api/shipments";

export interface ManualDepartedShipmentDraft {
  shipmentNumber: string;
  carrierCode: string;
  vesselName: string;
  voyageNumber: string;
  bookingNumber: string;
  originPortCode: string;
  destinationPortCode: string;
  cargoOwnerReferenceId: string;
  containers: Array<{ containerNumber: string; containerTypeCode: string }>;
}

type PortRole = "origin" | "destination";

export function useManualDepartedShipment() {
  const referenceData = shallowRef<ShipmentIntakeReferenceDataV1 | null>(null);
  const loadingReferenceData = shallowRef(false);
  const referenceDataError = shallowRef("");
  const portOptions = reactive<Record<PortRole, ShipmentIntakePortV1[]>>({
    origin: [],
    destination: [],
  });
  const searchingPort = reactive<Record<PortRole, boolean>>({
    origin: false,
    destination: false,
  });
  const portSearchError = reactive<Record<PortRole, string>>({
    origin: "",
    destination: "",
  });
  const submitting = shallowRef(false);
  const submitError = shallowRef("");
  const result = shallowRef<ShipmentHandoffResultV1 | null>(null);
  const requestId = shallowRef(crypto.randomUUID());
  const originPortOptions = computed(() => portOptions.origin);
  const destinationPortOptions = computed(() => portOptions.destination);
  const searchingOriginPort = computed(() => searchingPort.origin);
  const searchingDestinationPort = computed(() => searchingPort.destination);
  const originPortSearchError = computed(() => portSearchError.origin);
  const destinationPortSearchError = computed(
    () => portSearchError.destination,
  );

  async function loadReferenceData(): Promise<void> {
    loadingReferenceData.value = true;
    referenceDataError.value = "";
    try {
      referenceData.value = await getShipmentIntakeReferenceData();
    } catch (cause) {
      referenceDataError.value = message(cause, "暂时无法加载业务选项");
    } finally {
      loadingReferenceData.value = false;
    }
  }

  async function searchPort(role: PortRole, query: string): Promise<void> {
    const normalized = query.trim();
    if (!normalized) {
      portOptions[role] = [];
      portSearchError[role] = "";
      return;
    }
    searchingPort[role] = true;
    portSearchError[role] = "";
    try {
      portOptions[role] = (await searchShipmentIntakePorts(normalized)).items;
    } catch (cause) {
      portSearchError[role] = message(cause, "暂时无法查询港口");
    } finally {
      searchingPort[role] = false;
    }
  }

  async function submit(
    draft: ManualDepartedShipmentDraft,
  ): Promise<ShipmentHandoffResultV1 | null> {
    submitting.value = true;
    submitError.value = "";
    result.value = null;
    try {
      const [firstContainer, ...remainingContainers] = draft.containers;
      if (!firstContainer) {
        submitError.value = "请至少填写一只货柜";
        return null;
      }
      const command: ManualDepartedShipmentCreateCommandV1 = {
        contractVersion: "manual-departed-shipment-create.v1",
        requestId: requestId.value,
        shipmentNumber: draft.shipmentNumber.trim(),
        ...(text(draft.carrierCode)
          ? { carrierCode: draft.carrierCode.trim().toUpperCase() }
          : {}),
        ...(text(draft.vesselName)
          ? { vesselName: draft.vesselName.trim() }
          : {}),
        ...(text(draft.voyageNumber)
          ? { voyageNumber: draft.voyageNumber.trim() }
          : {}),
        ...(text(draft.bookingNumber)
          ? { bookingNumber: draft.bookingNumber.trim() }
          : {}),
        ...(draft.originPortCode
          ? { originPortCode: draft.originPortCode }
          : {}),
        ...(draft.destinationPortCode
          ? { destinationPortCode: draft.destinationPortCode }
          : {}),
        ...(draft.cargoOwnerReferenceId
          ? { cargoOwnerReferenceId: draft.cargoOwnerReferenceId }
          : {}),
        containers: [
          toContainer(firstContainer),
          ...remainingContainers.map(toContainer),
        ],
      };
      result.value = await createManualDepartedShipment(command);
      if (!result.value.shipmentId) {
        submitError.value = result.value.issues.some((issue) => issue.blocking)
          ? "存在身份或关系冲突，请按下方原因修正后重试"
          : "本次建档未生成 Shipment，请重试或联系系统管理员";
        return result.value;
      }
      return result.value;
    } catch (cause) {
      submitError.value = message(cause, "暂时无法建立该票 Shipment");
      return null;
    } finally {
      submitting.value = false;
    }
  }

  function resetForNextShipment(): void {
    result.value = null;
    submitError.value = "";
    requestId.value = crypto.randomUUID();
    portOptions.origin = [];
    portOptions.destination = [];
  }

  return {
    referenceData: readonly(referenceData),
    loadingReferenceData: readonly(loadingReferenceData),
    referenceDataError: readonly(referenceDataError),
    originPortOptions: readonly(originPortOptions),
    destinationPortOptions: readonly(destinationPortOptions),
    searchingOriginPort: readonly(searchingOriginPort),
    searchingDestinationPort: readonly(searchingDestinationPort),
    originPortSearchError: readonly(originPortSearchError),
    destinationPortSearchError: readonly(destinationPortSearchError),
    submitting: readonly(submitting),
    submitError: readonly(submitError),
    result: readonly(result),
    loadReferenceData,
    searchPort,
    submit,
    resetForNextShipment,
  };
}

function text(value: string): boolean {
  return Boolean(value.trim());
}

function toContainer(container: {
  containerNumber: string;
  containerTypeCode: string;
}): ManualDepartedShipmentCreateCommandV1["containers"][number] {
  return {
    containerNumber: container.containerNumber.trim().toUpperCase(),
    ...(text(container.containerTypeCode)
      ? { containerTypeCode: container.containerTypeCode.trim().toUpperCase() }
      : {}),
  };
}

function message(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
