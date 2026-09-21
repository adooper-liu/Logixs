export const GET_CONTAINER_CARGO_COMPLIANCE_SCOPE = Symbol(
  "GetContainerCargoComplianceScope",
);

export interface ContainerCargoComplianceScopeItem {
  replenishmentOrderLineId: string;
  productSkuId: string;
  productNumber: string;
  allocatedQuantity: string;
  quantityUnit: string;
}

export interface ContainerCargoComplianceScope {
  containerRecordId: string;
  allocationSetId: string;
  allocationSetVersion: number;
  items: ContainerCargoComplianceScopeItem[];
}

export interface GetContainerCargoComplianceScopePort {
  execute(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerCargoComplianceScope | null>;
}
