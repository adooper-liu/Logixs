import "reflect-metadata";
import { type ArgumentsHost, ForbiddenException } from "@nestjs/common";
import { FILTER_CATCH_EXCEPTIONS } from "@nestjs/common/constants";
import type { HttpAdapterHost } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { AuthorizationForbiddenException } from "./authorization-forbidden.exception";
import { AuthorizationForbiddenFilter } from "./authorization-forbidden.filter";

describe("AuthorizationForbiddenFilter", () => {
  it("binds only the dedicated authorization exception", () => {
    expect(
      Reflect.getMetadata(
        FILTER_CATCH_EXCEPTIONS,
        AuthorizationForbiddenFilter,
      ),
    ).toEqual([AuthorizationForbiddenException]);
    expect(new AuthorizationForbiddenException()).toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("replies with the GC-011 AUTHORIZATION_FORBIDDEN envelope", () => {
    const reply = vi.fn();
    const response = {};
    const filter = new AuthorizationForbiddenFilter({
      httpAdapter: { reply },
    } as unknown as HttpAdapterHost);

    filter.catch(new AuthorizationForbiddenException(), {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost);

    expect(reply).toHaveBeenCalledTimes(1);
    const [target, body, status] = reply.mock.calls[0] as [
      unknown,
      { traceId: string; timestamp: string },
      number,
    ];
    expect(target).toBe(response);
    expect(status).toBe(403);
    expect(body).toStrictEqual({
      success: false,
      error: {
        code: "AUTHORIZATION_FORBIDDEN",
        message: "You do not have permission to perform this action.",
        category: "authorization",
        retryable: false,
        details: [],
      },
      traceId: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(body.traceId.length).toBeGreaterThan(0);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("generates a distinct trace id per rejection", () => {
    const reply = vi.fn();
    const filter = new AuthorizationForbiddenFilter({
      httpAdapter: { reply },
    } as unknown as HttpAdapterHost);
    const host = {
      switchToHttp: () => ({ getResponse: () => ({}) }),
    } as unknown as ArgumentsHost;

    filter.catch(new AuthorizationForbiddenException(), host);
    filter.catch(new AuthorizationForbiddenException(), host);

    const [first, second] = reply.mock.calls.map(
      (call) => (call[1] as { traceId: string }).traceId,
    );
    expect(first).not.toBe(second);
  });
});
