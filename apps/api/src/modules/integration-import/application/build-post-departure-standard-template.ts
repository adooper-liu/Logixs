import ExcelJS from "exceljs";
import standardImportCatalog from "@logix/contracts/post-departure-standard-import.json";
import type { ReferenceLocationCatalogSnapshot } from "../../master-data";

const GREEN = "1F5D50";
const WHITE = "FFFFFF";
const LIGHT = "E8F1EE";

export async function buildPostDepartureStandardTemplate(
  referenceLocations: ReferenceLocationCatalogSnapshot,
): Promise<Buffer> {
  if (
    referenceLocations.countries.length === 0 ||
    referenceLocations.ports.length === 0
  ) {
    throw new Error("REFERENCE_LOCATION_CATALOG_EMPTY");
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Logix";
  workbook.title = "已出运标准导入模板 V1";
  workbook.subject = `profile=${standardImportCatalog.profile};version=${standardImportCatalog.version}`;
  workbook.created = new Date("2026-09-25T00:00:00.000Z");
  workbook.modified = workbook.created;
  addInstructions(workbook);
  standardImportCatalog.sheets.forEach((definition) =>
    addDataSheet(workbook, definition),
  );
  addControlledValues(workbook);
  addReferenceCodeDictionary(workbook, referenceLocations);
  addRealExample(workbook);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function addInstructions(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet("填写说明", {
    views: [{ showGridLines: false }],
  });
  sheet.columns = [{ width: 22 }, { width: 29 }, { width: 50 }, { width: 28 }];
  sheet.mergeCells("A1:D1");
  sheet.getCell("A1").value = "已出运标准导入模板 V1";
  sheet.getCell("A1").font = {
    bold: true,
    size: 18,
    color: { argb: WHITE },
  };
  sheet.getCell("A1").fill = fill(GREEN);
  sheet.getRow(1).height = 34;
  sheet.getRow(3).values = [
    "模板版本",
    standardImportCatalog.version,
    "解析配置",
    standardImportCatalog.profile,
  ];
  styleCells(sheet, 3, 1, 3, 4, { fill: fill(LIGHT), font: { bold: true } });
  sheet.getRow(5).values = ["工作表", "一行代表", "何时填写", "是否可空"];
  styleHeader(sheet, 5, 4);
  setRows(sheet, 6, [
    ["已出运接管", "Shipment 中的一只柜", "确认已出运后", "至少一行"],
    [
      "SKU装载明细",
      "该柜中的一个备货单 SKU",
      "明细可取得时",
      "可整页为空，接管后补",
    ],
    [
      "代码字典",
      "权威国家码与港口码",
      "填写销往国家、起运港和目的港时",
      "从下拉选项选择",
    ],
  ]);
  setRows(sheet, 10, [
    [
      "操作顺序",
      "1. 填写已出运接管",
      "2. 有 SKU 则填写明细",
      "3. 上传、预检并接管",
    ],
    [
      "允许后补",
      "港口、离港、提单、船期、SKU",
      "缺失继续形成待补",
      "不阻止无关工作",
    ],
    [
      "会被阻断",
      "缺出运业务号或柜号",
      "非法标准码、数量或引用",
      "同柜活动 Shipment 冲突",
    ],
  ]);
  styleCells(sheet, 10, 1, 12, 1, {
    font: { bold: true, color: { argb: GREEN } },
  });
  styleCells(sheet, 10, 1, 12, 4, {
    alignment: { vertical: "top", wrapText: true },
  });
  sheet.mergeCells("A14:D14");
  sheet.getCell("A14").value =
    "不要修改工作表名称和第一行表头；不要填写数据库 UUID；销往国家与货主名称必须分开。国家和港口下拉同时显示代码、中文名称和官方英文名，上传时系统只保存标准代码。";
  sheet.getCell("A14").fill = fill("FFF2CC");
  sheet.getCell("A14").font = { bold: true, color: { argb: "7A4E00" } };
  sheet.getCell("A14").alignment = { wrapText: true };
  sheet.getRow(14).height = 32;
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  definition: (typeof standardImportCatalog.sheets)[number],
): void {
  const sheet = workbook.addWorksheet(definition.name, {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  sheet.getRow(1).values = definition.fields.map(({ label }) => label);
  styleHeader(sheet, 1, definition.fields.length);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: definition.fields.length },
  };
  definition.fields.forEach((field, index) => {
    const column = sheet.getColumn(index + 1);
    column.width = Math.min(
      34,
      Math.max(14, field.label.length * 2, field.example.length + 2),
    );
    column.alignment = { vertical: "top" };
    sheet.getCell(1, index + 1).fill = fill(
      field.required ? "B42318" : field.pendingWhenMissing ? "9A6700" : GREEN,
    );
    if (field.code === "departure_time_precision") {
      addListValidation(sheet, index + 1, "date_only,date_time");
    }
    if (field.code === "quantity_unit") {
      addListValidation(sheet, index + 1, "piece,carton,set,pallet");
    }
    if (field.code === "sales_country_code") {
      addNamedListValidation(
        sheet,
        index + 1,
        "SalesCountryChoices",
        "销往国家",
      );
    }
    if (
      field.code === "origin_port_code" ||
      field.code === "destination_port_code"
    ) {
      addNamedListValidation(sheet, index + 1, "PortChoices", field.label);
    }
  });
}

function addControlledValues(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet("标准值", {
    views: [{ showGridLines: false }],
  });
  sheet.columns = [{ width: 24 }, { width: 30 }, { width: 60 }];
  sheet.getRow(1).values = ["字段", "允许值/标准", "说明"];
  styleHeader(sheet, 1, 3);
  setRows(sheet, 2, [
    ["离港时间精度", "date_only", "只有日期时使用；离港时间填当地 00:00:00"],
    ["离港时间精度", "date_time", "来源具有明确时分秒时使用"],
    ["数量单位", "piece / carton / set / pallet", "件 / 箱 / 套 / 托"],
    [
      "销往国家",
      "ISO 3166-1 alpha-2",
      "下拉显示代码、中文名和官方英文名；货主名称另列填写",
    ],
    [
      "起运港、目的港",
      "UN/LOCODE",
      "下拉显示代码、中文别名和官方英文名；未确认中文名会明确标注",
    ],
    ["时间", "ISO 8601 + UTC 偏移", "例如 2026-09-18T00:00:00+08:00"],
  ]);
  styleCells(sheet, 2, 1, 7, 3, {
    alignment: { vertical: "top", wrapText: true },
  });
  styleCells(sheet, 2, 1, 7, 1, {
    font: { bold: true, color: { argb: GREEN } },
  });
}

function addReferenceCodeDictionary(
  workbook: ExcelJS.Workbook,
  referenceLocations: ReferenceLocationCatalogSnapshot,
): void {
  const sheet = workbook.addWorksheet("代码字典", {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
  });
  sheet.columns = [
    { width: 52 },
    { width: 12 },
    { width: 22 },
    { width: 34 },
    { width: 4 },
    { width: 64 },
    { width: 12 },
    { width: 24 },
    { width: 38 },
    { width: 12 },
    { width: 20 },
    { width: 14 },
  ];
  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = "国家与港口权威代码字典";
  sheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: WHITE },
  };
  sheet.getCell("A1").fill = fill(GREEN);
  sheet.getRow(1).height = 30;
  sheet.getRow(2).values = [
    "ISO 发布版本",
    referenceLocations.countryReleaseVersion,
    "",
    "",
    "",
    "UN/LOCODE 发布版本",
    referenceLocations.portReleaseVersion,
  ];
  styleCells(sheet, 2, 1, 2, 12, {
    fill: fill(LIGHT),
    font: { bold: true },
  });
  sheet.getRow(4).values = [
    "销往国家下拉显示",
    "国家码",
    "中文名称",
    "官方英文名",
    "",
    "港口下拉显示",
    "港口码",
    "中文名称",
    "官方英文名",
    "国家/地区码",
    "所属国家中文名",
    "中文名状态",
  ];
  styleHeader(sheet, 4, 12);

  referenceLocations.countries.forEach((country, index) => {
    const row = index + 5;
    sheet.getCell(row, 1).value = countryChoice(country);
    sheet.getCell(row, 2).value = country.code;
    sheet.getCell(row, 3).value = country.nameChinese;
    sheet.getCell(row, 4).value = country.name;
  });
  referenceLocations.ports.forEach((port, index) => {
    const row = index + 5;
    sheet.getCell(row, 6).value = portChoice(port);
    sheet.getCell(row, 7).value = port.code;
    sheet.getCell(row, 8).value = port.nameChinese ?? "港口中文名待维护";
    sheet.getCell(row, 9).value = port.name;
    sheet.getCell(row, 10).value = port.countryCode;
    sheet.getCell(row, 11).value = port.countryNameChinese;
    sheet.getCell(row, 12).value = chineseNameStateLabel(port.nameChineseState);
  });
  const lastCountryRow = referenceLocations.countries.length + 4;
  const lastPortRow = referenceLocations.ports.length + 4;
  styleCells(sheet, 5, 1, lastCountryRow, 4, {
    alignment: { vertical: "top" },
  });
  styleCells(sheet, 5, 6, lastPortRow, 12, {
    alignment: { vertical: "top" },
  });
  workbook.definedNames.add(
    `'代码字典'!$A$5:$A$${lastCountryRow}`,
    "SalesCountryChoices",
  );
  workbook.definedNames.add(`'代码字典'!$F$5:$F$${lastPortRow}`, "PortChoices");
}

function countryChoice(
  country: ReferenceLocationCatalogSnapshot["countries"][number],
): string {
  return `${country.code} | ${country.nameChinese} | ${country.name}`;
}

function portChoice(
  port: ReferenceLocationCatalogSnapshot["ports"][number],
): string {
  const chineseDisplay = port.nameChinese
    ? `${port.nameChinese}${port.nameChineseState === "candidate" ? "（候选）" : ""}`
    : `${port.countryNameChinese}（港口中文名待维护）`;
  return `${port.code} | ${chineseDisplay} | ${port.name}`;
}

function chineseNameStateLabel(
  state: ReferenceLocationCatalogSnapshot["ports"][number]["nameChineseState"],
): string {
  if (state === "confirmed") return "已确认";
  if (state === "candidate") return "候选，待确认";
  return "待维护";
}

function addRealExample(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet("真实示例", {
    views: [{ showGridLines: false }],
  });
  const handoff = standardImportCatalog.sheets[0]!;
  const cargo = standardImportCatalog.sheets[1]!;
  sheet.getCell("A1").value = "真实样本填写示例（只供参考，不参与导入）";
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: GREEN } };
  writeExample(sheet, 3, handoff, {
    source_record_id: "real-sample:26DSC01812:HMMU4956442",
    shipment_number: "示例-SHP-20260918-01",
    container_number: "HMMU4956442",
    container_type_code: "40HQ",
    seal_number: "26H0407525",
    replenishment_order_number: "26DSC01812",
    booking_number: "SQSJ26090200041842",
    mbl_number: "NBOZ9FF56400",
    hbl_number: "NBOZ9FF56400C",
    carrier_code: "HMM",
    vessel_name: "YM MASCULINITY",
    voyage_number: "108E",
    origin_port_code: "CNNGB",
    destination_port_code: "CAVAN",
    sales_country_code: "CA",
    cargo_owner_name: "AOSOM CANADA INC.",
    departure_at: "2026-09-18T00:00:00+08:00",
    departure_time_precision: "date_only",
    departure_source_timezone: "Asia/Shanghai",
    estimated_arrival_at: "2026-10-08T00:00:00-07:00",
    package_count: 504,
    gross_weight_kg: 7723,
    volume_m3: 67.25,
  });
  writeExample(sheet, 7, cargo, {
    source_line_id: "BOM-26DSC01812-001",
    shipment_number: "示例-SHP-20260918-01",
    container_number: "HMMU4956442",
    replenishment_order_number: "26DSC01812",
    product_number: "331-015",
    quantity: 118,
    quantity_unit: "piece",
    package_count: 118,
    gross_weight_kg: 1404.2,
    volume_m3: 19.63,
  });
  const maxColumns = handoff.fields.length;
  for (let index = 1; index <= maxColumns; index += 1) {
    sheet.getColumn(index).width = 19;
  }
  sheet.mergeCells(11, 1, 11, maxColumns);
  sheet.getCell("A11").value =
    "示例 Shipment 业务号为演示标识；其余柜、备货单、提单、船名航次、日期、件重体和 SKU 值来自已核验真实样本。";
  sheet.getCell("A11").fill = fill(LIGHT);
  sheet.getCell("A11").alignment = { wrapText: true };
  sheet.getRow(11).height = 34;
}

function writeExample(
  sheet: ExcelJS.Worksheet,
  row: number,
  definition: (typeof standardImportCatalog.sheets)[number],
  values: Record<string, string | number>,
): void {
  sheet.getCell(row, 1).value = `${definition.name}示例`;
  sheet.getCell(row, 1).font = { bold: true };
  sheet.getRow(row + 1).values = definition.fields.map(({ label }) => label);
  styleHeader(sheet, row + 1, definition.fields.length);
  sheet.getRow(row + 2).values = definition.fields.map(
    ({ code }) => values[code] ?? "",
  );
  styleCells(sheet, row + 2, 1, row + 2, definition.fields.length, {
    fill: fill("F3F6F5"),
  });
}

function styleHeader(
  sheet: ExcelJS.Worksheet,
  row: number,
  columns: number,
): void {
  styleCells(sheet, row, 1, row, columns, {
    fill: fill(GREEN),
    font: { bold: true, color: { argb: WHITE } },
    alignment: { vertical: "middle", wrapText: true },
    border: { bottom: { style: "thin", color: { argb: "B7C8C2" } } },
  });
}

function setRows(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  values: Array<Array<string | number>>,
): void {
  values.forEach((row, index) => {
    sheet.getRow(startRow + index).values = row;
  });
}

function styleCells(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
  style: Partial<Pick<ExcelJS.Style, "fill" | "font" | "alignment" | "border">>,
): void {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet.getCell(row, column);
      if (style.fill) cell.fill = style.fill;
      if (style.font) cell.font = style.font;
      if (style.alignment) cell.alignment = style.alignment;
      if (style.border) cell.border = style.border;
    }
  }
}

function addListValidation(
  sheet: ExcelJS.Worksheet,
  column: number,
  values: string,
): void {
  for (let row = 2; row <= 1000; row += 1) {
    sheet.getCell(row, column).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${values}"`],
      showErrorMessage: true,
      errorTitle: "请选择标准值",
      error: `允许值：${values}`,
    };
  }
}

function addNamedListValidation(
  sheet: ExcelJS.Worksheet,
  column: number,
  definedName: string,
  fieldLabel: string,
): void {
  for (let row = 2; row <= 1000; row += 1) {
    sheet.getCell(row, column).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [definedName],
      showInputMessage: true,
      promptTitle: `选择${fieldLabel}`,
      prompt:
        "下拉同时显示标准代码、中文名称和官方英文名；暂时未知可留空，后续补齐。",
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "未从当前字典选择",
      error:
        "建议使用下拉选项；如需填写其他有效标准代码，可继续并由上传预检校验。",
    };
  }
}

function fill(color: string): ExcelJS.FillPattern {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
}
