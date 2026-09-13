import type { ClientOperationRecord } from "./client-operation";

export const CLIENT_OPERATION_REPOSITORY = Symbol("ClientOperationRepository");

export interface ClientOperationRepository {
  findByIdempotency(input: {
    tenantId: string;
    actorId: string;
    actionCode: string;
    idempotencyKey: string;
  }): Promise<ClientOperationRecord | null>;

  findById(id: string): Promise<ClientOperationRecord | null>;

  insert(record: ClientOperationRecord): Promise<void>;
}
