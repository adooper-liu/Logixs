import {
  ForbiddenException,
  HttpException,
  type INestApplication,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ConfirmTaskActionCandidateService,
  GenerateTaskActionCandidateService,
  GetTaskActionCandidateService,
  RejectTaskActionCandidateService,
} from "../application/task-action-candidate.services";
import { TaskActionCandidateController } from "./task-action-candidate.controller";
import { TaskActionCandidateExceptionFilter } from "./task-action-candidate-exception.filter";

const getCandidate = { execute: vi.fn() };

@Module({
  controllers: [TaskActionCandidateController],
  providers: [
    TaskActionCandidateExceptionFilter,
    stub(GenerateTaskActionCandidateService),
    { provide: GetTaskActionCandidateService, useValue: getCandidate },
    stub(RejectTaskActionCandidateService),
    stub(ConfirmTaskActionCandidateService),
  ],
})
class TaskActionCandidateHttpTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        (
          request: { identity?: unknown },
          _response: unknown,
          next: () => void,
        ) => {
          request.identity = {
            tenantId: "tenant-http",
            actorId: "actor-http",
            capabilities: ["task.read", "task.execute"],
          };
          next();
        },
      )
      .forRoutes(TaskActionCandidateController);
  }
}

describe("TaskActionCandidateController GC-011 HTTP boundary", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TaskActionCandidateHttpTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it.each([
    {
      name: "validation",
      exception: new HttpException("VALIDATION_FORMAT: secret", 400),
      status: 400,
      code: "VALIDATION_FORMAT",
      category: "validation",
      retryable: false,
    },
    {
      name: "capability",
      exception: new ForbiddenException("AUTHORIZATION_FORBIDDEN"),
      status: 403,
      code: "AUTHORIZATION_FORBIDDEN",
      category: "authorization",
      retryable: false,
    },
    {
      name: "hidden resource",
      exception: new HttpException("CANDIDATE_NOT_FOUND: secret", 404),
      status: 404,
      code: "RESOURCE_NOT_FOUND",
      category: "not_found",
      retryable: false,
    },
    {
      name: "snapshot expired",
      exception: new HttpException("CANDIDATE_SNAPSHOT_EXPIRED: secret", 409),
      status: 409,
      code: "VERSION_CONFLICT",
      category: "conflict",
      retryable: false,
      conflict: { type: "snapshot_expired", resolution: "refresh" },
    },
    {
      name: "no claim action",
      exception: new HttpException(
        "BUSINESS_PRECONDITION_FAILED: NO_CLAIM_ACTION",
        409,
      ),
      status: 409,
      code: "BUSINESS_PRECONDITION_FAILED",
      category: "precondition",
      retryable: false,
      details: [{ reasonCode: "NO_CLAIM_ACTION", message: expect.any(String) }],
    },
    {
      name: "idempotency conflict",
      exception: new HttpException("IDEMPOTENCY_KEY_CONFLICT: secret", 409),
      status: 409,
      code: "IDEMPOTENCY_KEY_CONFLICT",
      category: "conflict",
      retryable: false,
      conflict: { type: "idempotency", resolution: "submit_new_key" },
    },
    {
      name: "invalid dependency response",
      exception: new HttpException("DEPENDENCY_RESPONSE_INVALID: secret", 502),
      status: 502,
      code: "DEPENDENCY_RESPONSE_INVALID",
      category: "dependency",
      retryable: false,
    },
    {
      name: "dependency unavailable",
      exception: new HttpException("DEPENDENCY_UNAVAILABLE: secret", 503),
      status: 503,
      code: "DEPENDENCY_UNAVAILABLE",
      category: "dependency",
      retryable: true,
    },
    {
      name: "dependency timeout",
      exception: new HttpException("DEPENDENCY_TIMEOUT: secret", 504),
      status: 504,
      code: "DEPENDENCY_TIMEOUT",
      category: "dependency",
      retryable: true,
    },
    {
      name: "unexpected failure",
      exception: new Error("password=secret SQL /internal/path prompt"),
      status: 500,
      code: "INTERNAL_ERROR",
      category: "internal",
      retryable: false,
    },
  ])(
    "seals $name through the controller-scoped filter",
    async ({
      exception,
      status,
      code,
      category,
      retryable,
      conflict,
      details = [],
    }) => {
      getCandidate.execute.mockReset();
      getCandidate.execute.mockRejectedValueOnce(exception);

      const response = await fetch(
        `${baseUrl}/node-tasks/task-1/ai/action-candidates/candidate-1`,
        { headers: { "x-trace-id": "client-chosen" } },
      );
      const body = (await response.json()) as Record<string, unknown>;

      expect(getCandidate.execute).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(status);
      expect(body).toMatchObject({
        success: false,
        error: { code, category, retryable, details },
        traceId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        timestamp: expect.any(String),
      });
      expect(body.traceId).not.toBe("client-chosen");
      expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false);
      if (conflict) expect(body).toMatchObject({ error: { conflict } });
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("secret");
      expect(serialized).not.toContain("SQL");
      expect(serialized).not.toContain("/internal/path");
      expect(serialized).not.toContain("prompt");
    },
  );
});

function stub(token: abstract new (...args: never[]) => unknown) {
  return { provide: token, useValue: { execute: vi.fn() } };
}
