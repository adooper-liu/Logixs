import { Inject, Injectable } from "@nestjs/common";
import {
  REPLACE_REPLENISHMENT_ORDER_LINES,
  type ReplaceReplenishmentOrderLinesCommand,
  type ReplaceReplenishmentOrderLinesPort,
} from "../domain/replace-replenishment-order-lines";

@Injectable()
export class ReplaceReplenishmentOrderLinesService {
  constructor(
    @Inject(REPLACE_REPLENISHMENT_ORDER_LINES)
    private readonly repository: ReplaceReplenishmentOrderLinesPort,
  ) {}

  execute(command: ReplaceReplenishmentOrderLinesCommand): Promise<void> {
    return this.repository.execute(command);
  }

  executeBatch(
    commands: ReplaceReplenishmentOrderLinesCommand[],
  ): Promise<void> {
    return this.repository.executeBatch(commands);
  }
}
