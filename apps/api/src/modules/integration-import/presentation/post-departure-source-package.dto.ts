import { ApiProperty } from "@nestjs/swagger";
import type {
  PostDepartureSourceBatchV1,
  PostDepartureSourcePackagePreflightCommandV1,
  PostDepartureSourcePackageReviewCommandV1,
  PostDepartureSourceCandidateCorrectionCommandV1,
  PostDepartureSourceCandidateCargoCommandV1,
  PostDepartureSourceCandidateAcceptCommandV1,
  PostDepartureSourcePackageAcceptCommandV1,
} from "@logix/contracts";

export class PostDepartureSourceBatchDto implements PostDepartureSourceBatchV1 {
  @ApiProperty({ enum: ["container", "customs", "logistics", "warehouse"] })
  kind!: PostDepartureSourceBatchV1["kind"];
  @ApiProperty({ format: "uuid" }) batchId!: string;
}

export class PostDepartureSourcePackagePreflightRequestDto implements PostDepartureSourcePackagePreflightCommandV1 {
  @ApiProperty({ enum: ["post-departure-source-package-preflight.v1"] })
  contractVersion!: PostDepartureSourcePackagePreflightCommandV1["contractVersion"];
  @ApiProperty({ type: [PostDepartureSourceBatchDto] })
  sources!: PostDepartureSourcePackagePreflightCommandV1["sources"];
}

export class PostDepartureSourcePackageReviewRequestDto implements PostDepartureSourcePackageReviewCommandV1 {
  @ApiProperty({ enum: ["post-departure-source-package-review.v1"] })
  contractVersion!: PostDepartureSourcePackageReviewCommandV1["contractVersion"];
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) packageId!: string;
  @ApiProperty({ type: [PostDepartureSourceBatchDto] })
  sources!: PostDepartureSourcePackageReviewCommandV1["sources"];
}

export class PostDepartureReferencePortQueryDto {
  @ApiProperty({ minLength: 1, maxLength: 100 }) query!: string;
  @ApiProperty({ required: false, minimum: 1, maximum: 50 })
  pageSize?: string;
  @ApiProperty({ required: false, pattern: "^[A-Z]{2}[A-Z0-9]{3}$" })
  cursor?: string;
}

export class PostDepartureSourceCandidateCorrectionRequestDto implements PostDepartureSourceCandidateCorrectionCommandV1 {
  @ApiProperty({
    enum: ["post-departure-source-candidate-correction.v1"],
  })
  contractVersion!: PostDepartureSourceCandidateCorrectionCommandV1["contractVersion"];
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) packageId!: string;
  @ApiProperty({ format: "uuid" }) reviewId!: string;
  @ApiProperty({ minLength: 1, maxLength: 200 }) candidateRef!: string;
  @ApiProperty({ minimum: 0 }) expectedVersion!: number;
  @ApiProperty({
    required: false,
    nullable: true,
    example: {
      kind: "existing_shipment",
      shipmentId: "11111111-1111-4111-8111-111111111111",
      expectedRelationshipVersion: 3,
    },
  })
  shipmentGrouping?: PostDepartureSourceCandidateCorrectionCommandV1["shipmentGrouping"];
  @ApiProperty({
    required: false,
    nullable: true,
    pattern: "^[A-Z]{2}[A-Z0-9]{3}$",
  })
  originPortCode?: string | null;
  @ApiProperty({
    required: false,
    nullable: true,
    pattern: "^[A-Z]{2}[A-Z0-9]{3}$",
  })
  destinationPortCode?: string | null;
  @ApiProperty({
    required: false,
    example: {
      kind: "actual_departure_time",
      occurredAt: "2026-09-22T16:00:00.000Z",
      sourceTimezone: "Asia/Shanghai",
      evidenceRef: "11111111-1111-4111-8111-111111111111",
    },
  })
  departureProof?: PostDepartureSourceCandidateCorrectionCommandV1["departureProof"];
  @ApiProperty({ required: false, nullable: true, maxLength: 32 })
  departureLocal?: string | null;
  @ApiProperty({ required: false, nullable: true, maxLength: 100 })
  departureSourceTimezone?: string | null;
  @ApiProperty({ required: false, nullable: true, format: "uuid" })
  departureEvidenceRef?: string | null;
  @ApiProperty({ pattern: "^[a-z][a-z0-9_]{0,99}$" })
  reasonCode!: string;
  @ApiProperty({ minLength: 1, maxLength: 200 }) idempotencyKey!: string;
}

export class PostDepartureSourceCandidateCargoRequestDto implements PostDepartureSourceCandidateCargoCommandV1 {
  @ApiProperty({ enum: ["post-departure-source-candidate-cargo.v1"] })
  contractVersion!: PostDepartureSourceCandidateCargoCommandV1["contractVersion"];
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) packageId!: string;
  @ApiProperty({ format: "uuid" }) reviewId!: string;
  @ApiProperty({ minLength: 1, maxLength: 200 }) candidateRef!: string;
  @ApiProperty({ minimum: 1 }) expectedVersion!: number;
  @ApiProperty({ type: [Object], minItems: 1, maxItems: 1000 })
  cargoLines!: PostDepartureSourceCandidateCargoCommandV1["cargoLines"];
  @ApiProperty({ pattern: "^[a-z][a-z0-9_]{0,99}$" }) reasonCode!: string;
  @ApiProperty({ minLength: 1, maxLength: 200 }) idempotencyKey!: string;
}

export class PostDepartureSourceCandidateAcceptRequestDto implements PostDepartureSourceCandidateAcceptCommandV1 {
  @ApiProperty({ enum: ["post-departure-source-candidate-accept.v1"] })
  contractVersion!: PostDepartureSourceCandidateAcceptCommandV1["contractVersion"];
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) packageId!: string;
  @ApiProperty({ type: [PostDepartureSourceBatchDto] })
  sources!: PostDepartureSourceCandidateAcceptCommandV1["sources"];
  @ApiProperty({ minLength: 1, maxLength: 200 }) candidateRef!: string;
  @ApiProperty({ minLength: 1, maxLength: 200 }) idempotencyKey!: string;
}

export class PostDepartureSourcePackageAcceptRequestDto implements PostDepartureSourcePackageAcceptCommandV1 {
  @ApiProperty({ enum: ["post-departure-source-package-accept.v1"] })
  contractVersion!: PostDepartureSourcePackageAcceptCommandV1["contractVersion"];
  @ApiProperty({ pattern: "^[a-f0-9]{64}$" }) packageId!: string;
  @ApiProperty({ type: [PostDepartureSourceBatchDto] })
  sources!: PostDepartureSourcePackageAcceptCommandV1["sources"];
  @ApiProperty({ minLength: 1, maxLength: 200 }) idempotencyKey!: string;
}
