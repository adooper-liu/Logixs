import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { DocumentRecordsModule } from "../document-records";
import { IdentityModule, DevIdentityMiddleware } from "../identity";
import { CreateMarketSignalService } from "./application/create-market-signal.service";
import { DecideMarketSignalService } from "./application/decide-market-signal.service";
import { GetMarketSignalService } from "./application/get-market-signal.service";
import { ListMarketSignalsService } from "./application/list-market-signals.service";
import { UpdateMarketSignalService } from "./application/update-market-signal.service";
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
    {
      provide: MARKET_SIGNAL_REPOSITORY,
      useClass: PrismaMarketSignalRepository,
    },
  ],
  exports: [MARKET_SIGNAL_REPOSITORY],
})
export class MarketIntelligenceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DevIdentityMiddleware).forRoutes(MarketSignalsController);
  }
}
