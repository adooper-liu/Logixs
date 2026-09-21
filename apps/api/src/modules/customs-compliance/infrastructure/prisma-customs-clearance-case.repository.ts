import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CustomsClearanceCaseConflictError,
  type CustomsClearanceCaseRecord,
  type CustomsDecisionState,
  type CustomsFilingState,
  type NormalizedCustomsClearanceCaseCommand,
} from "../domain/customs-clearance-case";
import type { CustomsClearanceCaseRepository } from "../domain/customs-clearance-case.repository";

@Injectable()
export class PrismaCustomsClearanceCaseRepository implements CustomsClearanceCaseRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CustomsClearanceCaseRecord | null> {
    const row = await this.prisma.customsClearanceCase.findFirst({
      where: { ...input, state: "active" },
      orderBy: [{ version: "desc" }, { id: "desc" }],
      select: clearanceCaseSelect,
    });
    return row ? toRecord(row, false) : null;
  }

  replace(
    command: NormalizedCustomsClearanceCaseCommand,
  ): Promise<CustomsClearanceCaseRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await acquireLocks(transaction, [
        `customs-case:container:${command.tenantId}:${command.containerRecordId}`,
        `customs-case:idempotency:${command.tenantId}:${command.idempotencyKey}`,
      ]);
      const duplicate = await transaction.customsClearanceCase.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: command.tenantId,
            idempotencyKey: command.idempotencyKey,
          },
        },
        select: clearanceCaseSelect,
      });
      if (duplicate) {
        if (duplicate.payloadHash !== command.payloadHash) {
          throw new CustomsClearanceCaseConflictError(
            "CUSTOMS_CLEARANCE_IDEMPOTENCY_CONFLICT",
          );
        }
        return toRecord(duplicate, true);
      }

      const current = await transaction.customsClearanceCase.findFirst({
        where: {
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          state: "active",
        },
        select: { id: true, version: true },
      });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== command.expectedVersion) {
        throw new CustomsClearanceCaseConflictError(
          "CUSTOMS_CLEARANCE_VERSION_CONFLICT",
        );
      }
      const now = new Date();
      if (current) {
        await transaction.customsClearanceCase.update({
          where: { id: current.id },
          data: { state: "superseded", supersededAt: now },
        });
      }
      const created = await transaction.customsClearanceCase.create({
        data: {
          id: randomUUID(),
          tenantId: command.tenantId,
          containerRecordId: command.containerRecordId,
          version: currentVersion + 1,
          state: "active",
          ...(current ? { supersedesCaseId: current.id } : {}),
          jurisdictionCountryCode: command.jurisdictionCountryCode,
          customsBrokerPartyId: command.customsBrokerPartyId,
          declarationNumber: command.declarationNumber,
          filingState: command.filingState,
          decisionState: command.decisionState,
          activeHoldCodes: command.activeHoldCodes,
          ingestionChannel: command.ingestionChannel,
          sourceSystem: command.sourceSystem,
          evidenceRefs: command.evidenceRefs,
          actorId: command.actorId,
          reasonCode: command.reasonCode,
          idempotencyKey: command.idempotencyKey,
          payloadHash: command.payloadHash,
        },
        select: clearanceCaseSelect,
      });
      return toRecord(created, false);
    });
  }
}

async function acquireLocks(
  transaction: {
    $queryRaw(
      input: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<unknown>;
  },
  lockKeys: string[],
): Promise<void> {
  for (const lockKey of [...lockKeys].sort()) {
    await transaction.$queryRaw`
      SELECT 1 AS "lockAcquired"
      FROM (
        SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      ) AS acquired
    `;
  }
}

const clearanceCaseSelect = {
  id: true,
  containerRecordId: true,
  version: true,
  jurisdictionCountryCode: true,
  customsBrokerPartyId: true,
  declarationNumber: true,
  filingState: true,
  decisionState: true,
  activeHoldCodes: true,
  evidenceRefs: true,
  actorId: true,
  reasonCode: true,
  payloadHash: true,
  createdAt: true,
} as const;

function toRecord(
  row: {
    id: string;
    containerRecordId: string;
    version: number;
    jurisdictionCountryCode: string;
    customsBrokerPartyId: string | null;
    declarationNumber: string | null;
    filingState: string;
    decisionState: string;
    activeHoldCodes: string[];
    evidenceRefs: unknown;
    actorId: string;
    reasonCode: string;
    createdAt: Date;
  },
  duplicate: boolean,
): CustomsClearanceCaseRecord {
  if (
    !isFilingState(row.filingState) ||
    !isDecisionState(row.decisionState) ||
    !Array.isArray(row.evidenceRefs) ||
    !row.evidenceRefs.every((item) => typeof item === "string")
  ) {
    throw new Error("CUSTOMS_CLEARANCE_PERSISTENCE_CONTRACT_INVALID");
  }
  return {
    caseId: row.id,
    containerRecordId: row.containerRecordId,
    version: row.version,
    jurisdictionCountryCode: row.jurisdictionCountryCode,
    customsBrokerPartyId: row.customsBrokerPartyId,
    declarationNumber: row.declarationNumber,
    filingState: row.filingState,
    decisionState: row.decisionState,
    activeHoldCodes: row.activeHoldCodes,
    evidenceRefs: row.evidenceRefs,
    actorId: row.actorId,
    reasonCode: row.reasonCode,
    createdAt: row.createdAt.toISOString(),
    duplicate,
  };
}

function isFilingState(value: string): value is CustomsFilingState {
  return ["not_filed", "filed", "accepted"].includes(value);
}

function isDecisionState(value: string): value is CustomsDecisionState {
  return ["pending", "held", "released"].includes(value);
}
