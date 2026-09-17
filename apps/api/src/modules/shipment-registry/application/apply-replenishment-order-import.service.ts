import { Inject, Injectable } from "@nestjs/common";
import {
  REPLENISHMENT_ORDER_IMPORT_WRITER,
  type ApplyReplenishmentOrderImportCommand,
  type ApplyReplenishmentOrderImportResult,
  type ReplenishmentOrderImportWriter,
} from "../domain/apply-replenishment-order-import";
import { assertValidShipmentTimeFacts } from "../domain/shipment-time-fact";

@Injectable()
export class ApplyReplenishmentOrderImportService {
  constructor(
    @Inject(REPLENISHMENT_ORDER_IMPORT_WRITER)
    private readonly writer: ReplenishmentOrderImportWriter,
  ) {}

  execute(
    command: ApplyReplenishmentOrderImportCommand,
  ): Promise<ApplyReplenishmentOrderImportResult> {
    assertValidShipmentTimeFacts(
      command.timeFacts,
      new Set(command.lines.map(({ sourceRowId }) => sourceRowId)),
    );
    return this.writer.apply(command);
  }
}
