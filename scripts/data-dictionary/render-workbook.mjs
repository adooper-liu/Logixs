import { createRequire } from "node:module";
import { resolve } from "node:path";

const requireFromApi = createRequire(resolve("apps/api/package.json"));
const ExcelJS = requireFromApi("exceljs");
const requireFromExcel = createRequire(
  requireFromApi.resolve("exceljs/package.json"),
);
const JSZip = requireFromExcel("jszip");

const SHEETS = [
  "00_使用说明",
  "01_模块汇总",
  "02_表清单",
  "03_字段清单",
  "04_关系清单",
  "05_约束索引",
  "06_枚举代码",
  "07_原生对象",
  "08_待业务确认",
  "09_来源追溯",
];

export async function renderWorkbook(
  model,
  { fixedDate = new Date("2000-01-01T00:00:00.000Z") } = {},
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Logixs data dictionary generator";
  workbook.created = fixedDate;
  workbook.modified = fixedDate;
  workbook.calcProperties.fullCalcOnLoad = false;

  const instructions = addSheet(
    workbook,
    SHEETS[0],
    ["项目", "值"],
    [
      ["生成器", "scripts/generate-data-dictionary.mjs"],
      ["基线提交", model.provenance.baselineCommit ?? "unknown"],
      ["验证迁移", model.provenance.verifiedThroughMigration ?? "unknown"],
      ["表数", model.statistics.databaseTables],
      ["物理字段数", model.statistics.databaseColumns],
      ["待确认表", model.statistics.pendingTables],
      ["待确认字段", model.statistics.pendingFields],
      [
        "状态说明",
        "confirmed_business / confirmed_contract / confirmed_implementation / needs_business_confirmation",
      ],
      ["回写规则", "Excel 仅供批注；采纳意见须回写仓库注解后重新生成"],
    ],
  );
  instructions.getColumn(2).width = 90;

  const modules = moduleRows(model);
  addSheet(
    workbook,
    SHEETS[1],
    ["技术所有者", "表数", "字段数", "待确认表", "待确认字段"],
    modules,
  );
  addSheet(
    workbook,
    SHEETS[2],
    [
      "稳定键",
      "数据库表",
      "Prisma Model",
      "中文名",
      "用途说明",
      "名称状态",
      "用途状态",
      "技术所有者",
      "工作台",
      "敏感等级",
      "来源",
      "备注",
    ],
    model.tables.map((item) => [
      item.key,
      item.tableName,
      item.prismaModel,
      item.nameZh,
      item.purposeZh,
      item.nameStatus,
      item.purposeStatus,
      item.ownerModule,
      item.workbenchCodes,
      item.sensitivityClass,
      item.sourceRefs,
      item.notes,
    ]),
  );
  addSheet(
    workbook,
    SHEETS[3],
    [
      "稳定键",
      "数据库表",
      "数据库字段",
      "Prisma Model",
      "Prisma 属性",
      "Prisma 类型",
      "PostgreSQL 类型",
      "是否必填",
      "默认值",
      "Identity",
      "Generated",
      "中文名",
      "用途说明",
      "名称状态",
      "用途状态",
      "技术所有者",
      "工作台",
      "敏感等级",
      "来源",
      "建议中文名",
      "建议用途",
      "确认意见",
      "备注",
      "确认人",
      "确认日期",
    ],
    model.fields.map((item) => [
      item.key,
      item.tableName,
      item.columnName,
      item.prismaModel,
      item.prismaField,
      item.prismaType,
      item.formattedType,
      item.isNullable ? "否" : "是",
      item.defaultExpression,
      item.identityKind,
      item.generatedKind,
      item.nameZh,
      item.purposeZh,
      item.nameStatus,
      item.purposeStatus,
      item.ownerModule,
      item.workbenchCodes,
      item.sensitivityClass,
      item.sourceRefs,
      "",
      "",
      "",
      item.notes,
      "",
      "",
    ]),
  );
  addSheet(
    workbook,
    SHEETS[4],
    [
      "关系类型",
      "来源表",
      "来源字段",
      "Prisma 属性",
      "目标表/模型",
      "目标字段",
      "关系名",
      "Prisma 已声明",
      "证据",
    ],
    model.relations.map((item) => [
      item.relationType,
      item.sourceTable,
      item.sourceFields,
      item.prismaField,
      item.targetTable,
      item.targetFields,
      item.name,
      item.prismaDeclared,
      item.relationType === "physical_fk"
        ? "PostgreSQL pg_catalog"
        : item.relationType === "prisma_relation"
          ? "Prisma DMMF"
          : "人工注解",
    ]),
  );
  addSheet(
    workbook,
    SHEETS[5],
    ["表", "名称", "类型", "Prisma 已声明", "唯一", "定义", "谓词"],
    model.constraintsAndIndexes.map((item) => [
      item.tableName,
      item.constraintName ?? item.indexName,
      item.type ?? "index",
      item.prismaDeclared,
      item.isUnique,
      item.definition,
      item.predicate,
    ]),
  );
  addSheet(
    workbook,
    SHEETS[6],
    ["来源类型", "代码集", "值", "顺序"],
    model.codeSets.flatMap((item) =>
      item.values.map((value, index) => [
        "postgres_enum",
        item.enumName,
        value,
        index + 1,
      ]),
    ),
  );
  addSheet(
    workbook,
    SHEETS[7],
    ["对象类型", "表", "名称", "约束触发器", "定义"],
    nativeRows(model),
  );
  addSheet(
    workbook,
    SHEETS[8],
    ["对象类型", "稳定键", "中文名", "用途说明", "名称状态", "用途状态"],
    [
      ...model.tables
        .filter(isPending)
        .map((item) => pendingRow("table", item)),
      ...model.fields
        .filter(isPending)
        .map((item) => pendingRow("field", item)),
    ],
  );
  addSheet(
    workbook,
    SHEETS[9],
    ["来源 ID", "路径", "权威级别", "说明", "消费对象数"],
    Object.entries(model.sources).map(([id, source]) => [
      id,
      source.path,
      source.authority,
      source.note,
      sourceConsumerCount(model, id),
    ]),
  );

  return canonicalizeWorkbook(
    Buffer.from(await workbook.xlsx.writeBuffer()),
    fixedDate,
  );
}

async function canonicalizeWorkbook(buffer, fixedDate) {
  const source = await JSZip.loadAsync(buffer);
  const target = new JSZip();
  for (const path of Object.keys(source.files).sort()) {
    const entry = source.files[path];
    if (entry.dir) {
      target.folder(path.replace(/\/$/u, ""));
      target.files[path].date = fixedDate;
      continue;
    }
    target.file(path, await entry.async("nodebuffer"), {
      binary: true,
      date: fixedDate,
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });
  }
  return target.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "DOS",
  });
}

function addSheet(workbook, name, headers, rows) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 18 },
  });
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row.map(cellValue));
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: headers.length },
  };
  sheet.addTable({
    name: `DictionaryTable${String(workbook.worksheets.length).padStart(2, "0")}`,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: headers.map((header) => ({ name: header, filterButton: true })),
    rows: rows.map((row) => row.map(cellValue)),
  });
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", wrapText: true };
  sheet.columns.forEach((column, index) => {
    column.width = Math.min(
      60,
      Math.max(12, String(headers[index]).length * 2 + 4),
    );
    column.alignment = { vertical: "top", wrapText: true };
  });
  sheet.eachRow((row) => {
    row.height = Math.min(72, row.height ?? 18);
  });
  return sheet;
}

function cellValue(value) {
  const normalized = Array.isArray(value)
    ? value.join(", ")
    : value === null || value === undefined
      ? ""
      : value;
  if (typeof normalized === "string" && /^[=+\-@]/u.test(normalized)) {
    return `'${normalized}`;
  }
  return normalized;
}

function moduleRows(model) {
  const modules = new Map();
  for (const table of model.tables) {
    const key = table.ownerModule ?? "待确认";
    const item = modules.get(key) ?? {
      tables: 0,
      fields: 0,
      pendingTables: 0,
      pendingFields: 0,
    };
    item.tables += 1;
    if (isPending(table)) item.pendingTables += 1;
    modules.set(key, item);
  }
  for (const field of model.fields) {
    const key = field.ownerModule ?? "待确认";
    const item = modules.get(key) ?? {
      tables: 0,
      fields: 0,
      pendingTables: 0,
      pendingFields: 0,
    };
    item.fields += 1;
    if (isPending(field)) item.pendingFields += 1;
    modules.set(key, item);
  }
  return [...modules.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
    .map(([owner, item]) => [
      owner,
      item.tables,
      item.fields,
      item.pendingTables,
      item.pendingFields,
    ]);
}

function nativeRows(model) {
  return [
    ...model.constraintsAndIndexes
      .filter((item) => item.prismaDeclared === false)
      .map((item) => [
        item.type ?? "index",
        item.tableName,
        item.constraintName ?? item.indexName,
        "",
        item.definition ?? item.predicate,
      ]),
    ...model.nativeObjects.functions.map((item) => [
      "function",
      "",
      item.functionName,
      "",
      item.definition,
    ]),
    ...model.nativeObjects.triggers.map((item) => [
      "trigger",
      item.tableName,
      item.triggerName,
      item.isConstraintTrigger ? "是" : "否",
      item.definition,
    ]),
  ];
}

function isPending(item) {
  return (
    item.nameStatus === "needs_business_confirmation" ||
    item.purposeStatus === "needs_business_confirmation"
  );
}

function pendingRow(type, item) {
  return [
    type,
    item.key,
    item.nameZh,
    item.purposeZh,
    item.nameStatus,
    item.purposeStatus,
  ];
}

function sourceConsumerCount(model, sourceId) {
  return [...model.tables, ...model.fields].filter((item) =>
    item.sourceRefs.includes(sourceId),
  ).length;
}
