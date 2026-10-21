import { HttpException, HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { HttpAdapterHost } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { TaskActionCandidateExceptionFilter } from "./task-action-candidate-exception.filter";

describe("TaskActionCandidateExceptionFilter", () => {
  it.each([
    [HttpStatus.BAD_REQUEST, "VALIDATION_FORMAT", "validation", false],
    [HttpStatus.FORBIDDEN, "AUTHORIZATION_FORBIDDEN", "authorization", false],
    [HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "not_found", false],
    [HttpStatus.CONFLICT, "CANDIDATE_SNAPSHOT_EXPIRED", "conflict", false],
    [HttpStatus.CONFLICT, "BUSINESS_STATE_VIOLATION", "precondition", false],
    [HttpStatus.BAD_GATEWAY, "DEPENDENCY_UNAVAILABLE", "dependency", true],
    [
      HttpStatus.SERVICE_UNAVAILABLE,
      "DEPENDENCY_UNAVAILABLE",
      "dependency",
      true,
    ],
    [HttpStatus.GATEWAY_TIMEOUT, "DEPENDENCY_TIMEOUT", "dependency", true],
  ] as const)(
    "maps HTTP %s to a GC-011 envelope",
    async (status, sourceCode, category, retryable) => {
      const { filter, reply } = await fixture();
      filter.catch(
        new HttpException(`${sourceCode}: internal branch detail`, status),
        host() as never,
      );

      expect(reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code:
              sourceCode === "CANDIDATE_SNAPSHOT_EXPIRED"
                ? "VERSION_CONFLICT"
                : sourceCode,
            category,
            retryable,
            details: [],
          }),
          traceId: expect.stringMatching(/^[0-9a-f-]{36}$/),
          timestamp: expect.any(String),
        }),
        status,
      );
      const body = reply.mock.calls[0]?.[1] as { error: { message: string } };
      expect(body.error.message).not.toContain("internal branch detail");
      if (sourceCode === "CANDIDATE_SNAPSHOT_EXPIRED") {
        expect(reply.mock.calls[0]?.[1]).toMatchObject({
          error: {
            conflict: { type: "snapshot_expired", resolution: "refresh" },
          },
        });
      }
    },
  );

  it("hides unexpected exception details behind INTERNAL_ERROR", async () => {
    const { filter, reply } = await fixture();
    filter.catch(
      new Error("password=secret SQL /internal/path prompt"),
      host() as never,
    );

    expect(reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        error: expect.objectContaining({
          code: "INTERNAL_ERROR",
          category: "internal",
          retryable: false,
        }),
      }),
      500,
    );
    expect(JSON.stringify(reply.mock.calls[0]?.[1])).not.toContain("secret");
    expect(JSON.stringify(reply.mock.calls[0]?.[1])).not.toContain("SQL");
    expect(JSON.stringify(reply.mock.calls[0]?.[1])).not.toContain("prompt");
  });

  it("keeps no-claim as a stable business precondition with a reason detail", async () => {
    const { filter, reply } = await fixture();

    filter.catch(
      new HttpException(
        "BUSINESS_PRECONDITION_FAILED: NO_CLAIM_ACTION",
        HttpStatus.CONFLICT,
      ),
      host() as never,
    );

    expect(reply.mock.calls[0]?.[1]).toMatchObject({
      success: false,
      error: {
        code: "BUSINESS_PRECONDITION_FAILED",
        category: "precondition",
        retryable: false,
        details: [
          {
            reasonCode: "NO_CLAIM_ACTION",
            message: expect.any(String),
          },
        ],
      },
    });
  });

  it("does not mark an invalid dependency response as retryable", async () => {
    const { filter, reply } = await fixture();

    filter.catch(
      new HttpException(
        "DEPENDENCY_RESPONSE_INVALID: invalid provider payload",
        HttpStatus.BAD_GATEWAY,
      ),
      host() as never,
    );

    expect(reply.mock.calls[0]?.[1]).toMatchObject({
      error: {
        code: "DEPENDENCY_RESPONSE_INVALID",
        category: "dependency",
        retryable: false,
        details: [],
      },
    });
  });

  it("keeps an ordinary business guard failure in the precondition category", async () => {
    const { filter, reply } = await fixture();

    filter.catch(
      new HttpException(
        "BUSINESS_PRECONDITION_FAILED: internal branch detail",
        HttpStatus.CONFLICT,
      ),
      host() as never,
    );

    expect(reply.mock.calls[0]?.[1]).toMatchObject({
      error: {
        code: "BUSINESS_PRECONDITION_FAILED",
        category: "precondition",
        retryable: false,
        details: [],
      },
    });
  });
});

async function fixture() {
  const reply = vi.fn();
  const moduleRef = await Test.createTestingModule({
    providers: [
      TaskActionCandidateExceptionFilter,
      {
        provide: HttpAdapterHost,
        useValue: { httpAdapter: { reply } },
      },
    ],
  }).compile();
  return { filter: moduleRef.get(TaskActionCandidateExceptionFilter), reply };
}

function host() {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ response: true }),
      getRequest: () => ({ headers: { "x-trace-id": "client-chosen" } }),
    }),
  };
}
