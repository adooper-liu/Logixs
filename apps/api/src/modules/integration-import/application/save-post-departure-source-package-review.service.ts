import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  PostDepartureSourcePackagePreflightCommandV1,
  PostDepartureSourcePackageReviewCommandV1,
  PostDepartureSourcePackageReviewResultV1,
} from "@logix/contracts";
import { createHash, randomUUID } from "node:crypto";
import {
  IMPORT_REPOSITORY,
  type ImportRepository,
  type PostDepartureSourcePackageReviewSnapshot,
} from "../domain/import.repository";
import { PreflightPostDepartureSourcePackageService } from "./preflight-post-departure-source-package.service";

const HASH_PATTERN = /^[a-f0-9]{64}$/;

@Injectable()
export class SavePostDepartureSourcePackageReviewService {
  constructor(
    private readonly preflightPackage: PreflightPostDepartureSourcePackageService,
    @Inject(IMPORT_REPOSITORY)
    private readonly repository: ImportRepository,
  ) {}

  async execute(
    packageId: string,
    command: unknown,
    tenantId: string,
    operatorId: string,
  ): Promise<PostDepartureSourcePackageReviewResultV1> {
    assertCommand(packageId, command);
    const preflightCommand: PostDepartureSourcePackagePreflightCommandV1 = {
      contractVersion: "post-departure-source-package-preflight.v1",
      sources: command.sources,
    };
    const preflight = await this.preflightPackage.execute(
      preflightCommand,
      tenantId,
    );
    if (
      preflight.packageId !== packageId ||
      preflight.packageId !== command.packageId
    ) {
      throw new BadRequestException("SOURCE_PACKAGE_ID_MISMATCH");
    }
    if (
      preflight.candidates.length === 0 ||
      !preflight.candidates.some((candidate) => candidate.issues.length > 0)
    ) {
      throw new ConflictException("SOURCE_PACKAGE_NOT_REVIEW_ONLY");
    }

    const snapshot: PostDepartureSourcePackageReviewSnapshot = {
      packageId: preflight.packageId,
      sources: preflight.sources,
      candidates: preflight.candidates,
      totals: preflight.totals,
    };
    const snapshotHash = sha256(stableStringify(snapshot));
    const traceId = randomUUID();
    const persisted =
      await this.repository.savePostDepartureSourcePackageReview({
        id: randomUUID(),
        tenantId,
        packageHash: packageId,
        contractVersion: command.contractVersion,
        decision: "review_required",
        candidateCount: preflight.candidates.length,
        reviewRequiredCount: preflight.candidates.filter(
          (candidate) => candidate.issues.length > 0,
        ).length,
        snapshot,
        snapshotHash,
        operatorId,
        traceId,
        sources: command.sources,
      });
    return {
      contractVersion: "post-departure-source-package-review-result.v1",
      reviewId: persisted.review.id,
      packageId: persisted.review.packageHash,
      decision: "review_required",
      status: persisted.created ? "saved" : "duplicate",
      candidateCount: persisted.review.candidateCount,
      savedAt: persisted.review.createdAt.toISOString(),
      traceId: persisted.created ? traceId : persisted.review.traceId,
    };
  }
}

function assertCommand(
  packageId: string,
  command: unknown,
): asserts command is PostDepartureSourcePackageReviewCommandV1 {
  if (
    !HASH_PATTERN.test(packageId) ||
    typeof command !== "object" ||
    command === null ||
    Array.isArray(command) ||
    !("contractVersion" in command) ||
    command.contractVersion !== "post-departure-source-package-review.v1" ||
    !("packageId" in command) ||
    typeof command.packageId !== "string" ||
    !HASH_PATTERN.test(command.packageId) ||
    !("sources" in command) ||
    !Array.isArray(command.sources)
  ) {
    throw new BadRequestException("SOURCE_PACKAGE_REVIEW_INVALID");
  }
  if (packageId !== command.packageId) {
    throw new BadRequestException("SOURCE_PACKAGE_ID_MISMATCH");
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
