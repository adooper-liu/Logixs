import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../../generated/prisma";
import { createPostgresAdapter } from "../../prisma/postgres-adapter";
import { PrismaWorkSessionRepository } from "../../modules/work-session/infrastructure/prisma-work-session.repository";

const DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const prefix = `work-session-${process.pid}-${randomUUID()}`;
const tenantId = `${prefix}-tenant`;
const actorId = `${prefix}-actor`;
const otherActorId = `${prefix}-other`;
const handoffA = randomUUID();
const handoffB = randomUUID();
const handoffC = randomUUID();
let prisma: PrismaClient;
let repository: PrismaWorkSessionRepository;

beforeAll(async () => {
  prisma = new PrismaClient({
    adapter: createPostgresAdapter(DATABASE_URL, "public"),
  });
  await prisma.$connect();
  repository = new PrismaWorkSessionRepository(prisma as never);
});

afterAll(async () => {
  await prisma.workSession.deleteMany({ where: { tenantId } });
  await prisma.$disconnect();
});

describe("recoverable work session persistence", () => {
  it("deduplicates a live context and isolates the owner", async () => {
    const first = await repository.openOrFocus(productSelectionInput(handoffA));
    const replay = await repository.openOrFocus(
      productSelectionInput(handoffA),
    );

    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.record.sessionId).toBe(first.record.sessionId);
    expect(
      await repository.findById(tenantId, otherActorId, first.record.sessionId),
    ).toBeNull();
  });

  it("atomically moves the only current marker", async () => {
    const source = await repository.openOrFocus(
      productSelectionInput(handoffA),
    );
    const target = await repository.openOrFocus(
      productSelectionInput(handoffB),
    );

    const result = await repository.activate({
      tenantId,
      actorId,
      sourceSessionId: source.record.sessionId,
      targetSessionId: target.record.sessionId,
      expectedSourceVersion: source.record.version,
      expectedTargetVersion: target.record.version,
      sourceStatus: "resumable",
      sourceDomainVersionSeen: source.record.domainVersionSeen,
      sourceActiveItemKey: "objective",
      sourceContextMode: "context",
      targetDomainVersionSeen: target.record.domainVersionSeen,
    });

    expect(result.source.status).toBe("resumable");
    expect(result.target.status).toBe("current");
    expect(
      await prisma.workSession.count({
        where: { tenantId, ownerActorId: actorId, status: "current" },
      }),
    ).toBe(1);
  });
  it("concurrent activation has one winner, one stable conflict, and one current", async () => {
    await prisma.workSession.deleteMany({ where: { tenantId } });
    const source = await repository.openOrFocus(
      productSelectionInput(handoffA),
    );
    const left = await repository.openOrFocus(productSelectionInput(handoffB));
    const right = await repository.openOrFocus(productSelectionInput(handoffC));

    const attempts = await Promise.allSettled([
      activate(source.record, left.record),
      activate(source.record, right.record),
    ]);

    expect(
      attempts.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = attempts.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { message: "WORK_SESSION_SOURCE_NOT_CURRENT" },
    });
    expect(
      await prisma.workSession.count({
        where: { tenantId, ownerActorId: actorId, status: "current" },
      }),
    ).toBe(1);
  });

  it("rejects closing the current session", async () => {
    await prisma.workSession.deleteMany({ where: { tenantId } });
    const current = await repository.openOrFocus(
      productSelectionInput(handoffA),
    );
    await expect(
      repository.close({
        tenantId,
        actorId,
        sessionId: current.record.sessionId,
        expectedVersion: current.record.version,
      }),
    ).rejects.toThrow("WORK_SESSION_CURRENT_CLOSE_REQUIRES_SWITCH");
  });

  it("hides a closed session by default and returns it only when explicitly requested", async () => {
    await prisma.workSession.deleteMany({ where: { tenantId } });
    const current = await repository.openOrFocus(
      productSelectionInput(handoffA),
    );
    const closable = await repository.openOrFocus(
      productSelectionInput(handoffB),
    );
    await repository.close({
      tenantId,
      actorId,
      sessionId: closable.record.sessionId,
      expectedVersion: closable.record.version,
    });

    const visible = await repository.list({
      tenantId,
      actorId,
      take: 10,
      includeClosed: false,
    });
    const withClosed = await repository.list({
      tenantId,
      actorId,
      take: 10,
      includeClosed: true,
    });

    expect(visible.map(({ sessionId }) => sessionId)).toEqual([
      current.record.sessionId,
    ]);
    expect(withClosed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: closable.record.sessionId,
          status: "closed",
        }),
      ]),
    );

    const reopened = await repository.openOrFocus(
      productSelectionInput(handoffB),
    );
    expect(reopened.created).toBe(true);
    expect(reopened.record.sessionId).not.toBe(closable.record.sessionId);
    expect(reopened.record.contextKey).toBe(closable.record.contextKey);
    expect(reopened.record.status).toBe("resumable");
  });
});

function activate(
  source: Awaited<ReturnType<typeof repository.openOrFocus>>["record"],
  target: Awaited<ReturnType<typeof repository.openOrFocus>>["record"],
) {
  return repository.activate({
    tenantId,
    actorId,
    sourceSessionId: source.sessionId,
    targetSessionId: target.sessionId,
    expectedSourceVersion: source.version,
    expectedTargetVersion: target.version,
    sourceStatus: "resumable",
    sourceDomainVersionSeen: source.domainVersionSeen,
    sourceActiveItemKey: source.activeItemKey,
    sourceContextMode: source.contextMode,
    targetDomainVersionSeen: target.domainVersionSeen,
  });
}

function productSelectionInput(handoffId: string) {
  return {
    tenantId,
    actorId,
    contextKey: `product_selection|product_initiative_handoff:${handoffId}`,
    workbenchCode: "product_selection" as const,
    routeContext: { kind: "product_selection.v1" as const, handoffId },
    subjectRef: { kind: "product_initiative_handoff" as const, id: handoffId },
    taskRef: null,
    draftRef: null,
    domainVersionSeen: 0,
    activeItemKey: null,
    contextMode: null,
    displaySummary: `选品 · ${handoffId}`,
  };
}
