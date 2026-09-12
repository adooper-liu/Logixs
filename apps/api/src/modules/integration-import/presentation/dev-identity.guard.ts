import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

export interface DevIdentity {
  tenantId: string;
  operatorId: string;
}

// 开发期身份（P6 阶段 A）：禁止匿名写。正式 OIDC 属 P5-02。
// 客户端须带 X-Tenant-Id / X-Operator-Id header，服务端校验并写入审计。
@Injectable()
export class DevIdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      devIdentity?: DevIdentity;
    }>();
    const tenantId = request.headers["x-tenant-id"];
    const operatorId = request.headers["x-operator-id"];
    if (typeof tenantId !== "string" || typeof operatorId !== "string") {
      throw new UnauthorizedException("AUTHENTICATION_REQUIRED");
    }
    request.devIdentity = { tenantId, operatorId };
    return true;
  }
}
