export const LANDING_RECEIPT_STORE = Symbol("LANDING_RECEIPT_STORE");

export interface LandingReceiptStore {
  putIfAbsent(input: {
    tenantId: string;
    runId: string;
    body: string;
    digest: string;
  }): Promise<{ keyHash: string; digest: string; replayed: boolean }>;
  readDigest(input: {
    tenantId: string;
    runId: string;
  }): Promise<string | null>;
  deleteOwnedKey(input: {
    tenantId: string;
    runId: string;
    digest: string;
  }): Promise<void>;
}
