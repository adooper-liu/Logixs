import type {
  LifecycleDateAuthorityInput,
  SourceAuthorityPolicyRecord,
} from "./source-authority-decision";

export const SOURCE_AUTHORITY_POLICY_REPOSITORY = Symbol(
  "SourceAuthorityPolicyRepository",
);

export interface SourceAuthorityPolicyRepository {
  listEffectiveCandidates(
    input: LifecycleDateAuthorityInput,
  ): Promise<SourceAuthorityPolicyRecord[]>;
}
