import type { ClientOperationRecord } from "./client-operation";

export const CLIENT_OPERATION_REPOSITORY = Symbol("ClientOperationRepository");

export interface ClientOperationListItem extends ClientOperationRecord {
  createdAt: Date;
}

export interface ClientOperationRepository {
  findByIdempotency(input: {
    tenantId: string;
    actorId: string;
    actionCode: string;
    idempotencyKey: string;
  }): Promise<ClientOperationRecord | null>;

  findById(id: string): Promise<ClientOperationRecord | null>;

  listByTenant(query: {
    tenantId: string;
    after?: { createdAt: Date; id: string };
    take: number;
  }): Promise<ClientOperationListItem[]>;

  insert(record: ClientOperationRecord): Promise<void>;
}
