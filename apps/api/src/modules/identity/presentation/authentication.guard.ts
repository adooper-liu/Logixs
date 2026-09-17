import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticationConfig } from "../../../config/env";
import type { ServiceIdentity } from "../domain/service-identity";
import type { AuthenticatedUserIdentity } from "../domain/authenticated-user-identity";
import {
  USER_TOKEN_VERIFIER,
  type UserTokenVerifier,
} from "../domain/user-token-verifier";
import {
  PUBLIC_ENDPOINT_KEY,
  SERVICE_ENDPOINT_KEY,
} from "../../../security/route-access.decorator";

export const AUTHENTICATION_CONFIG = Symbol("AUTHENTICATION_CONFIG");

interface AuthenticatedRequest {
  headers?: Record<string, string | string[] | undefined>;
  identity?: AuthenticatedUserIdentity;
  serviceIdentity?: ServiceIdentity;
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AUTHENTICATION_CONFIG)
    private readonly config: AuthenticationConfig,
    @Inject(USER_TOKEN_VERIFIER)
    private readonly tokenVerifier: UserTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublicEndpoint = this.hasMetadata(context, PUBLIC_ENDPOINT_KEY);
    const isServiceEndpoint = this.hasMetadata(context, SERVICE_ENDPOINT_KEY);
    if (isPublicEndpoint && isServiceEndpoint) this.reject();
    if (isPublicEndpoint) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (isServiceEndpoint) {
      if (!request.serviceIdentity) this.reject();
      return true;
    }

    if (this.config.mode === "development") {
      if (!request.identity) this.reject();
      return true;
    }

    const accessToken = bearerToken(request.headers?.authorization);
    if (!accessToken) this.reject();
    try {
      request.identity = await this.tokenVerifier.verify(accessToken);
      return true;
    } catch {
      this.reject();
    }
  }

  private hasMetadata(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private reject(): never {
    throw new UnauthorizedException("AUTHENTICATION_REQUIRED");
  }
}

function bearerToken(
  authorization: string | string[] | undefined,
): string | undefined {
  if (typeof authorization !== "string") return undefined;
  const match = /^Bearer ([^\s]+)$/.exec(authorization.trim());
  return match?.[1];
}
