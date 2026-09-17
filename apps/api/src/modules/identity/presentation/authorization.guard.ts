import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAllCapabilities } from "../domain/role-capabilities";
import type { AuthenticatedUserIdentity } from "../domain/authenticated-user-identity";
import { REQUIRED_CAPABILITIES_KEY } from "../../../security/require-capabilities.decorator";
import {
  PUBLIC_ENDPOINT_KEY,
  SERVICE_ENDPOINT_KEY,
} from "../../../security/route-access.decorator";

interface AuthorizedRequest {
  identity?: AuthenticatedUserIdentity;
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
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
    if (required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const capabilities = request.identity?.capabilities ?? [];
    if (!hasAllCapabilities(capabilities, required)) {
      throw new ForbiddenException("CAPABILITY_DENIED");
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
