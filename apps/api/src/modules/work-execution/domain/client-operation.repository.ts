import type { ClientOperationRecord } from "./client-operation";

export const WORK_CLIENT_OPERATION_REPOSITORY = Symbol(
  "WorkClientOperationRepository",
);

export interface WorkClientOperationRepository {
  findByIdempotency(input: {
    tenantId: string;
    actorId: string;
    actionCode: string;
    idempotencyKey: string;
  }): Promise<ClientOperationRecord | null>;

  insert(record: ClientOperationRecord): Promise<void>;
}
