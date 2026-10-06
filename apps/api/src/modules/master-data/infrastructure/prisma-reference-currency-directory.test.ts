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
        orderBy: { alphaCode: "asc" },
      }),
    );
  });

  it("returns unavailable when the direct currency table is empty", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const count = vi.fn().mockResolvedValue(0);
    const directory = new PrismaReferenceCurrencyDirectory({
      currencyCodeReference: { findUnique, count },
    } as never);

    await expect(directory.resolve("USD")).resolves.toEqual({
      status: "unavailable",
      currency: null,
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { alphaCode: "USD" } }),
    );
    expect(count).toHaveBeenCalledWith();
  });

  it("distinguishes active and unknown codes without release queries", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({
        alphaCode: "USD",
        numericCode: "840",
        minorUnit: 2,
        currencyName: "US Dollar",
      })
      .mockResolvedValueOnce(null);
    const count = vi.fn().mockResolvedValue(178);
    const directory = new PrismaReferenceCurrencyDirectory({
      currencyCodeReference: { findUnique, count },
    } as never);

    await expect(directory.resolve("USD")).resolves.toMatchObject({
      status: "active",
    });
    await expect(directory.resolve("ZZZ")).resolves.toEqual({
      status: "unknown",
      currency: null,
    });
    expect(findUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { alphaCode: "ZZZ" },
      }),
    );
  });
});
