import { randomUUID } from "node:crypto";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { AuthorizationForbiddenException } from "./authorization-forbidden.exception";

export interface AuthorizationForbiddenResponse {
  success: false;
  error: {
    code: "AUTHORIZATION_FORBIDDEN";
    message: string;
    category: "authorization";
    retryable: false;
    details: [];
  };
  traceId: string;
  timestamp: string;
}

// 客户端请求头不是可信追踪来源，traceId 一律由服务端生成。
@Catch(AuthorizationForbiddenException)
export class AuthorizationForbiddenFilter implements ExceptionFilter<AuthorizationForbiddenException> {
  constructor(
    @Inject(HttpAdapterHost)
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  catch(
    _exception: AuthorizationForbiddenException,
    host: ArgumentsHost,
  ): void {
    const body: AuthorizationForbiddenResponse = {
      success: false,
      error: {
        code: "AUTHORIZATION_FORBIDDEN",
        message: "You do not have permission to perform this action.",
        category: "authorization",
        retryable: false,
        details: [],
      },
      traceId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      body,
      HttpStatus.FORBIDDEN,
    );
  }
}
