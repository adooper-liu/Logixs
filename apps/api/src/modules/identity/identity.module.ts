import { Module } from "@nestjs/common";
import { DevIdentityMiddleware } from "./presentation/dev-identity.middleware";
import { DevServiceIdentityMiddleware } from "./presentation/dev-service-identity.middleware";

@Module({
  providers: [DevIdentityMiddleware, DevServiceIdentityMiddleware],
  exports: [DevIdentityMiddleware, DevServiceIdentityMiddleware],
})
export class IdentityModule {}
