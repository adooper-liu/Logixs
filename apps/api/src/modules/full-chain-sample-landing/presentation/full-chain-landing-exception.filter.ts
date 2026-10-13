import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";

const CODE = /^[A-Z][A-Z0-9_]+$/u;

function statusFor(code: string): number {
  if (code === "FULL_CHAIN_REHEARSAL_ACCESS_DENIED")
    return HttpStatus.FORBIDDEN;
  if (code === "FULL_CHAIN_LANDING_NOT_FOUND") return HttpStatus.NOT_FOUND;
  if (code.includes("CONFLICT")) return HttpStatus.CONFLICT;
  if (code.includes("TIMEOUT") || code === "FULL_CHAIN_RECEIPT_WRITE_FAILED")
    return HttpStatus.SERVICE_UNAVAILABLE;
  return HttpStatus.BAD_REQUEST;
}

@Catch()
export class FullChainLandingExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { json(body: unknown): void };
    }>();
    const request = host.switchToHttp().getRequest<{
      body?: { traceId?: unknown };
    }>();
    const message = exception instanceof Error ? exception.message : "";
    const code = CODE.test(message) ? message : "FULL_CHAIN_LANDING_FAILED";
    const requestedTrace = request.body?.traceId;
    const traceId =
      typeof requestedTrace === "string" && requestedTrace.length <= 128
        ? requestedTrace
        : randomUUID();
    response.status(statusFor(code)).json({ code, traceId });
  }
}
