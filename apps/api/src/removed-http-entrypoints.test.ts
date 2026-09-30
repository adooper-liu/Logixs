import "reflect-metadata";
import {
  type CallHandler,
  type ExecutionContext,
  type INestApplication,
  type NestInterceptor,
  type Type,
} from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import { of } from "rxjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WorkExecutionModule } from "./modules/work-execution/work-execution.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";

// 路由面取自生产模块的 Controller 注册元数据，不手写路由清单；
// 拦截器只记录命中的处理器并短路返回，不启动数据库或 Temporal。
const registeredControllers = [WorkExecutionModule, WorkflowModule].flatMap(
  (module) =>
    (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? []) as Type[],
);

class HandlerHitRecorder implements NestInterceptor {
  readonly hits: string[] = [];

  intercept(context: ExecutionContext): ReturnType<CallHandler["handle"]> {
    this.hits.push(`${context.getClass().name}.${context.getHandler().name}`);
    return of({});
  }
}

const removedEntrypoints = [
  { method: "POST", path: "/api/node-tasks" },
  { method: "POST", path: "/api/workflows/outbox-publish-due/schedule" },
  { method: "POST", path: "/api/workflows/echo" },
  { method: "GET", path: "/api/workflows/workflow-123" },
] as const;

describe("removed HTTP entrypoints", () => {
  const recorder = new HandlerHitRecorder();
  let app: INestApplication | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: registeredControllers,
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalInterceptors(recorder);
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function request(method: string, path: string): Promise<number> {
    recorder.hits.length = 0;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "POST" ? JSON.stringify({}) : undefined,
    });
    return response.status;
  }

  it("assembles the route surface from production module registrations", () => {
    expect(registeredControllers.map((controller) => controller.name)).toEqual(
      expect.arrayContaining([
        "WorkExecutionController",
        "OutboxPublishSystemScheduleController",
      ]),
    );
  });

  it.each(removedEntrypoints)(
    "$method $path is unreachable and hits no retained handler",
    async ({ method, path }) => {
      const status = await request(method, path);

      expect([404, 405]).toContain(status);
      expect(recorder.hits).toEqual([]);
    },
  );

  it.each([
    {
      method: "GET",
      path: "/api/node-tasks",
      handler: "WorkExecutionController.list",
    },
    {
      method: "POST",
      path: "/api/workflows/outbox-system/schedule",
      handler: "OutboxPublishSystemScheduleController.ensure",
    },
  ])(
    "still routes retained $method $path to $handler",
    async ({ method, path, handler }) => {
      await request(method, path);

      expect(recorder.hits).toEqual([handler]);
    },
  );
});
