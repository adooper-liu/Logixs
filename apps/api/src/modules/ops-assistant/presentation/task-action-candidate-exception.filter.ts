import { randomUUID } from "node:crypto";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { ErrorResponse, PublicErrorCode } from "@logix/contracts";

interface ErrorMapping {
  code: PublicErrorCode;
  category: ErrorResponse["error"]["category"];
  retryable: boolean;
  message: string;
  details?: ErrorResponse["error"]["details"];
  conflict?: ErrorResponse["error"]["conflict"];
}

interface SourceError {
  code: string;
  reasonCode: string | null;
}

@Catch()
export class TaskActionCandidateExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(HttpAdapterHost)
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const source = sourceError(exception);
    const mapped = mapError(status, source);
    const body: ErrorResponse = {
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        category: mapped.category,
        retryable: mapped.retryable,
        details: mapped.details ?? [],
        ...(mapped.conflict ? { conflict: mapped.conflict } : {}),
      },
      // Request headers are not a trusted trace source.
      traceId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      body,
      status,
    );
  }
}

function sourceError(exception: unknown): SourceError {
  if (!(exception instanceof HttpException)) {
    return { code: "INTERNAL_ERROR", reasonCode: null };
  }
  const response = exception.getResponse();
  const message =
    typeof response === "string"
      ? response
      : firstMessage(
          (response as { message?: unknown; error?: unknown }).message ??
            (response as { error?: unknown }).error,
        );
  const match = /^([A-Z][A-Z0-9_]*)(?::\s*([A-Z][A-Z0-9_]*))?/u.exec(
    message.trim(),
  );
  return {
    code: match?.[1] ?? "",
    reasonCode: match?.[2] ?? null,
  };
}

function firstMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string") ?? "";
  }
  return "";
}

function mapError(status: number, source: SourceError): ErrorMapping {
  const sourceCode = source.code;
  if (status === HttpStatus.BAD_REQUEST) {
    const code = validationCode(sourceCode);
    return {
      code,
      category: "validation",
      retryable: false,
      message: "请求格式或字段无效。",
    };
  }
  if (status === HttpStatus.FORBIDDEN) {
    const code =
      sourceCode === "AUTHORIZATION_SCOPE_DENIED"
        ? "AUTHORIZATION_SCOPE_DENIED"
        : "AUTHORIZATION_FORBIDDEN";
    return {
      code,
      category: "authorization",
      retryable: false,
      message: "当前身份无权执行此操作。",
    };
  }
  if (status === HttpStatus.NOT_FOUND) {
    return {
      code: "RESOURCE_NOT_FOUND",
      category: "not_found",
      retryable: false,
      message: "未找到对应资源。",
    };
  }
  if (status === HttpStatus.CONFLICT) {
    if (sourceCode === "CANDIDATE_SNAPSHOT_EXPIRED") {
      return {
        code: "VERSION_CONFLICT",
        category: "conflict",
        retryable: false,
        message: "建议所依据的任务快照已失效，请刷新后重试。",
        conflict: { type: "snapshot_expired", resolution: "refresh" },
      };
    }
    if (
      sourceCode === "IDEMPOTENCY_CONFLICT" ||
      sourceCode === "IDEMPOTENCY_KEY_CONFLICT"
    ) {
      return {
        code: "IDEMPOTENCY_KEY_CONFLICT",
        category: "conflict",
        retryable: false,
        message: "幂等键已用于不同请求。",
        conflict: { type: "idempotency", resolution: "submit_new_key" },
      };
    }
    if (sourceCode === "BUSINESS_STATE_VIOLATION") {
      return businessPrecondition("BUSINESS_STATE_VIOLATION");
    }
    if (sourceCode === "BUSINESS_PRECONDITION_FAILED") {
      return businessPrecondition(sourceCode, source.reasonCode);
    }
    return {
      code: "VERSION_CONFLICT",
      category: "conflict",
      retryable: false,
      message: "建议或任务状态已变化，请刷新后重试。",
      conflict: { type: "optimistic_concurrency", resolution: "refresh" },
    };
  }
  if (
    status === HttpStatus.BAD_GATEWAY ||
    status === HttpStatus.SERVICE_UNAVAILABLE
  ) {
    const code =
      sourceCode === "DEPENDENCY_RESPONSE_INVALID"
        ? "DEPENDENCY_RESPONSE_INVALID"
        : "DEPENDENCY_UNAVAILABLE";
    return {
      code,
      category: "dependency",
      retryable: code !== "DEPENDENCY_RESPONSE_INVALID",
      message: "依赖服务暂时不可用，请稍后重试。",
    };
  }
  if (status === HttpStatus.GATEWAY_TIMEOUT) {
    return {
      code: "DEPENDENCY_TIMEOUT",
      category: "dependency",
      retryable: true,
      message: "依赖服务响应超时，请确认结果后重试。",
    };
  }
  if (status === HttpStatus.UNPROCESSABLE_ENTITY) {
    if (sourceCode === "BUSINESS_STATE_VIOLATION") {
      return businessPrecondition("BUSINESS_STATE_VIOLATION");
    }
    if (sourceCode === "BUSINESS_PRECONDITION_FAILED") {
      return businessPrecondition(sourceCode, source.reasonCode);
    }
  }
  return {
    code: "INTERNAL_ERROR",
    category: "internal",
    retryable: false,
    message: "服务处理失败。",
  };
}

function businessPrecondition(
  code: "BUSINESS_STATE_VIOLATION" | "BUSINESS_PRECONDITION_FAILED",
  reasonCode: string | null = null,
): ErrorMapping {
  const noClaim =
    code === "BUSINESS_PRECONDITION_FAILED" && reasonCode === "NO_CLAIM_ACTION";
  return {
    code,
    category: "precondition",
    retryable: false,
    message: noClaim
      ? "当前没有可建议的领取动作。"
      : "当前业务前置条件不允许此操作。",
    ...(noClaim
      ? {
          details: [
            {
              reasonCode: "NO_CLAIM_ACTION",
              message: "当前任务没有可领取的工单动作。",
            },
          ],
        }
      : {}),
  };
}

function validationCode(sourceCode: string): PublicErrorCode {
  if (
    sourceCode === "VALIDATION_REQUIRED" ||
    sourceCode === "VALIDATION_RANGE" ||
    sourceCode === "VALIDATION_FIELD_CONFLICT"
  ) {
    return sourceCode;
  }
  return "VALIDATION_FORMAT";
}
