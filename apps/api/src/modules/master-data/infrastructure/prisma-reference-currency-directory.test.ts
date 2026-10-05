import { describe, expect, it, vi } from "vitest";
import { PrismaReferenceCurrencyDirectory } from "./prisma-reference-currency-directory";

describe("PrismaReferenceCurrencyDirectory", () => {
  it("lists only active currencies in code order", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        alphaCode: "EUR",
        numericCode: "978",
        minorUnit: 2,
        currencyName: "Euro",
      },
      {
        alphaCode: "USD",
        numericCode: "840",
        minorUnit: 2,
        currencyName: "US Dollar",
      },
    ]);
    const directory = new PrismaReferenceCurrencyDirectory({
      currencyCodeReference: { findMany },
    } as never);

    await expect(directory.listActive()).resolves.toHaveLength(2);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          release: {
            authority: "SIX",
            datasetCode: "ISO_4217_LIST_ONE",
            status: "active",
          },
        },
        orderBy: { alphaCode: "asc" },
      }),
    );
  });

  it("returns unavailable before interpreting staged rows as inactive", async () => {
    const releaseFindFirst = vi.fn().mockResolvedValue(null);
    const currencyFindFirst = vi.fn();
    const directory = new PrismaReferenceCurrencyDirectory({
      referenceDataRelease: { findFirst: releaseFindFirst },
      currencyCodeReference: { findFirst: currencyFindFirst },
    } as never);

    await expect(directory.resolve("USD")).resolves.toEqual({
      status: "unavailable",
      currency: null,
    });
    expect(releaseFindFirst).toHaveBeenCalledWith({
      where: {
        authority: "SIX",
        datasetCode: "ISO_4217_LIST_ONE",
        status: "active",
      },
      select: { id: true },
    });
    expect(currencyFindFirst).not.toHaveBeenCalled();
  });

  it("distinguishes active, inactive and unknown codes once a release is active", async () => {
    const releaseFindFirst = vi
      .fn()
      .mockResolvedValue({ id: "active-release" });
    const currencyFindFirst = vi
      .fn()
      .mockResolvedValueOnce({
        alphaCode: "USD",
        numericCode: "840",
        minorUnit: 2,
        currencyName: "US Dollar",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "inactive" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const directory = new PrismaReferenceCurrencyDirectory({
      referenceDataRelease: { findFirst: releaseFindFirst },
      currencyCodeReference: { findFirst: currencyFindFirst },
    } as never);

    await expect(directory.resolve("USD")).resolves.toMatchObject({
      status: "active",
    });
    await expect(directory.resolve("EUR")).resolves.toEqual({
      status: "inactive",
      currency: null,
    });
    await expect(directory.resolve("ZZZ")).resolves.toEqual({
      status: "unknown",
      currency: null,
    });
    expect(releaseFindFirst).toHaveBeenCalledTimes(3);
    expect(currencyFindFirst).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: {
          alphaCode: "EUR",
          release: {
            authority: "SIX",
            datasetCode: "ISO_4217_LIST_ONE",
          },
        },
      }),
    );
  });
});
