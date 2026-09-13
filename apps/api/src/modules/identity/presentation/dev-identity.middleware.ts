import { Injectable, type NestMiddleware } from "@nestjs/common";
import { attachDevIdentity } from "./dev-identity";

@Injectable()
export class DevIdentityMiddleware implements NestMiddleware {
  use(
    request: {
      headers: Record<string, string | string[] | undefined>;
    },
    _response: unknown,
    next: () => void,
  ): void {
    attachDevIdentity(request);
    next();
  }
}
