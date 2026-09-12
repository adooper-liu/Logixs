import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { HealthDto } from "./health.dto";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({ type: HealthDto })
  async check(): Promise<{ status: string; database: string }> {
    let database = "up";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "down";
    }
    return { status: database === "up" ? "ok" : "degraded", database };
  }
}
