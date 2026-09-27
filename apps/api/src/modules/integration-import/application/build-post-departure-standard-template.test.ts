import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import standardImportCatalog from "@logix/contracts/post-departure-standard-import.json";
import { buildPostDepartureStandardTemplate } from "./build-post-departure-standard-template";

const REFERENCE_LOCATIONS = {
  countryReleaseVersion: "ISO-2026-09-23",
  portReleaseVersion: "UNLOCODE-2025-1",
  countries: [
    { code: "CA", name: "Canada", nameChinese: "加拿大" },
    { code: "GB", name: "United Kingdom", nameChinese: "英国" },
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
      nameChineseState: "missing" as const,
      countryCode: "CA",
      countryNameChinese: "加拿大",
    },
    {
      code: "CNNGB",
      name: "Ningbo",
      nameChinese: "宁波",
      nameChineseState: "candidate" as const,
      countryCode: "CN",
      countryNameChinese: "中国",
    },
  ],
};

describe("buildPostDepartureStandardTemplate", () => {
  it("builds the fixed six-sheet V1 workbook without import data rows", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      (await buildPostDepartureStandardTemplate(REFERENCE_LOCATIONS)) as never,
    );

    expect(workbook.worksheets.map(({ name }) => name)).toEqual([
      "填写说明",
      "已出运接管",
      "SKU装载明细",
      "标准值",
      "代码字典",
      "真实示例",
    ]);

    for (const definition of standardImportCatalog.sheets) {
      const sheet = workbook.getWorksheet(definition.name)!;
      expect(
        definition.fields.map((_, index) => sheet.getCell(1, index + 1).text),
      ).toEqual(definition.fields.map(({ label }) => label));
      expect(sheet.actualRowCount).toBe(1);
    }
  });

  it("keeps controlled values and verified sample facts outside import sheets", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      (await buildPostDepartureStandardTemplate(REFERENCE_LOCATIONS)) as never,
    );

    const handoffDefinition = standardImportCatalog.sheets[0]!;
    const precisionColumn =
      handoffDefinition.fields.findIndex(
        ({ code }) => code === "departure_time_precision",
      ) + 1;
    expect(
      workbook.getWorksheet("已出运接管")!.getCell(2, precisionColumn)
        .dataValidation,
    ).toMatchObject({ type: "list", allowBlank: true });
    expect(workbook.getWorksheet("真实示例")!.getCell("C5").text).toBe(
      "HMMU4956442",
    );
    const salesCountryColumn =
      handoffDefinition.fields.findIndex(
        ({ code }) => code === "sales_country_code",
      ) + 1;
    const cargoOwnerColumn =
      handoffDefinition.fields.findIndex(
        ({ code }) => code === "cargo_owner_name",
      ) + 1;
    expect(
      workbook.getWorksheet("真实示例")!.getCell(5, salesCountryColumn).text,
    ).toBe("CA");
    expect(
      workbook.getWorksheet("真实示例")!.getCell(5, cargoOwnerColumn).text,
    ).toBe("AOSOM CANADA INC.");
    expect(workbook.getWorksheet("真实示例")!.getCell("A11").text).toContain(
      "Shipment 业务号为演示标识",
    );
  });

  it("provides active country and port dictionaries as named dropdown lists", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      (await buildPostDepartureStandardTemplate(REFERENCE_LOCATIONS)) as never,
    );
    const dictionary = workbook.getWorksheet("代码字典")!;
    expect(dictionary.getCell("B2").text).toBe("ISO-2026-09-23");
    expect(dictionary.getCell("G2").text).toBe("UNLOCODE-2025-1");
    expect(dictionary.getColumn(1).values).toEqual(
      expect.arrayContaining([
        "CA | 加拿大 | Canada",
        "GB | 英国 | United Kingdom",
        "US | 美国 | United States of America",
      ]),
    );
    expect(dictionary.getColumn(6).values).toEqual(
      expect.arrayContaining([
        "CAVAN | 加拿大（港口中文名待维护） | Vancouver",
        "CNNGB | 宁波（候选） | Ningbo",
      ]),
    );
    expect(
      workbook.definedNames.getRanges("SalesCountryChoices").ranges,
    ).toEqual(["'代码字典'!$A$5:$A$7"]);
    expect(workbook.definedNames.getRanges("PortChoices").ranges).toEqual([
      "'代码字典'!$F$5:$F$6",
    ]);

    const handoffDefinition = standardImportCatalog.sheets[0]!;
    const handoff = workbook.getWorksheet(handoffDefinition.name)!;
    const validationFor = (code: string) =>
      handoff.getCell(
        2,
        handoffDefinition.fields.findIndex((field) => field.code === code) + 1,
      ).dataValidation;
    expect(validationFor("sales_country_code")).toMatchObject({
      type: "list",
      allowBlank: true,
      formulae: ["SalesCountryChoices"],
    });
    expect(validationFor("origin_port_code")).toMatchObject({
      type: "list",
      allowBlank: true,
      formulae: ["PortChoices"],
    });
    expect(validationFor("destination_port_code")).toMatchObject({
      type: "list",
      allowBlank: true,
      formulae: ["PortChoices"],
    });
  });
});
