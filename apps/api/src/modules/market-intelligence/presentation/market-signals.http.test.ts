import "reflect-metadata";
import { BadRequestException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MarketSignalV1 } from "@logix/contracts";
import { CreateMarketSignalService } from "../application/create-market-signal.service";
import { DecideMarketSignalService } from "../application/decide-market-signal.service";
import { GetMarketSignalService } from "../application/get-market-signal.service";
import { ListMarketSignalsService } from "../application/list-market-signals.service";
import { UpdateMarketSignalService } from "../application/update-market-signal.service";
import { MarketSignalsController } from "./market-signals.controller";

const signal: MarketSignalV1 = {
  signalId: "11111111-1111-4111-8111-111111111111",
  title: "[合成演练] 旧客户端读取",
  marketCode: "US",
  channelCode: null,
  categoryRef: null,
  observedFactSummary: null,
  hypothesis: null,
  evidenceRefs: [],
  currentDestination: "watching",
  ownerTeamCode: "market_intelligence",
  activeValidation: {
    responsibleActorId: "actor-a",
    nextReviewDate: "2026-02-12",
    watchFocus: "确认趋势是否持续两周",
    waitingReason: null,
  },
  version: 2,
  pendingFieldCodes: [],
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-02T00:00:00.000Z",
};

// 走真实 Nest 路由与查询解析；身份由测试中间件注入，用例以本模块 test double 隔离。
describe("GET /api/market-signals over HTTP", () => {
  let app: INestApplication | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    // vitest 的 esbuild 转译不产出 design:paramtypes，按构造顺序补齐，供 Nest 按类型注入。
    Reflect.defineMetadata(
      "design:paramtypes",
      [
        CreateMarketSignalService,
        ListMarketSignalsService,
        UpdateMarketSignalService,
        DecideMarketSignalService,
        GetMarketSignalService,
      ],
      MarketSignalsController,
    );
    const listSignals = {
      execute: vi.fn(async (input: { destination?: string }) => {
        if (input.destination === "bogus") {
          throw new BadRequestException("VALIDATION_FORMAT: destination");
        }
        if (input.destination) {
          return {
            contractVersion: "market-signal-page.v1" as const,
            items: [signal],
            pageSize: 50,
            totalCount: 1,
            nextCursor: null,
          };
        }
        const legacy = { ...signal };
        delete legacy.activeValidation;
        return {
          contractVersion: "market-signal-page.v1" as const,
          items: [legacy],
          pageSize: 50,
          nextCursor: null,
        };
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [MarketSignalsController],
      providers: [
        { provide: ListMarketSignalsService, useValue: listSignals },
        { provide: CreateMarketSignalService, useValue: {} },
        { provide: UpdateMarketSignalService, useValue: {} },
        { provide: DecideMarketSignalService, useValue: {} },
        { provide: GetMarketSignalService, useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(
      (
        request: { identity?: unknown },
        _response: unknown,
        next: () => void,
      ) => {
        request.identity = { tenantId: "tenant-a", actorId: "actor-a" };
        next();
      },
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("keeps the pre-upgrade V1 page shape for requests without destination", async () => {
    const response = await fetch(`${baseUrl}/api/market-signals?pageSize=50`);
    const body = (await response.json()) as Record<string, unknown> & {
      items: Record<string, unknown>[];
    };

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ["contractVersion", "items", "nextCursor", "pageSize"].sort(),
    );
    expect(body.items[0]).not.toHaveProperty("activeValidation");
  });

  it("returns the enhanced projection when a destination is requested", async () => {
    const response = await fetch(
      `${baseUrl}/api/market-signals?destination=watching`,
    );
    const body = (await response.json()) as {
      totalCount: number;
      items: { activeValidation: unknown }[];
    };

    expect(response.status).toBe(200);
    expect(body.totalCount).toBe(1);
    expect(body.items[0]?.activeValidation).toEqual(signal.activeValidation);
  });

  it("rejects an unknown destination", async () => {
    const response = await fetch(
      `${baseUrl}/api/market-signals?destination=bogus`,
    );
    expect(response.status).toBe(400);
  });
});
