import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { ApplySelectionReturnService } from "./application/apply-selection-return.service";
import { CreateMarketSignalService } from "./application/create-market-signal.service";
import { DecideMarketSignalService } from "./application/decide-market-signal.service";
import { GetMarketSignalService } from "./application/get-market-signal.service";
import { ListMarketSignalsService } from "./application/list-market-signals.service";
import { UpdateMarketSignalService } from "./application/update-market-signal.service";
import { APPLY_SELECTION_RETURN } from "./apply-selection-return.port";
import { MARKET_SIGNAL_REPOSITORY } from "./domain/market-signal.repository";
import { PrismaMarketSignalRepository } from "./infrastructure/prisma-market-signal.repository";
import { MarketSignalsController } from "./presentation/market-signals.controller";

@Module({
  imports: [IdentityModule, DocumentRecordsModule],
  controllers: [MarketSignalsController],
  providers: [
    CreateMarketSignalService,
    ListMarketSignalsService,
    UpdateMarketSignalService,
    DecideMarketSignalService,
    GetMarketSignalService,
    ApplySelectionReturnService,
    {
      provide: MARKET_SIGNAL_REPOSITORY,
      useClass: PrismaMarketSignalRepository,
    },
    {
      provide: APPLY_SELECTION_RETURN,
      useExisting: ApplySelectionReturnService,
    },
  ],
  exports: [MARKET_SIGNAL_REPOSITORY, APPLY_SELECTION_RETURN],
})
export class MarketIntelligenceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(MarketSignalsController);
  }
}
