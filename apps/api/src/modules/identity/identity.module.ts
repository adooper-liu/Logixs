import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { config, type AuthenticationConfig } from "../../config/env";
import { USER_TOKEN_VERIFIER } from "./domain/user-token-verifier";
import { JoseOidcTokenVerifier } from "./infrastructure/jose-oidc-token-verifier";
import {
  AUTHENTICATION_CONFIG,
  AuthenticationGuard,
} from "./presentation/authentication.guard";
import { DevIdentityMiddleware } from "./presentation/dev-identity.middleware";
import { DevServiceIdentityMiddleware } from "./presentation/dev-service-identity.middleware";

@Module({
  providers: [
    DevIdentityMiddleware,
    DevServiceIdentityMiddleware,
    { provide: AUTHENTICATION_CONFIG, useValue: config.authentication },
    {
      provide: USER_TOKEN_VERIFIER,
      inject: [AUTHENTICATION_CONFIG],
      useFactory: (authentication: AuthenticationConfig) =>
        authentication.mode === "oidc"
          ? new JoseOidcTokenVerifier(authentication)
          : {
              verify: async () => {
                throw new Error("OIDC_NOT_CONFIGURED");
              },
            },
    },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  exports: [DevIdentityMiddleware, DevServiceIdentityMiddleware],
})
export class IdentityModule {}
