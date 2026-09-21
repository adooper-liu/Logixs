import { Inject, Injectable } from "@nestjs/common";
import {
  CONTAINER_UNLOADING_REPORT_REPOSITORY,
  type ContainerUnloadingReportRepository,
} from "../domain/container-unloading-report.repository";

@Injectable()
export class GetContainerUnloadingReportService {
  constructor(
    @Inject(CONTAINER_UNLOADING_REPORT_REPOSITORY)
    private readonly repository: ContainerUnloadingReportRepository,
  ) {}

  execute(input: { tenantId: string; containerRecordId: string }) {
    return this.repository.findCurrent(input);
  }
}
