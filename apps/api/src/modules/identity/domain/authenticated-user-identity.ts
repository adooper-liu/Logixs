export const USER_ACTOR_TYPE = "user" as const;

export interface AuthenticatedUserIdentity {
  actorType: typeof USER_ACTOR_TYPE;
  actorId: string;
  tenantId: string;
  authenticationMethod: "development_headers" | "oidc";
  /** Application role codes after IdP mapping (capability packs). */
  roles: string[];
  /** Effective capability codes used for server-side authorization. */
  capabilities: string[];
}
