import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  canonicalStringify,
  sha256Hex,
  validateFullChainPackageForLanding,
  validateRehearsalReceipt,
  type FullChainPackageArtifacts,
  type FullChainRecordType,
} from "@logix/full-chain-sample-contracts";
import type { AuthenticatedUserIdentity } from "../../identity";
import type { LandingIsolationProbe } from "../domain/landing-isolation-probe.port";
import type { LandingReceiptStore } from "../domain/landing-receipt-store.port";
import type { FullChainLandingRepository } from "../domain/full-chain-landing.repository";
import {
  buildFullChainLandingGraph,
  type FullChainLandingGraph,
} from "../domain/landing-graph";
import { FullChainLandingPolicy } from "./full-chain-landing-policy";

export type ApplyFullChainPackageCommand = {
  identity: AuthenticatedUserIdentity;
  artifacts: FullChainPackageArtifacts;
  idempotencyKey: string;
  traceId: string;
};
export type ApplyFullChainPackageResult = {
  runId: string;
  state: "published" | "replayed";
  counts: Record<FullChainRecordType, number>;
  gapCount: number;
};

function graphCounts(
  graph: FullChainLandingGraph,
): Record<FullChainRecordType, number> {
  return {
    shipment_plan: graph.plans.length,
    booking_commitment: graph.bookings.length,
    cargo_ready_release: graph.cargoReadyReleases.length,
    stuffing_snapshot_line: graph.stuffingLines.length,
    export_customs_case: graph.exportCustomsCases.length,
    dispatch_fact: graph.dispatchFacts.length,
  };
}
function errorCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z][A-Z0-9_]+$/u.test(error.message))
    return error.message;
  return "FULL_CHAIN_RECEIPT_WRITE_FAILED";
}

@Injectable()
export class ApplyFullChainPackageService {
  constructor(
    private readonly policy: FullChainLandingPolicy,
    private readonly repository: FullChainLandingRepository,
    private readonly receiptStore: LandingReceiptStore,
    private readonly isolationProbe: LandingIsolationProbe,
  ) {}

  async execute(
    command: ApplyFullChainPackageCommand,
  ): Promise<ApplyFullChainPackageResult> {
    this.policy.assertCanApply(command.identity);
    const validated = validateFullChainPackageForLanding(command.artifacts);
    const graph = buildFullChainLandingGraph(validated);
    const counts = graphCounts(graph);
    const existing = await this.repository.findByPackage({
      tenantId: command.identity.tenantId,
      packageHash: graph.packageHash,
    });
    if (existing?.state === "published")
      return {
        runId: existing.runId,
        state: "replayed",
        counts,
        gapCount: graph.gaps.length,
      };
    const candidateRunId = existing?.runId ?? randomUUID();
    const scope = this.policy.scope(candidateRunId);
    const before = await this.isolationProbe.capture(scope);
    const staged = await this.repository.stage({
      runId: candidateRunId,
      tenantId: command.identity.tenantId,
      actorId: command.identity.actorId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
      manifest: validated.manifest,
      graph,
    });
    if (staged.state === "published")
      return {
        runId: staged.runId,
        state: "replayed",
        counts,
        gapCount: graph.gaps.length,
      };
    let stored: { keyHash: string; digest: string; replayed: boolean };
    if (staged.state === "reconciling") {
      const digest = await this.receiptStore.readDigest({
        tenantId: command.identity.tenantId,
        runId: staged.runId,
      });
      if (!digest) throw new Error("FULL_CHAIN_RECEIPT_MISSING");
      stored = { keyHash: "", digest, replayed: true };
    } else {
      const receipt = validateRehearsalReceipt({
        receiptVersion: "full-chain-rehearsal-receipt.v1",
        runId: staged.runId,
        packageId: sha256Hex(graph.packageHash).slice(0, 16),
        tenantRef: sha256Hex(command.identity.tenantId).slice(0, 16),
        state: "staged",
        counts,
        gapCounts: Object.fromEntries(
          ["open", "blocking", "informational"].map((status) => [
            status,
            graph.gaps.filter((gap) => gap.status === status).length,
          ]),
        ),
        reconciliationDigest: sha256Hex(
          canonicalStringify({ counts, gapCount: graph.gaps.length }),
        ),
        createdAt: staged.createdAt.toISOString(),
      });
      const receiptBody = `${canonicalStringify(receipt)}\n`;
      try {
        stored = await this.receiptStore.putIfAbsent({
          tenantId: command.identity.tenantId,
          runId: staged.runId,
          body: receiptBody,
          digest: sha256Hex(receiptBody),
        });
        await this.repository.markReconciling({
          tenantId: command.identity.tenantId,
          runId: staged.runId,
          receiptKeyHash: stored.keyHash,
          receiptDigest: stored.digest,
        });
      } catch (error) {
        await this.repository.markReceiptPending({
          tenantId: command.identity.tenantId,
          runId: staged.runId,
          errorCode: errorCode(error),
        });
        throw error;
      }
    }
    const after = await this.isolationProbe.capture(
      this.policy.scope(staged.runId),
    );
    this.isolationProbe.compare(before, after);
    const reconciliation = await this.repository.reconcile({
      tenantId: command.identity.tenantId,
      runId: staged.runId,
    });
    this.assertReconciled(graph, reconciliation, stored.digest);
    await this.repository.publish({
      tenantId: command.identity.tenantId,
      runId: staged.runId,
      reconciliation,
      traceId: command.traceId,
    });
    return {
      runId: staged.runId,
      state: "published",
      counts,
      gapCount: graph.gaps.length,
    };
  }

  private assertReconciled(
    graph: FullChainLandingGraph,
    reconciliation: Awaited<
      ReturnType<FullChainLandingRepository["reconcile"]>
    >,
    receiptDigest: string,
  ): void {
    const counts = graphCounts(graph);
    if (
      Object.entries(counts).some(
        ([recordType, count]) =>
          reconciliation.factCounts[recordType] !== count,
      ) ||
      reconciliation.receiptCount !== graph.recordReceipts.length ||
      reconciliation.gapCount !== graph.gaps.length ||
      reconciliation.outboxCount !== 0 ||
      reconciliation.businessTaskCount !== 0 ||
      !/^[a-f0-9]{64}$/u.test(receiptDigest)
    )
      throw new Error("FULL_CHAIN_RECONCILIATION_FAILED");
  }
}
