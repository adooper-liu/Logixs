import { describe, expect, it, vi } from "vitest";
import { PrismaReferenceLocationCatalog } from "./prisma-reference-location-catalog";

describe("PrismaReferenceLocationCatalog", () => {
  it("returns only the active ISO and UN/LOCODE releases in stable code order", async () => {
    const transaction = {
      referenceDataRelease: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "iso-release",
            datasetCode: "ISO_3166_1",
            version: "2026-09-23",
          },
          { id: "port-release", datasetCode: "UNLOCODE", version: "2025-1" },
        ]),
      },
      countryCodeReference: {
        findMany: vi.fn().mockResolvedValue([
          { alpha2: "CA", nameEnglish: "Canada" },
          { alpha2: "US", nameEnglish: "United States of America" },
        ]),
      },
      portCodeReference: {
        findMany: vi.fn().mockResolvedValue([
          {
            unlocode: "CAVAN",
            areaCode: "CA",
            entries: [{ name: "Vancouver" }],
            aliases: [],
          },
          {
            unlocode: "CNNGB",
            areaCode: "CN",
            entries: [{ name: "Ningbo" }],
            aliases: [{ aliasName: "宁波", mappingState: "candidate" }],
          },
        ]),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    const catalog = new PrismaReferenceLocationCatalog(prisma as never);

    await expect(catalog.listActive()).resolves.toEqual({
      countryReleaseVersion: "2026-09-23",
      portReleaseVersion: "2025-1",
      countries: [
        { code: "CA", name: "Canada", nameChinese: "加拿大" },
        {
          code: "US",
          name: "United States of America",
          nameChinese: "美国",
        },
      ],
      ports: [
        {
          code: "CAVAN",
          name: "Vancouver",
          nameChinese: null,
          nameChineseState: "missing",
          countryCode: "CA",
          countryNameChinese: "加拿大",
        },
        {
          code: "CNNGB",
          name: "Ningbo",
          nameChinese: "宁波",
          nameChineseState: "candidate",
          countryCode: "CN",
          countryNameChinese: "中国",
        },
      ],
    });
    expect(transaction.referenceDataRelease.findMany).toHaveBeenCalledWith({
      where: {
        datasetCode: { in: ["ISO_3166_1", "UNLOCODE"] },
        status: "active",
      },
      select: { id: true, datasetCode: true, version: true },
    });
    expect(transaction.countryCodeReference.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { releaseId: "iso-release" },
        orderBy: { alpha2: "asc" },
      }),
    );
    expect(transaction.portCodeReference.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { releaseId: "port-release" },
        orderBy: { unlocode: "asc" },
        take: 2_000,
        select: expect.objectContaining({
          aliases: expect.objectContaining({
            where: {
              languageTag: "zh-Hans",
              mappingState: { in: ["confirmed", "candidate"] },
            },
          }),
        }),
      }),
    );
  });

  it("fails explicitly when either active authority release is unavailable", async () => {
    const transaction = {
      referenceDataRelease: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "iso-release",
            datasetCode: "ISO_3166_1",
            version: "2026-09-23",
          },
        ]),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    const catalog = new PrismaReferenceLocationCatalog(prisma as never);

    await expect(catalog.listActive()).rejects.toThrow(
      "ACTIVE_LOCATION_REFERENCE_RELEASE_MISSING",
    );
  });
});
