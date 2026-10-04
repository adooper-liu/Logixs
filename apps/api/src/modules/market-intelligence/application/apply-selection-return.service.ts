import { Inject, Injectable } from "@nestjs/common";
import {
  MARKET_SIGNAL_REPOSITORY,
  type ApplySelectionReturnInput,
  type TakeBackSelectionReturnInput,
  type MarketSignalRepository,
} from "../domain/market-signal.repository";

@Injectable()
export class ApplySelectionReturnService {
  constructor(
    @Inject(MARKET_SIGNAL_REPOSITORY)
    private readonly repository: MarketSignalRepository,
  ) {}

  /**
   * 必须在调用方事务内执行，保证与立项「退回经营团队」同事务落库。
   * `tx` 为 Prisma TransactionClient（跨模块 Port 用 unknown 避免泄漏类型）。
   */
  executeInTransaction(
    tx: unknown,
    input: ApplySelectionReturnInput,
  ): Promise<{ duplicate: boolean }> {
    return this.repository.applySelectionReturnWithin(tx, input);
  }
  takeBackInTransaction(
    tx: unknown,
    input: TakeBackSelectionReturnInput,
  ): Promise<{ duplicate: boolean }> {
    return this.repository.takeBackSelectionReturnWithin(tx, input);
  }
}
