import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ReferenceCurrencyDirectoryPort,
  ReferenceCurrencyRecord,
  ReferenceCurrencyResolution,
} from "../reference-currency-directory.port";

@Injectable()
export class PrismaReferenceCurrencyDirectory implements ReferenceCurrencyDirectoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listActive(): Promise<ReferenceCurrencyRecord[]> {
    const rows = await this.prisma.currencyCodeReference.findMany({
      orderBy: { alphaCode: "asc" },
      select: CURRENCY_SELECT,
    });
    return rows.map(toRecord);
  }

  async resolve(alphaCode: string): Promise<ReferenceCurrencyResolution> {
    const active = await this.prisma.currencyCodeReference.findUnique({
      where: { alphaCode },
      select: CURRENCY_SELECT,
    });
    if (active) return { status: "active", currency: toRecord(active) };

    const count = await this.prisma.currencyCodeReference.count();
    return count === 0
      ? { status: "unavailable", currency: null }
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
