import type { CompensationRecord } from "./compensation";

export const COMPENSATION_REPOSITORY = Symbol("CompensationRepository");

export interface CompensationRepository {
  findByIdempotency(input: {
    tenantId: string;
    originalClientOperationId: string;
    idempotencyKey: string;
  }): Promise<CompensationRecord | null>;

  findById(id: string): Promise<CompensationRecord | null>;

  listByOriginal(query: {
    tenantId: string;
    originalClientOperationId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<CompensationRecord[]>;

  insert(record: CompensationRecord): Promise<void>;

  updateState(record: CompensationRecord): Promise<void>;
}
