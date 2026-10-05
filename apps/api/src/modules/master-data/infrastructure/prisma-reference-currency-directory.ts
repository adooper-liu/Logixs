import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ReferenceCurrencyDirectoryPort,
  ReferenceCurrencyRecord,
  ReferenceCurrencyResolution,
} from "../reference-currency-directory.port";

const DATASET_CODE = "ISO_4217_LIST_ONE";
const AUTHORITY = "SIX";

@Injectable()
export class PrismaReferenceCurrencyDirectory implements ReferenceCurrencyDirectoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listActive(): Promise<ReferenceCurrencyRecord[]> {
    const rows = await this.prisma.currencyCodeReference.findMany({
      where: {
        release: {
          authority: AUTHORITY,
          datasetCode: DATASET_CODE,
          status: "active",
        },
      },
      orderBy: { alphaCode: "asc" },
      select: CURRENCY_SELECT,
    });
    return rows.map(toRecord);
  }

  async resolve(alphaCode: string): Promise<ReferenceCurrencyResolution> {
    const activeRelease = await this.prisma.referenceDataRelease.findFirst({
      where: {
        authority: AUTHORITY,
        datasetCode: DATASET_CODE,
        status: "active",
      },
      select: { id: true },
    });
    if (!activeRelease) {
      return { status: "unavailable", currency: null };
    }

    const active = await this.prisma.currencyCodeReference.findFirst({
      where: {
        alphaCode,
        releaseId: activeRelease.id,
      },
      select: CURRENCY_SELECT,
    });
    if (active) return { status: "active", currency: toRecord(active) };

    const exists = await this.prisma.currencyCodeReference.findFirst({
      where: {
        alphaCode,
        release: { authority: AUTHORITY, datasetCode: DATASET_CODE },
      },
      select: { id: true },
    });
    return exists
      ? { status: "inactive", currency: null }
      : { status: "unknown", currency: null };
  }
}

const CURRENCY_SELECT = {
  alphaCode: true,
  numericCode: true,
  minorUnit: true,
  currencyName: true,
} as const;

function toRecord(row: ReferenceCurrencyRecord): ReferenceCurrencyRecord {
  return row;
}
