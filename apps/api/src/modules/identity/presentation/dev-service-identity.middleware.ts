import { Injectable, type NestMiddleware } from "@nestjs/common";
import { config } from "../../../config/env";
import { attachDevServiceIdentity } from "./dev-service-identity";

@Injectable()
export class DevServiceIdentityMiddleware implements NestMiddleware {
  use(
    request: {
      headers: Record<string, string | string[] | undefined>;
    },
    _response: unknown,
    next: () => void,
  ): void {
    attachDevServiceIdentity(request, {
      serviceId: config.serviceId,
      serviceKey: config.serviceKey,
    });
    next();
  }
}
