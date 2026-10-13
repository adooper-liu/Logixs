import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  canonicalStringify,
  sha256Hex,
} from "@logix/full-chain-sample-contracts";
import { Prisma } from "../../../../../../generated/prisma";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  FullChainLandingRepository,
  FullChainLandingStatus,
  LandingReconciliation,
  PublishedFullChain,
  StageFullChainLandingInput,
} from "../domain/full-chain-landing.repository";
import { fullChainLandingProjectionHash } from "../domain/landing-graph";

type LandingTransaction = Prisma.TransactionClient;
type FailurePoint = "export_customs_case";

function manifestField(manifest: Record<string, unknown>, key: string): string {
  const value = manifest[key];
  if (typeof value !== "string") throw new Error("FULL_CHAIN_MANIFEST_INVALID");
  return value;
}
function sourceField(manifest: Record<string, unknown>, key: string): string {
  const source = manifest.source;
  if (!source || typeof source !== "object")
    throw new Error("FULL_CHAIN_MANIFEST_INVALID");
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== "string") throw new Error("FULL_CHAIN_MANIFEST_INVALID");
  return value;
}
function countsFor(input: StageFullChainLandingInput): Record<string, number> {
  return {
    shipment_plan: input.graph.plans.length,
    booking_commitment: input.graph.bookings.length,
    cargo_ready_release: input.graph.cargoReadyReleases.length,
    stuffing_snapshot_line: input.graph.stuffingLines.length,
    export_customs_case: input.graph.exportCustomsCases.length,
    dispatch_fact: input.graph.dispatchFacts.length,
  };
}
function mapStatus(row: {
  id: string;
  state: string;
  inputCounts: unknown;
  appliedCounts: unknown;
  replayedCounts: unknown;
  rejectedCounts: unknown;
  gapCount: number;
  checkCount: number;
  receiptKeyHash: string | null;
  receiptDigest: string | null;
  publishedAt: Date | null;
}): FullChainLandingStatus {
  return {
    runId: row.id,
    state: row.state as FullChainLandingStatus["state"],
    inputCounts: row.inputCounts as Record<string, number>,
    appliedCounts: row.appliedCounts as Record<string, number>,
    replayedCounts: row.replayedCounts as Record<string, number>,
    rejectedCounts: row.rejectedCounts as Record<string, number>,
    gapCount: row.gapCount,
    checkCount: row.checkCount,
    receiptKeyHash: row.receiptKeyHash,
    receiptDigest: row.receiptDigest,
    publishedAt: row.publishedAt,
  };
}

@Injectable()
export class PrismaFullChainLandingRepository implements FullChainLandingRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    private readonly testHooks: { failAfterRecordType?: FailurePoint } = {},
  ) {}

  async findByPackage(input: {
    tenantId: string;
    packageHash: string;
  }): Promise<FullChainLandingStatus | null> {
    const row = await this.prisma.fullChainLandingRun.findUnique({
      where: {
        tenantId_packageHash: {
          tenantId: input.tenantId,
          packageHash: input.packageHash,
        },
      },
    });
    return row ? mapStatus(row) : null;
  }

  stage(input: StageFullChainLandingInput) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`full-chain:${input.tenantId}:${input.graph.packageHash}`}, 0))`;
        const replay = await tx.fullChainLandingRun.findUnique({
          where: {
            tenantId_packageHash: {
              tenantId: input.tenantId,
              packageHash: input.graph.packageHash,
            },
          },
        });
        if (replay)
          return {
            runId: replay.id,
            state: replay.state as FullChainLandingStatus["state"],
            replayed: true,
            createdAt: replay.createdAt,
          };
        const keyReuse = await tx.fullChainLandingRun.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (keyReuse) throw new Error("FULL_CHAIN_IDEMPOTENCY_CONFLICT");
        const semanticHash = fullChainLandingProjectionHash(input.graph);
        const sameSemanticRun = await tx.fullChainLandingRun.findFirst({
          where: { tenantId: input.tenantId, semanticHash },
        });
        if (sameSemanticRun)
          return {
            runId: sameSemanticRun.id,
            state: sameSemanticRun.state as FullChainLandingStatus["state"],
            replayed: true,
            createdAt: sameSemanticRun.createdAt,
          };
        await this.assertBusinessKeysAvailable(tx, input);
        const inputCounts = countsFor(input);
        const run = await tx.fullChainLandingRun.create({
          data: {
            id: input.runId,
            tenantId: input.tenantId,
            packageHash: input.graph.packageHash,
            semanticHash,
            manifestVersion: manifestField(input.manifest, "manifestVersion"),
            workbookVersion: sourceField(input.manifest, "workbookVersion"),
            compilerVersion: manifestField(input.manifest, "compilerVersion"),
            mappingVersion: manifestField(input.manifest, "mappingVersion"),
            policyVersion: manifestField(input.manifest, "policyVersion"),
            sourceFingerprintHash: sha256Hex(
              sourceField(input.manifest, "sourceSha256"),
            ),
            state: "applying",
            inputCounts,
            appliedCounts: {},
            replayedCounts: {},
            rejectedCounts: {},
            gapCount: input.graph.gaps.length,
            checkCount: Number(input.manifest.checkCount ?? 0),
            actorId: input.actorId,
            traceId: input.traceId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        const targetFactIds = new Map<string, string>();
        const plans = new Map<string, string>();
        for (const plan of input.graph.plans) {
          const row = await tx.fullChainShipmentPlan.create({
            data: {
              tenantId: input.tenantId,
              landingRunId: run.id,
              planNumber: plan.planNumber,
              payloadHash: plan.payloadHash,
            },
          });
          plans.set(plan.planNumber, row.id);
          targetFactIds.set(`shipment_plan:${plan.planNumber}`, row.id);
        }
        const bookings = new Map<string, string>();
        for (const booking of input.graph.bookings) {
          const plan = input.graph.plans.find(
            (item) => item.bookingNumber === booking.bookingNumber,
          );
          if (!plan) throw new Error("FULL_CHAIN_TYPED_REFERENCE_NOT_FOUND");
          const row = await tx.fullChainBookingCommitment.create({
            data: {
              ...booking,
              tenantId: input.tenantId,
              landingRunId: run.id,
              shipmentPlanId: plans.get(plan.planNumber)!,
            },
          });
          bookings.set(booking.bookingNumber, row.id);
          targetFactIds.set(
            `booking_commitment:${booking.bookingNumber}`,
            row.id,
          );
        }
        const documents = new Map<string, string>();
        for (const document of input.graph.documents.filter(
          (item) => item.documentType === "mbl",
        )) {
          const row = await tx.fullChainBookingDocument.create({
            data: {
              tenantId: input.tenantId,
              landingRunId: run.id,
              bookingCommitmentId: bookings.get(document.bookingNumber)!,
              documentType: document.documentType,
              documentNumber: document.number,
            },
          });
          documents.set(`mbl:${document.number}`, row.id);
        }
        for (const document of input.graph.documents.filter(
          (item) => item.documentType === "hbl",
        )) {
          const row = await tx.fullChainBookingDocument.create({
            data: {
              tenantId: input.tenantId,
              landingRunId: run.id,
              bookingCommitmentId: bookings.get(document.bookingNumber)!,
              documentType: document.documentType,
              documentNumber: document.number,
              parentDocumentId: documents.get(
                `mbl:${document.parentMasterBillNumber}`,
              ),
            },
          });
          documents.set(`hbl:${document.number}`, row.id);
        }
        const cargoReady = new Map<string, string>();
        for (const release of input.graph.cargoReadyReleases) {
          const row = await tx.fullChainCargoReadyRelease.create({
            data: {
              ...release,
              tenantId: input.tenantId,
              landingRunId: run.id,
            },
          });
          cargoReady.set(release.cargoReadyNumber, row.id);
          targetFactIds.set(
            `cargo_ready_release:${release.cargoReadyNumber}`,
            row.id,
          );
        }
        for (const link of input.graph.planCargoReadyLinks)
          await tx.fullChainShipmentPlanCargoReady.create({
            data: {
              tenantId: input.tenantId,
              landingRunId: run.id,
              shipmentPlanId: plans.get(link.planNumber)!,
              cargoReadyReleaseId: cargoReady.get(link.cargoReadyNumber)!,
            },
          });
        for (const line of input.graph.stuffingLines) {
          const row = await tx.fullChainStuffingLine.create({
            data: {
              tenantId: input.tenantId,
              landingRunId: run.id,
              cargoReadyReleaseId: cargoReady.get(line.cargoReadyNumber)!,
              houseBillDocumentId: documents.get(
                `hbl:${line.houseBillNumber}`,
              )!,
              containerNumber: line.containerNumber,
              cargoReadyNumber: line.cargoReadyNumber,
              sku: line.sku,
              houseBillNumber: line.houseBillNumber,
              quantity: line.quantity,
              grossWeight: line.grossWeight,
              volume: line.volume,
              payloadHash: line.payloadHash,
            },
          });
          targetFactIds.set(
            `stuffing_snapshot_line:${line.businessKey}`,
            row.id,
          );
        }
        for (const customsCase of input.graph.exportCustomsCases) {
          const row = await tx.fullChainExportCustomsCase.create({
            data: {
              ...customsCase,
              tenantId: input.tenantId,
              landingRunId: run.id,
              houseBillDocumentId: documents.get(
                `hbl:${customsCase.houseBillNumber}`,
              )!,
            },
          });
          targetFactIds.set(
            `export_customs_case:${customsCase.invoiceNumber}`,
            row.id,
          );
        }
        if (this.testHooks.failAfterRecordType === "export_customs_case")
          throw new Error("FULL_CHAIN_STAGE_INJECTED_FAILURE");
        const dispatchFacts = new Map<string, string>();
        for (const dispatch of input.graph.dispatchFacts) {
          const row = await tx.fullChainDispatchFact.create({
            data: {
              ...dispatch,
              tenantId: input.tenantId,
              landingRunId: run.id,
              masterBillDocumentId: documents.get(
                `mbl:${dispatch.masterBillNumber}`,
              )!,
            },
          });
          dispatchFacts.set(dispatch.containerNumber, row.id);
          targetFactIds.set(
            `dispatch_fact:${dispatch.containerNumber}`,
            row.id,
          );
        }
        for (const link of input.graph.dispatchHouseBillLinks)
          await tx.fullChainDispatchHouseBill.create({
            data: {
              tenantId: input.tenantId,
              landingRunId: run.id,
              dispatchFactId: dispatchFacts.get(link.containerNumber)!,
              houseBillDocumentId: documents.get(
                `hbl:${link.houseBillNumber}`,
              )!,
            },
          });
        for (const receipt of input.graph.recordReceipts) {
          const { targetRef, ...storedReceipt } = receipt;
          await tx.fullChainLandingRecordReceipt.create({
            data: {
              ...storedReceipt,
              tenantId: input.tenantId,
              landingRunId: run.id,
              targetFactId: targetFactIds.get(targetRef)!,
              state: "applied",
              issueCodes: [],
            },
          });
        }
        for (const gap of input.graph.gaps)
          await tx.fullChainLandingGap.create({
            data: { ...gap, tenantId: input.tenantId, landingRunId: run.id },
          });
        await tx.fullChainLandingRun.update({
          where: { id: run.id },
          data: { state: "staged", appliedCounts: inputCounts },
        });
        return {
          runId: run.id,
          state: "staged" as const,
          replayed: false,
          createdAt: run.createdAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async assertBusinessKeysAvailable(
    tx: LandingTransaction,
    input: StageFullChainLandingInput,
  ): Promise<void> {
    const conflicts = await Promise.all([
      tx.fullChainShipmentPlan.findFirst({
        where: {
          tenantId: input.tenantId,
          planNumber: { in: input.graph.plans.map((item) => item.planNumber) },
        },
      }),
      tx.fullChainBookingCommitment.findFirst({
        where: {
          tenantId: input.tenantId,
          bookingNumber: {
            in: input.graph.bookings.map((item) => item.bookingNumber),
          },
        },
      }),
      tx.fullChainCargoReadyRelease.findFirst({
        where: {
          tenantId: input.tenantId,
          cargoReadyNumber: {
            in: input.graph.cargoReadyReleases.map(
              (item) => item.cargoReadyNumber,
            ),
          },
        },
      }),
      tx.fullChainStuffingLine.findFirst({
        where: {
          tenantId: input.tenantId,
          OR: input.graph.stuffingLines.map((item) => ({
            containerNumber: item.containerNumber,
            cargoReadyNumber: item.cargoReadyNumber,
            sku: item.sku,
            houseBillNumber: item.houseBillNumber,
          })),
        },
      }),
      tx.fullChainExportCustomsCase.findFirst({
        where: {
          tenantId: input.tenantId,
          invoiceNumber: {
            in: input.graph.exportCustomsCases.map(
              (item) => item.invoiceNumber,
            ),
          },
        },
      }),
      tx.fullChainDispatchFact.findFirst({
        where: {
          tenantId: input.tenantId,
          containerNumber: {
            in: input.graph.dispatchFacts.map((item) => item.containerNumber),
          },
        },
      }),
    ]);
    if (conflicts.some(Boolean))
      throw new Error("FULL_CHAIN_BUSINESS_KEY_CONFLICT");
  }

  async markReceiptPending(input: {
    runId: string;
    tenantId: string;
    errorCode: string;
  }): Promise<void> {
    await this.prisma.fullChainLandingRun.updateMany({
      where: {
        id: input.runId,
        tenantId: input.tenantId,
        state: { in: ["applying", "staged", "receipt_pending"] },
      },
      data: {
        state: "receipt_pending",
        rejectedCounts: { receipt: 1, code: input.errorCode },
      },
    });
  }

  async markReconciling(input: {
    runId: string;
    tenantId: string;
    receiptKeyHash: string;
    receiptDigest: string;
  }): Promise<boolean> {
    const result = await this.prisma.fullChainLandingRun.updateMany({
      where: {
        id: input.runId,
        tenantId: input.tenantId,
        state: { in: ["staged", "receipt_pending"] },
      },
      data: {
        state: "reconciling",
        receiptKeyHash: input.receiptKeyHash,
        receiptDigest: input.receiptDigest,
      },
    });
    return result.count === 1;
  }

  async reconcile(input: {
    runId: string;
    tenantId: string;
  }): Promise<LandingReconciliation> {
    const where = { landingRunId: input.runId, tenantId: input.tenantId };
    const [
      plans,
      bookings,
      cargoReady,
      stuffing,
      customs,
      dispatch,
      planLinks,
      dispatchLinks,
      receipts,
      gaps,
      outboxCount,
      businessTaskCount,
    ] = await Promise.all([
      this.prisma.fullChainShipmentPlan.findMany({
        where,
        orderBy: { planNumber: "asc" },
      }),
      this.prisma.fullChainBookingCommitment.findMany({
        where,
        orderBy: { bookingNumber: "asc" },
      }),
      this.prisma.fullChainCargoReadyRelease.findMany({
        where,
        orderBy: { cargoReadyNumber: "asc" },
      }),
      this.prisma.fullChainStuffingLine.findMany({
        where,
        orderBy: [
          { containerNumber: "asc" },
          { cargoReadyNumber: "asc" },
          { sku: "asc" },
          { houseBillNumber: "asc" },
        ],
      }),
      this.prisma.fullChainExportCustomsCase.findMany({
        where,
        orderBy: { invoiceNumber: "asc" },
      }),
      this.prisma.fullChainDispatchFact.findMany({
        where,
        orderBy: { containerNumber: "asc" },
      }),
      this.prisma.fullChainShipmentPlanCargoReady.findMany({
        where,
        include: { shipmentPlan: true, cargoReadyRelease: true },
        orderBy: [{ shipmentPlanId: "asc" }, { cargoReadyReleaseId: "asc" }],
      }),
      this.prisma.fullChainDispatchHouseBill.findMany({
        where,
        include: { dispatchFact: true, houseBillDocument: true },
        orderBy: [{ dispatchFactId: "asc" }, { houseBillDocumentId: "asc" }],
      }),
      this.prisma.fullChainLandingRecordReceipt.findMany({
        where,
        orderBy: [{ recordType: "asc" }, { businessKeyHash: "asc" }],
      }),
      this.prisma.fullChainLandingGap.findMany({
        where,
        orderBy: [{ code: "asc" }, { recordRefHash: "asc" }],
      }),
      this.prisma.outboxMessage.count({
        where: {
          tenantId: input.tenantId,
          ownerModule: "full-chain-sample-landing",
          aggregateId: input.runId,
        },
      }),
      this.prisma.nodeTask.count({ where: { tenantId: input.tenantId } }),
    ]);
    const projection = {
      plans,
      bookings,
      cargoReady,
      stuffing,
      customs,
      dispatch,
      planLinks,
      dispatchLinks,
      receipts,
      gaps,
    };
    const semanticProjection = {
      plans: plans.map((row) => ({
        planNumber: row.planNumber,
        bookingNumber:
          bookings.find((booking) => booking.shipmentPlanId === row.id)
            ?.bookingNumber ?? "",
        payloadHash: row.payloadHash,
      })),
      bookings: bookings.map((row) => ({
        bookingNumber: row.bookingNumber,
        displayGroupRefs: row.displayGroupRefs,
        payloadHash: row.payloadHash,
      })),
      documents: await this.prisma.fullChainBookingDocument
        .findMany({
          where,
          include: { bookingCommitment: true, parentDocument: true },
          orderBy: [
            { bookingCommitmentId: "asc" },
            { documentType: "asc" },
            { documentNumber: "asc" },
          ],
        })
        .then((rows) =>
          rows.map((row) => ({
            bookingNumber: row.bookingCommitment.bookingNumber,
            documentType: row.documentType,
            number: row.documentNumber,
            parentMasterBillNumber: row.parentDocument?.documentNumber ?? null,
          })),
        ),
      cargoReadyReleases: cargoReady.map((row) => ({
        cargoReadyNumber: row.cargoReadyNumber,
        displayGroupRef: row.displayGroupRef,
        quantity: row.quantity.toString(),
        payloadHash: row.payloadHash,
      })),
      planCargoReadyLinks: planLinks.map((row) => ({
        planNumber: row.shipmentPlan.planNumber,
        cargoReadyNumber: row.cargoReadyRelease.cargoReadyNumber,
      })),
      stuffingLines: stuffing.map((row) => ({
        businessKey: `${row.containerNumber}|${row.cargoReadyNumber}|${row.sku}|${row.houseBillNumber}`,
        containerNumber: row.containerNumber,
        cargoReadyNumber: row.cargoReadyNumber,
        sku: row.sku,
        houseBillNumber: row.houseBillNumber,
        quantity: row.quantity.toString(),
        grossWeight: row.grossWeight.toString(),
        volume: row.volume.toString(),
        payloadHash: row.payloadHash,
      })),
      exportCustomsCases: customs.map((row) => ({
        invoiceNumber: row.invoiceNumber,
        houseBillNumber: row.houseBillNumber,
        declarationNumber: row.declarationNumber,
        amount: row.amount.toString(),
        currency: row.currency,
        payloadHash: row.payloadHash,
      })),
      dispatchFacts: dispatch.map((row) => ({
        containerNumber: row.containerNumber,
        vesselName: row.vesselName,
        voyageNumber: row.voyageNumber,
        masterBillNumber: row.masterBillNumber,
        gateInDate: row.gateInDate,
        departedAt: row.departedAt,
        departedPrecision: row.departedPrecision,
        motherVesselDepartedAt: row.motherVesselDepartedAt,
        payloadHash: row.payloadHash,
      })),
      dispatchHouseBillLinks: dispatchLinks.map((row) => ({
        containerNumber: row.dispatchFact.containerNumber,
        houseBillNumber: row.houseBillDocument.documentNumber,
      })),
      recordReceipts: receipts.map((row) => ({
        recordType: row.recordType,
        businessKeyHash: row.businessKeyHash,
        recordHash: row.recordHash,
        sourceRefHash: row.sourceRefHash,
      })),
      gaps: gaps.map((row) => ({
        code: row.code,
        status: row.status,
        recordRefHash: row.recordRefHash,
      })),
    };
    return {
      projectionHash: sha256Hex(canonicalStringify(projection)),
      semanticHash: sha256Hex(canonicalStringify(semanticProjection)),
      factCounts: {
        shipment_plan: plans.length,
        booking_commitment: bookings.length,
        cargo_ready_release: cargoReady.length,
        stuffing_snapshot_line: stuffing.length,
        export_customs_case: customs.length,
        dispatch_fact: dispatch.length,
      },
      relationCounts: {
        planCargoReady: planLinks.length,
        dispatchHouseBill: dispatchLinks.length,
      },
      receiptCount: receipts.length,
      gapCount: gaps.length,
      outboxCount,
      businessTaskCount,
    };
  }

  async publish(input: {
    runId: string;
    tenantId: string;
    reconciliation: LandingReconciliation;
    traceId: string;
  }): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`full-chain-publish:${input.tenantId}:${input.runId}`}, 0))`;
        const run = await tx.fullChainLandingRun.findUnique({
          where: {
            id_tenantId: { id: input.runId, tenantId: input.tenantId },
          },
        });
        if (!run) throw new Error("FULL_CHAIN_LANDING_NOT_FOUND");
        if (run.state === "published") return;
        if (run.state !== "reconciling")
          throw new Error("FULL_CHAIN_PUBLISH_STATE_INVALID");
        const occurredAt = new Date();
        await tx.outboxMessage.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            ownerModule: "full-chain-sample-landing",
            eventId: randomUUID(),
            eventType: "full_chain_sample_landing.published",
            eventVersion: 1,
            aggregateType: "full_chain_landing_run",
            aggregateId: input.runId,
            payloadRef: `full-chain-landing/${input.runId}/v1`,
            payloadHash: input.reconciliation.projectionHash,
            state: "pending",
            occurredAt,
            idempotencyKey: `full-chain-landing:${input.runId}:published`,
            traceId: input.traceId,
          },
        });
        await tx.fullChainLandingRun.update({
          where: { id: input.runId },
          data: {
            state: "published",
            reconciliationHash: input.reconciliation.projectionHash,
            publishedAt: occurredAt,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getStatus(input: {
    runId: string;
    tenantId: string;
  }): Promise<FullChainLandingStatus | null> {
    const row = await this.prisma.fullChainLandingRun.findUnique({
      where: { id_tenantId: { id: input.runId, tenantId: input.tenantId } },
    });
    return row ? mapStatus(row) : null;
  }

  async getChain(input: {
    runId: string;
    tenantId: string;
    planNumber: string;
  }): Promise<PublishedFullChain | null> {
    const run = await this.prisma.fullChainLandingRun.findUnique({
      where: { id_tenantId: { id: input.runId, tenantId: input.tenantId } },
    });
    if (!run || run.state !== "published") return null;
    const plan = await this.prisma.fullChainShipmentPlan.findFirst({
      where: {
        landingRunId: input.runId,
        tenantId: input.tenantId,
        planNumber: input.planNumber,
      },
      include: {
        bookings: {
          include: {
            documents: {
              include: { parentDocument: true },
              orderBy: [{ documentType: "asc" }, { documentNumber: "asc" }],
            },
          },
        },
        cargoReady: {
          include: { cargoReadyRelease: true },
        },
      },
    });
    if (!plan || plan.bookings.length !== 1) return null;
    const booking = plan.bookings[0]!;
    const [stuffing, exportCustoms, dispatch, gaps] = await Promise.all([
      this.prisma.fullChainStuffingLine.findMany({
        where: { landingRunId: input.runId, tenantId: input.tenantId },
        orderBy: [
          { containerNumber: "asc" },
          { cargoReadyNumber: "asc" },
          { sku: "asc" },
          { houseBillNumber: "asc" },
        ],
      }),
      this.prisma.fullChainExportCustomsCase.findMany({
        where: { landingRunId: input.runId, tenantId: input.tenantId },
        orderBy: { invoiceNumber: "asc" },
      }),
      this.prisma.fullChainDispatchFact.findMany({
        where: { landingRunId: input.runId, tenantId: input.tenantId },
        include: { houseBills: { include: { houseBillDocument: true } } },
        orderBy: { containerNumber: "asc" },
      }),
      this.prisma.fullChainLandingGap.findMany({
        where: { landingRunId: input.runId, tenantId: input.tenantId },
        select: { code: true, status: true },
        orderBy: [{ code: "asc" }, { status: "asc" }],
      }),
    ]);
    return {
      planNumber: plan.planNumber,
      booking: {
        bookingNumber: booking.bookingNumber,
        displayGroupRefs: booking.displayGroupRefs,
        documents: booking.documents.map((document) => ({
          type: document.documentType as "mbl" | "hbl",
          number: document.documentNumber,
          parentNumber: document.parentDocument?.documentNumber ?? null,
        })),
      },
      cargoReady: plan.cargoReady.map(({ cargoReadyRelease }) => ({
        cargoReadyNumber: cargoReadyRelease.cargoReadyNumber,
        displayGroupRef: cargoReadyRelease.displayGroupRef,
        quantity: cargoReadyRelease.quantity.toFixed(),
      })),
      stuffing: stuffing.map((line) => ({
        containerNumber: line.containerNumber,
        cargoReadyNumber: line.cargoReadyNumber,
        sku: line.sku,
        houseBill: { type: "hbl" as const, number: line.houseBillNumber },
        quantity: line.quantity.toFixed(),
        grossWeight: line.grossWeight.toFixed(),
        volume: line.volume.toFixed(),
      })),
      exportCustoms: exportCustoms.map((customsCase) => ({
        invoiceNumber: customsCase.invoiceNumber,
        houseBill: {
          type: "hbl" as const,
          number: customsCase.houseBillNumber,
        },
        declarationNumber: customsCase.declarationNumber,
        amount: customsCase.amount.toFixed(),
        currency: customsCase.currency,
      })),
      dispatch: dispatch.map((fact) => ({
        containerNumber: fact.containerNumber,
        vesselName: fact.vesselName,
        voyageNumber: fact.voyageNumber,
        masterBill: { type: "mbl" as const, number: fact.masterBillNumber },
        houseBills: fact.houseBills.map(({ houseBillDocument }) => ({
          type: "hbl" as const,
          number: houseBillDocument.documentNumber,
        })),
        gateInDate: fact.gateInDate,
        departedAt: fact.departedAt,
        departedPrecision: fact.departedPrecision,
        motherVesselDepartedAt: fact.motherVesselDepartedAt,
      })),
      gaps,
    };
  }
}
