export const USER_ACTOR_TYPE = "user" as const;

export interface AuthenticatedUserIdentity {
  actorType: typeof USER_ACTOR_TYPE;
  actorId: string;
  tenantId: string;
  authenticationMethod: "development_headers" | "oidc";
}
