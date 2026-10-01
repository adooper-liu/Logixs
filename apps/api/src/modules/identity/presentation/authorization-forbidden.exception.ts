import { ForbiddenException } from "@nestjs/common";

/**
 * 仅由 AuthorizationGuard 抛出；AuthorizationForbiddenFilter 按此类型精确映射
 * GC-011 `AUTHORIZATION_FORBIDDEN`，避免误改其他 403 语义（如对象范围拒绝）。
 */
export class AuthorizationForbiddenException extends ForbiddenException {
  constructor() {
    super("AUTHORIZATION_FORBIDDEN");
  }
}
