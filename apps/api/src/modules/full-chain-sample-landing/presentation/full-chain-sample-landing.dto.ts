import type {
  FullChainPackageArtifacts,
  FullChainRecordType,
} from "@logix/full-chain-sample-contracts";
import { ApiProperty } from "@nestjs/swagger";

export class FullChainLandingApplyRequestDto {
  @ApiProperty({ type: Object })
  declare artifacts: FullChainPackageArtifacts;

  @ApiProperty()
  declare idempotencyKey: string;

  @ApiProperty()
  declare traceId: string;
}

export class FullChainLandingResultDto {
  @ApiProperty()
  declare runId: string;

  @ApiProperty({ enum: ["published", "replayed"] })
  declare state: "published" | "replayed";

  @ApiProperty({ type: Object })
  declare counts: Record<FullChainRecordType, number>;

  @ApiProperty()
  declare gapCount: number;
}

export class FullChainLandingStatusDto {
  @ApiProperty()
  declare runId: string;

  @ApiProperty()
  declare state: string;

  @ApiProperty({ type: Object })
  declare inputCounts: Record<string, number>;

  @ApiProperty({ type: Object })
  declare appliedCounts: Record<string, number>;

  @ApiProperty()
  declare gapCount: number;

  @ApiProperty()
  declare checkCount: number;
}

export class FullChainLandingChainDto {
  @ApiProperty()
  declare planNumber: string;

  @ApiProperty({ type: Object })
  declare booking: Record<string, unknown>;

  @ApiProperty({ type: [Object] })
  declare cargoReady: Array<Record<string, unknown>>;

  @ApiProperty({ type: [Object] })
  declare stuffing: Array<Record<string, unknown>>;

  @ApiProperty({ type: [Object] })
  declare exportCustoms: Array<Record<string, unknown>>;

  @ApiProperty({ type: [Object] })
  declare dispatch: Array<Record<string, unknown>>;

  @ApiProperty({ type: [Object] })
  declare gaps: Array<Record<string, unknown>>;
}
