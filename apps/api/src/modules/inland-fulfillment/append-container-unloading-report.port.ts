import type {
  AppendContainerUnloadingReportCommand,
  ContainerUnloadingReportRecord,
} from "./domain/container-unloading-report";

export const APPEND_CONTAINER_UNLOADING_REPORT = Symbol.for(
  "logix.AppendContainerUnloadingReport",
);

export interface AppendContainerUnloadingReportPort {
  execute(
    command: AppendContainerUnloadingReportCommand,
  ): Promise<ContainerUnloadingReportRecord>;
}
