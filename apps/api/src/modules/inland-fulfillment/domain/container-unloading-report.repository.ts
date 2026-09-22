import type {
  ContainerUnloadingReportRecord,
  NormalizedContainerUnloadingReportCommand,
} from "./container-unloading-report";

export const CONTAINER_UNLOADING_REPORT_REPOSITORY = Symbol(
  "CONTAINER_UNLOADING_REPORT_REPOSITORY",
);

export interface ContainerUnloadingReportRepository {
  findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<ContainerUnloadingReportRecord | null>;
  append(
    command: NormalizedContainerUnloadingReportCommand,
  ): Promise<ContainerUnloadingReportRecord>;
}
