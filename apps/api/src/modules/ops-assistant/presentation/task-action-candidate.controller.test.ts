import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import { SwaggerModule } from "@nestjs/swagger";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import {
  ConfirmTaskActionCandidateService,
  GenerateTaskActionCandidateService,
  GetTaskActionCandidateService,
  RejectTaskActionCandidateService,
} from "../application/task-action-candidate.services";
import { TaskActionCandidateController } from "./task-action-candidate.controller";

describe("TaskActionCandidateController", () => {
  it("exposes one task-bound route family with the required capabilities", () => {
    const prototype = TaskActionCandidateController.prototype;
    expect(route(prototype.generate)).toEqual({
      method: RequestMethod.POST,
      path: ":taskId/ai/action-candidates",
      capabilities: ["task.read"],
    });
    expect(route(prototype.get)).toEqual({
      method: RequestMethod.GET,
      path: ":taskId/ai/action-candidates/:candidateId",
      capabilities: ["task.read"],
    });
    expect(route(prototype.reject)).toEqual({
      method: RequestMethod.POST,
      path: ":taskId/ai/action-candidates/:candidateId/rejections",
      capabilities: ["task.read"],
    });
    expect(route(prototype.confirm)).toEqual({
      method: RequestMethod.POST,
      path: ":taskId/ai/action-candidates/:candidateId/confirmations",
      capabilities: ["task.read", "task.execute"],
    });
  });

  it("takes tenant, actor and capabilities only from authenticated identity", async () => {
    const services = {
      generate: { execute: vi.fn().mockResolvedValue({ candidateId: "c" }) },
      get: { execute: vi.fn().mockResolvedValue({ candidateId: "c" }) },
      reject: { execute: vi.fn().mockResolvedValue({ decision: "rejected" }) },
      confirm: {
        execute: vi.fn().mockResolvedValue({
          contractVersion: "task-action-candidate-confirm-result.v1",
        }),
      },
    };
    const controller = new TaskActionCandidateController(
      services.generate as never,
      services.get as never,
      services.reject as never,
      services.confirm as never,
    );
    const identity = {
      identity: {
        tenantId: "tenant-from-token",
        actorId: "actor-from-token",
        capabilities: ["task.read", "task.execute"],
      },
      headers: { "x-trace-id": "client-chosen" },
    };
    const taskId = "10000000-0000-4000-8000-000000000001";
    const candidateId = "20000000-0000-4000-8000-000000000001";

    await controller.confirm(
      taskId,
      candidateId,
      {
        contractVersion: "task-action-candidate-confirm.v1",
        candidateId,
        candidateHash: "a".repeat(64),
        idempotencyKey: "confirm-1",
      },
      identity,
    );

    expect(services.confirm.execute).toHaveBeenCalledWith({
      tenantId: "tenant-from-token",
      actorId: "actor-from-token",
      capabilities: ["task.read", "task.execute"],
      taskId,
      candidateId,
      command: expect.objectContaining({ idempotencyKey: "confirm-1" }),
    });
    expect(services.confirm.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ traceId: "client-chosen" }),
    );
  });

  it("publishes every authoritative success field in the generated Nest OpenAPI", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TaskActionCandidateController],
      providers: [
        stub(GenerateTaskActionCandidateService),
        stub(GetTaskActionCandidateService),
        stub(RejectTaskActionCandidateService),
        stub(ConfirmTaskActionCandidateService),
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    const document = SwaggerModule.createDocument(app, {
      openapi: "3.0.0",
      info: { title: "test", version: "1" },
    });
    await app.close();
    const authority = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "../../packages/contracts/schemas/v1/ops-assistant.schema.json",
        ),
        "utf8",
      ),
    ) as { $defs: Record<string, JsonSchema> };
    const commonAuthority = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "../../packages/contracts/schemas/v1/common.schema.json",
        ),
        "utf8",
      ),
    ) as { $defs: Record<string, JsonSchema> };
    const cases = [
      [
        "/node-tasks/{taskId}/ai/action-candidates",
        "post",
        "TaskActionCandidateV1",
      ],
      [
        "/node-tasks/{taskId}/ai/action-candidates/{candidateId}",
        "get",
        "TaskActionCandidateV1",
      ],
      [
        "/node-tasks/{taskId}/ai/action-candidates/{candidateId}/rejections",
        "post",
        "TaskActionDecisionV1",
      ],
      [
        "/node-tasks/{taskId}/ai/action-candidates/{candidateId}/confirmations",
        "post",
        "TaskActionConfirmResultV1",
      ],
    ] as const;

    for (const [path, method, definition] of cases) {
      const response = document.paths[path]?.[method]?.responses?.["200"];
      const schema = responseContentSchema(response);
      expect(schema, `${method.toUpperCase()} ${path}`).toBeDefined();
      expectOpenApiCoversAuthority(
        schema!,
        authority.$defs[definition]!,
        authority.$defs,
        commonAuthority.$defs,
        document.components?.schemas ?? {},
        definition,
      );
    }
  });
});

interface JsonSchema {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  $ref?: string;
}

function stub(token: abstract new (...args: never[]) => unknown) {
  return { provide: token, useValue: { execute: vi.fn() } };
}

function responseContentSchema(
  response: unknown,
): Record<string, unknown> | undefined {
  return (
    response as {
      content?: { "application/json"?: { schema?: Record<string, unknown> } };
    }
  )?.content?.["application/json"]?.schema;
}

function expectOpenApiCoversAuthority(
  rawActual: Record<string, unknown>,
  rawExpected: JsonSchema,
  definitions: Record<string, JsonSchema>,
  commonDefinitions: Record<string, JsonSchema>,
  components: Record<string, unknown>,
  path: string,
): void {
  const expected = resolveAuthority(
    rawExpected,
    definitions,
    commonDefinitions,
  );
  const actual = resolveOpenApi(rawActual, components);
  expect(
    new Set(actual.required as string[] | undefined),
    `${path}.required`,
  ).toEqual(new Set(expected.required ?? []));
  for (const [name, expectedProperty] of Object.entries(
    expected.properties ?? {},
  )) {
    const actualProperty = (
      actual.properties as Record<string, Record<string, unknown>> | undefined
    )?.[name];
    expect(actualProperty, `${path}.${name}`).toBeDefined();
    const resolvedExpected = resolveAuthority(
      expectedProperty,
      definitions,
      commonDefinitions,
    );
    const resolvedActual = resolveOpenApi(actualProperty!, components);
    if (resolvedExpected.enum) {
      expect(
        new Set(resolvedActual.enum as unknown[]),
        `${path}.${name}.enum`,
      ).toEqual(new Set(resolvedExpected.enum));
    }
    if (resolvedExpected.const !== undefined) {
      expect(
        resolvedActual.const ??
          (resolvedActual.enum as unknown[] | undefined)?.[0],
        `${path}.${name}.const`,
      ).toEqual(resolvedExpected.const);
    }
    if (isNullable(resolvedExpected)) {
      expect(
        isOpenApiNullable(resolvedActual),
        `${path}.${name}.nullable`,
      ).toBe(true);
    }
    if (resolvedExpected.properties) {
      expectOpenApiCoversAuthority(
        actualProperty!,
        resolvedExpected,
        definitions,
        commonDefinitions,
        components,
        `${path}.${name}`,
      );
    }
    if (resolvedExpected.type === "array" && resolvedExpected.items) {
      const actualItems = resolveOpenApi(actualProperty!, components).items as
        Record<string, unknown> | undefined;
      expect(actualItems, `${path}.${name}.items`).toBeDefined();
      const expectedItems = resolveAuthority(
        resolvedExpected.items,
        definitions,
        commonDefinitions,
      );
      if (expectedItems.properties) {
        expectOpenApiCoversAuthority(
          actualItems!,
          expectedItems,
          definitions,
          commonDefinitions,
          components,
          `${path}.${name}[]`,
        );
      }
    }
  }
}

function resolveAuthority(
  schema: JsonSchema,
  definitions: Record<string, JsonSchema>,
  commonDefinitions: Record<string, JsonSchema>,
): JsonSchema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.split("/").at(-1)!;
  const source = schema.$ref.startsWith("common.schema.json")
    ? commonDefinitions
    : definitions;
  return resolveAuthority(source[name]!, definitions, commonDefinitions);
}

function resolveOpenApi(
  schema: Record<string, unknown>,
  components: Record<string, unknown>,
): Record<string, unknown> {
  const reference = schema.$ref;
  if (typeof reference !== "string") return schema;
  const name = reference.split("/").at(-1)!;
  return resolveOpenApi(
    components[name] as Record<string, unknown>,
    components,
  );
}

function isNullable(schema: JsonSchema): boolean {
  return (
    (Array.isArray(schema.type) && schema.type.includes("null")) ||
    schema.anyOf?.some((option) => option.type === "null") === true
  );
}

function isOpenApiNullable(schema: Record<string, unknown>): boolean {
  return (
    schema.nullable === true ||
    [schema.anyOf, schema.oneOf]
      .filter(Array.isArray)
      .flat()
      .some(
        (option) =>
          typeof option === "object" &&
          option !== null &&
          (option as { type?: unknown }).type === "null",
      )
  );
}

function route(handler: (...args: never[]) => unknown) {
  return {
    method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
    path: Reflect.getMetadata(PATH_METADATA, handler) as string,
    capabilities: Reflect.getMetadata(
      REQUIRED_CAPABILITIES_KEY,
      handler,
    ) as string[],
  };
}
