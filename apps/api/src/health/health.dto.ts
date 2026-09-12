import { ApiProperty } from "@nestjs/swagger";

export class HealthDto {
  @ApiProperty({
    description: "整体状态",
    enum: ["ok", "degraded"],
    example: "ok",
  })
  status!: string;

  @ApiProperty({
    description: "数据库连通",
    enum: ["up", "down"],
    example: "up",
  })
  database!: string;
}
