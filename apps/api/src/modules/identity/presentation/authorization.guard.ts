import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAllCapabilities } from "../domain/role-capabilities";
import type { AuthenticatedUserIdentity } from "../domain/authenticated-user-identity";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import {
  PUBLIC_ENDPOINT_KEY,
  SERVICE_ENDPOINT_KEY,
} from "../../../security/route-access.decorator";
import { AuthorizationForbiddenException } from "./authorization-forbidden.exception";

interface AuthorizedRequest {
  identity?: AuthenticatedUserIdentity;
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  private readonly logger = new Logger(AuthorizationGuard.name);

  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.hasFlag(context, PUBLIC_ENDPOINT_KEY);
    const isService = this.hasFlag(context, SERVICE_ENDPOINT_KEY);
    if (isPublic || isService) return true;

    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_CAPABILITIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (required.length === 0) {
      // 路由缺少访问分类属于配置缺陷；细节只进服务端日志，对外信封与缺能力一致。
      this.logger.warn(
        `ROUTE_ACCESS_METADATA_MISSING ${context.getClass().name}.${context.getHandler().name}`,
      );
      throw new AuthorizationForbiddenException();
    }

    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const capabilities = request.identity?.capabilities ?? [];
    if (!hasAllCapabilities(capabilities, required)) {
      throw new AuthorizationForbiddenException();
    }
    return true;
  }

  private hasFlag(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
