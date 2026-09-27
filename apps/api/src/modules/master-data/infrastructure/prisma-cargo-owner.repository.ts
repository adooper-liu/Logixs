import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { CargoOwnerDirectoryRecord } from "../cargo-owner-directory.port";
import type { CargoOwnerRepository } from "../domain/cargo-owner.repository";

const ACTIVE_RELEASE = {
  datasetCode: "CARGO_OWNER_SALES_COUNTRY",
  status: "active",
} as const;

@Injectable()
export class PrismaCargoOwnerRepository implements CargoOwnerRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listActive(): Promise<CargoOwnerDirectoryRecord[]> {
    const rows = await this.prisma.cargoOwnerReference.findMany({
      where: { release: ACTIVE_RELEASE },
      orderBy: { stableCode: "asc" },
      select: selection,
    });
    return rows.map(toRecord);
  }

  async findActiveById(id: string): Promise<CargoOwnerDirectoryRecord | null> {
    const row = await this.prisma.cargoOwnerReference.findFirst({
      where: { id, release: ACTIVE_RELEASE },
      select: selection,
    });
    return row ? toRecord(row) : null;
  }
}

const selection = {
  id: true,
  stableCode: true,
  legalName: true,
  salesCountry: { select: { alpha2: true, nameEnglish: true } },
} as const;

const regionNamesChinese = new Intl.DisplayNames(["zh-CN"], {
  type: "region",
  fallback: "code",
});

function toRecord(row: {
  id: string;
  stableCode: string;
  legalName: string;
  salesCountry: { alpha2: string; nameEnglish: string };
}): CargoOwnerDirectoryRecord {
  const chineseName = regionNamesChinese.of(row.salesCountry.alpha2);
  return {
    id: row.id,
    stableCode: row.stableCode,
    legalName: row.legalName,
    salesCountryCode: row.salesCountry.alpha2,
    salesCountryNameChinese:
      !chineseName || chineseName === row.salesCountry.alpha2
        ? row.salesCountry.nameEnglish
        : chineseName,
  };
}
