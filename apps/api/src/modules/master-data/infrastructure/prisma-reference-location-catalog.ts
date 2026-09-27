import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  ReferenceLocationCatalogPort,
  ReferenceLocationCatalogSnapshot,
} from "../reference-location-catalog.port";

const ISO_DATASET = "ISO_3166_1";
const PORT_DATASET = "UNLOCODE";
const PORT_PAGE_SIZE = 2_000;

@Injectable()
export class PrismaReferenceLocationCatalog implements ReferenceLocationCatalogPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listActive(): Promise<ReferenceLocationCatalogSnapshot> {
    return this.prisma.$transaction(async (transaction) => {
      const releases = await transaction.referenceDataRelease.findMany({
        where: {
          datasetCode: { in: [ISO_DATASET, PORT_DATASET] },
          status: "active",
        },
        select: { id: true, datasetCode: true, version: true },
      });
      const countryRelease = releases.find(
        ({ datasetCode }) => datasetCode === ISO_DATASET,
      );
      const portRelease = releases.find(
        ({ datasetCode }) => datasetCode === PORT_DATASET,
      );
      if (!countryRelease || !portRelease) {
        throw new Error("ACTIVE_LOCATION_REFERENCE_RELEASE_MISSING");
      }

      const countries = await transaction.countryCodeReference.findMany({
        where: { releaseId: countryRelease.id },
        orderBy: { alpha2: "asc" },
        select: { alpha2: true, nameEnglish: true },
      });
      const countryNamesChinese = new Map(
        countries.map((country) => [
          country.alpha2,
          chineseRegionName(country.alpha2, country.nameEnglish),
        ]),
      );
      const ports: Array<{
        unlocode: string;
        areaCode: string;
        entries: Array<{ name: string }>;
        aliases: Array<{
          aliasName: string;
          mappingState: string;
        }>;
      }> = [];
      let afterUnlocode: string | undefined;
      for (;;) {
        const page = await transaction.portCodeReference.findMany({
          where: {
            releaseId: portRelease.id,
            ...(afterUnlocode ? { unlocode: { gt: afterUnlocode } } : {}),
          },
          orderBy: { unlocode: "asc" },
          take: PORT_PAGE_SIZE,
          select: {
            unlocode: true,
            areaCode: true,
            entries: {
              orderBy: { sourceRowNumber: "desc" },
              take: 1,
              select: { name: true },
            },
            aliases: {
              where: {
                languageTag: "zh-Hans",
                mappingState: { in: ["confirmed", "candidate"] },
              },
              orderBy: { aliasName: "asc" },
              select: { aliasName: true, mappingState: true },
            },
          },
        });
        ports.push(...page);
        if (page.length < PORT_PAGE_SIZE) break;
        afterUnlocode = page.at(-1)!.unlocode;
      }

      return {
        countryReleaseVersion: countryRelease.version,
        portReleaseVersion: portRelease.version,
        countries: countries.map((country) => ({
          code: country.alpha2,
          name: country.nameEnglish,
          nameChinese: countryNamesChinese.get(country.alpha2)!,
        })),
        ports: ports.map((port) => {
          const chineseName = preferredChinesePortName(port.aliases);
          return {
            code: port.unlocode,
            name: port.entries[0]?.name ?? port.unlocode,
            nameChinese: chineseName?.name ?? null,
            nameChineseState: chineseName?.state ?? "missing",
            countryCode: port.areaCode,
            countryNameChinese:
              countryNamesChinese.get(port.areaCode) ??
              (port.areaCode === "XZ"
                ? "国际水域"
                : chineseRegionName(port.areaCode, port.areaCode)),
          };
        }),
      };
    });
  }
}

const regionNamesChinese = new Intl.DisplayNames(["zh-CN"], {
  type: "region",
  fallback: "code",
});

function chineseRegionName(code: string, fallback: string): string {
  const name = regionNamesChinese.of(code);
  return !name || name === code ? fallback : name;
}

function preferredChinesePortName(
  aliases: Array<{ aliasName: string; mappingState: string }>,
): { name: string; state: "confirmed" | "candidate" } | undefined {
  const confirmed = aliases.find(
    ({ mappingState }) => mappingState === "confirmed",
  );
  if (confirmed) return { name: confirmed.aliasName, state: "confirmed" };
  const candidate = aliases.find(
    ({ mappingState }) => mappingState === "candidate",
  );
  return candidate
    ? { name: candidate.aliasName, state: "candidate" }
    : undefined;
}
