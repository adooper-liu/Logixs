import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  WorkSessionActivateCommandV1,
  WorkSessionCloseCommandV1,
  WorkSessionOpenCommandV1,
  WorkSessionRouteContextV1,
  WorkSessionSubjectRefV1,
  WorkSessionTaskRefV1,
  WorkSessionUpdateCommandV1,
} from "@logix/contracts";

export class WorkSessionOpenRequestDto implements WorkSessionOpenCommandV1 {
  @ApiProperty({ enum: ["work-session-open.v1"] })
  contractVersion!: "work-session-open.v1";
  @ApiProperty({ enum: ["product_selection", "stuffing"] })
  workbenchCode!: WorkSessionOpenCommandV1["workbenchCode"];
  @ApiProperty({ type: Object })
  routeContext!: WorkSessionRouteContextV1;
  @ApiProperty({ type: Object }) subjectRef!: WorkSessionSubjectRefV1;
  @ApiPropertyOptional({ type: Object, nullable: true })
  taskRef?: WorkSessionTaskRefV1 | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  draftRef?: WorkSessionOpenCommandV1["draftRef"];
  @ApiPropertyOptional({ nullable: true }) domainVersionSeen?: number | null;
  @ApiPropertyOptional({ nullable: true }) activeItemKey?: string | null;
  @ApiPropertyOptional({ nullable: true }) contextMode?: string | null;
  @ApiProperty() displaySummary!: string;
}

export class WorkSessionUpdateRequestDto implements WorkSessionUpdateCommandV1 {
  @ApiProperty({ enum: ["work-session-update.v1"] })
  contractVersion!: "work-session-update.v1";
  @ApiProperty() expectedVersion!: number;
  @ApiPropertyOptional() status?: WorkSessionUpdateCommandV1["status"];
  @ApiPropertyOptional({ type: Object, nullable: true })
  draftRef?: WorkSessionUpdateCommandV1["draftRef"];
  @ApiPropertyOptional({ nullable: true }) domainVersionSeen?: number | null;
  @ApiPropertyOptional({ nullable: true }) activeItemKey?: string | null;
  @ApiPropertyOptional({ nullable: true }) contextMode?: string | null;
  @ApiPropertyOptional() displaySummary?: string;
}

export class WorkSessionActivateRequestDto implements WorkSessionActivateCommandV1 {
  @ApiProperty({ enum: ["work-session-activate.v1"] })
  contractVersion!: "work-session-activate.v1";
  @ApiProperty() sourceSessionId!: string;
  @ApiProperty() expectedSourceSessionVersion!: number;
  @ApiProperty() expectedTargetSessionVersion!: number;
  @ApiProperty() sourceStatus!: WorkSessionActivateCommandV1["sourceStatus"];
  @ApiPropertyOptional({ nullable: true }) domainVersionSeen!: number | null;
}

export class WorkSessionCloseRequestDto implements WorkSessionCloseCommandV1 {
  @ApiProperty({ enum: ["work-session-close.v1"] })
  contractVersion!: "work-session-close.v1";
  @ApiProperty() expectedVersion!: number;
}
