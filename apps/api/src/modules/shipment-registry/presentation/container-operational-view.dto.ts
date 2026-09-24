import { ApiProperty } from "@nestjs/swagger";
import type { ContainerOperationalView } from "@logix/contracts";

export class ContainerOperationalViewDto implements ContainerOperationalView {
  @ApiProperty() tenantId!: string;
  @ApiProperty() containerId!: string;
  @ApiProperty() containerNumber!: string;
  @ApiProperty({ type: Object, nullable: true, required: false })
  shipment?: ContainerOperationalView["shipment"];
  @ApiProperty({ type: Object, nullable: true })
  flow!: ContainerOperationalView["flow"];
  @ApiProperty({ type: Object, nullable: true })
  currentNode!: ContainerOperationalView["currentNode"];
  @ApiProperty({ type: [Object] }) nodes!: ContainerOperationalView["nodes"];
  @ApiProperty({ type: Object })
  currentTimes!: ContainerOperationalView["currentTimes"];
  @ApiProperty({ type: [Object] }) tasks!: ContainerOperationalView["tasks"];
  @ApiProperty({ type: [Object] })
  workOrders!: ContainerOperationalView["workOrders"];
  @ApiProperty({ type: [Object] })
  professionalFacts!: ContainerOperationalView["professionalFacts"];
  @ApiProperty({ type: Object })
  evidenceSummary!: ContainerOperationalView["evidenceSummary"];
  @ApiProperty({ type: Object })
  syncSummary!: ContainerOperationalView["syncSummary"];
  @ApiProperty({ type: [Object] })
  activeBlocks!: ContainerOperationalView["activeBlocks"];
  @ApiProperty({ type: [Object] })
  activeExceptions!: ContainerOperationalView["activeExceptions"];
  @ApiProperty({ type: [Object] })
  allowedActions!: ContainerOperationalView["allowedActions"];
  @ApiProperty() projectionVersion!: number;
  @ApiProperty({ type: [Object] })
  sourceVersions!: ContainerOperationalView["sourceVersions"];
  @ApiProperty() asOf!: string;
  @ApiProperty({ type: Object })
  freshness!: ContainerOperationalView["freshness"];
}
