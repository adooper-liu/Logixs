import type { AuthenticatedUserIdentity } from "./authenticated-user-identity";

export const USER_TOKEN_VERIFIER = Symbol("USER_TOKEN_VERIFIER");

export interface UserTokenVerifier {
  verify(accessToken: string): Promise<AuthenticatedUserIdentity>;
}
