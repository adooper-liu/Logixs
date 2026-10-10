import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";

export async function createSyntheticWorkbook({
  sheets = [
    {
      name: "09_出运计划",
      headers: ["出运计划编号"],
      rows: [["PLAN-DEMO-001"]],
    },
  ],
  formula = null,
  cachedValue = null,
  formulaCell = "A7",
} = {}) {
  const workbook = new ExcelJS.Workbook();
  for (const definition of sheets) {
    const sheet = workbook.addWorksheet(definition.name);
    sheet.getRow(6).values = definition.headers;
    for (const [index, values] of (definition.rows ?? []).entries())
      sheet.getRow(7 + index).values = values;
    if (formula)
      sheet.getCell(formulaCell).value = { formula, result: cachedValue };
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "full-chain-sample-"));
}
export function manifestFor(buffer, overrides = {}) {
  return {
    manifestVersion: "full-chain-source-manifest.v1",
    sourceAlias: "sample-fixture-v1",
    sha256: createHash("sha256").update(buffer).digest("hex"),
    sizeBytes: buffer.length,
    workbookVersion: "fixture-v1",
    authorizedUse: "local_demo_rehearsal",
    ...overrides,
  };
}

export function createV05LikeScan() {
  const sheetNames = [
    "00_说明与总览",
    "00b_资料分类",
    "01_市场信号",
    "02_选品立项",
    "03_NPI",
    "04_主数据",
    "05_寻源",
    "06_需求补货",
    "07_采购",
    "08_可出运供给",
    "09_出运计划",
    "09a_订舱",
    "10_备货",
    "11_装箱",
    "11a_出口报关",
    "12_出运",
    "13_海运运营",
    "13a_外部跟踪字段",
    "14_进口清关",
    "15_提柜",
    "16_送仓",
    "17_卸柜",
    "18_还箱",
    "19_费用",
    "19a_费率表",
    "19b_滞港费计算",
    "20_异常中心",
    "21_交接链",
    "22_对账",
    "23_待确认",
    "24_历史实绩",
    "25_推导依据",
    "26_样本构建清单",
  ];
  const rows = new Map([
    [
      "09_出运计划",
      [
        {
          workbookRow: 7,
          rowKey: "PLAN-A / 1",
          valuesByHeader: {
            出运计划编号: "SHIP-FIXTURE-001",
            合并备货单: "PLAN-FIXTURE-001",
            "订舱号/SO": "BOOK-FIXTURE-001",
            柜号: "CONT-FIXTURE-001",
          },
        },
      ],
    ],
    [
      "09a_订舱",
      [
        {
          workbookRow: 7,
          rowKey: "BOOK-A / 1",
          valuesByHeader: {
            订舱编号: "BOOKING-FIXTURE-001",
            主备货单号: "CARGO-FIXTURE-001",
            MBL: "MBL-FIXTURE-001",
            "HBL/AMS": "HBL-FIXTURE-001",
          },
        },
      ],
    ],
    [
      "10_备货",
      [
        {
          workbookRow: 7,
          rowKey: "CARGO-A / 1",
          valuesByHeader: {
            备货单号: "CARGO-FIXTURE-001",
            主备货单号: "CARGO-FIXTURE-001",
            数量合计: "10",
          },
        },
      ],
    ],
    [
      "11_装箱",
      [
        {
          workbookRow: 7,
          rowKey: "CONT-A / 1",
          valuesByHeader: {
            柜号: "CONT-FIXTURE-001",
            备货单号: "CARGO-FIXTURE-001",
            SKU: "SKU-FIXTURE-001",
            分提单: "HBL-FIXTURE-001",
            装载数量: "10",
            毛重kg: "1",
            "体积m³": "1",
          },
        },
      ],
    ],
    [
      "11a_出口报关",
      [
        {
          workbookRow: 7,
          rowKey: "HBL-A / 1",
          valuesByHeader: {
            层级: "报关票",
            报关发票号: "INVOICE-FIXTURE-001",
            分提单: "HBL-FIXTURE-001",
            报关单号: "DECLARATION-FIXTURE-001",
            报关金额: "10.00",
            币种: "USD",
          },
        },
      ],
    ],
    [
      "12_出运",
      [
        {
          workbookRow: 7,
          rowKey: "CONT-A / 1",
          valuesByHeader: {
            柜号: "CONT-FIXTURE-001",
            船名: "VESSEL-FIXTURE",
            航次: "VOYAGE-FIXTURE",
            MBL: "MBL-FIXTURE-001",
            HBL: "HBL-FIXTURE-001",
            进港日期: "2026-01-01",
            "ATD/出运日期": "2026-01-02",
            日期精度: "date",
          },
        },
      ],
    ],
    [
      "23_待确认",
      [{ workbookRow: 7, valuesByHeader: { 引用: "P-FIXTURE-001" } }],
    ],
    [
      "25_推导依据",
      [
        {
          workbookRow: 7,
          valuesByHeader: {
            编号: "DERIVE-FIXTURE-001",
            性质: "推导",
            "支撑的样本表/字段": "12_出运/航次",
          },
        },
      ],
    ],
    [
      "26_样本构建清单",
      [
        {
          workbookRow: 7,
          valuesByHeader: {
            工作表: "09_出运计划",
            行: "PLAN-A / 1",
            字段: "订舱号/SO",
            值: "BOOK-FIXTURE-001",
            构建依据: "constructed-fixture",
          },
        },
      ],
    ],
  ]);
  return {
    sourceAlias: "v05-like-fixture",
    workbookVersion: "fixture-v05",
    sheets: sheetNames.map((name) => ({
      name,
      headerRow: 6,
      headers: [],
      rows: rows.get(name) ?? [],
    })),
  };
}
