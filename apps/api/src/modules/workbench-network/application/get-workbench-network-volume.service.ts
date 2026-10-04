import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  assembleWorkbenchNetworkVolume,
  utcWeekStart,
} from "../domain/workbench-network-volume";
import { PrismaWorkbenchNetworkVolumeRepository } from "../infrastructure/prisma-workbench-network-volume.repository";

@Injectable()
export class GetWorkbenchNetworkVolumeService {
  constructor(
    @Inject(PrismaWorkbenchNetworkVolumeRepository)
    private readonly volume: PrismaWorkbenchNetworkVolumeRepository,
  ) {}

  async execute(input: { tenantId: string; now?: Date }) {
    if (!input.tenantId) {
      throw new ForbiddenException("AUTHORIZATION_SCOPE_DENIED");
    }
    const now = input.now ?? new Date();
    const weekStart = utcWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const counts = await this.volume.count(input.tenantId, weekStart, weekEnd);
    return assembleWorkbenchNetworkVolume(counts, now);
  }
}
