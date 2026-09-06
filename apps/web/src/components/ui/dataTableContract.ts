import {
  formatDisplayFieldValue,
  type DisplayFieldDefinition,
  type DisplayFieldType,
} from "./displayFieldContract";

export type DataTableTone = "ok" | "warn" | "risk" | "info" | "muted";
export type DataTableCellKind =
  DisplayFieldType | "entity" | "status" | "risk" | "action";
export type DataTableSortDirection = "asc" | "desc";
export type DataTableProcessingMode = "client" | "server";

export interface DataTableStatusValue {
  readonly code: string;
  readonly label: string;
  readonly tone: DataTableTone;
  readonly changedAt?: string;
}

export interface DataTableRiskValue {
  readonly label: string;
  readonly tone: DataTableTone;
  readonly detail?: string;
}

export interface DataTableEntityValue {
  readonly primary: string;
  readonly supportingValues?: readonly string[];
  readonly context?: string;
}

export interface DataTableColumnDefinition {
  readonly code: string;
  readonly label: string;
  readonly kind: DataTableCellKind;
  readonly order: number;
  readonly width: number;
  readonly description?: string;
  readonly emptyLabel?: string;
  readonly unit?: string;
  readonly timeZone?: string;
  readonly searchable?: boolean;
  readonly sortable?: boolean;
  readonly hideable?: boolean;
  readonly pinned?: "left" | "right";
  readonly rowAction?: "open";
  readonly queryKey?: string;
  readonly dividerBefore?: boolean;
}

export interface DataTableQuickFilter {
  readonly code: string;
  readonly label: string;
  readonly matchAll?: boolean;
}

export interface DataTableSchema {
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly label: string;
  readonly searchPlaceholder?: string;
  readonly rowLabelColumnCode: string;
  readonly columns: readonly DataTableColumnDefinition[];
  readonly quickFilters?: readonly DataTableQuickFilter[];
  readonly defaultSort?: DataTableSort;
}

export interface DataTableRow {
  readonly rowId: string;
  readonly tone?: DataTableTone;
  readonly filterKeys?: readonly string[];
  readonly values: Readonly<Record<string, unknown>>;
}

export interface DataTablePageInfo {
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

export interface DataTableProjection {
  readonly schema: DataTableSchema;
  readonly rows: readonly DataTableRow[];
  readonly pageInfo: DataTablePageInfo;
}

export interface DataTableSort {
  readonly columnCode: string;
  readonly direction: DataTableSortDirection;
}

export interface ResolvedDataTableCell {
  readonly displayValue: string;
  readonly valueState: "valid" | "empty" | "invalid";
  readonly tone?: DataTableTone;
  readonly detail?: string;
  readonly supportingValues?: readonly string[];
  readonly context?: string;
  readonly code?: string;
}

export interface DataTableResolution {
  readonly columns: readonly DataTableColumnDefinition[];
  readonly rows: readonly DataTableRow[];
  readonly issues: readonly string[];
}

const codePattern = /^[a-z][A-Za-z0-9]*$/;
const queryKeyPattern = /^[a-z][A-Za-z0-9_-]*$/;
const tones = new Set<DataTableTone>(["ok", "warn", "risk", "info", "muted"]);
const cellKinds = new Set<DataTableCellKind>([
  "text",
  "identifier",
  "date",
  "datetime",
  "number",
  "decimal",
  "currency",
  "boolean",
  "entity",
  "status",
  "risk",
  "action",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const isDataTableStatusValue = (
  value: unknown,
): value is DataTableStatusValue =>
  isRecord(value) &&
  typeof value.code === "string" &&
  typeof value.label === "string" &&
  typeof value.tone === "string" &&
  tones.has(value.tone as DataTableTone) &&
  (value.changedAt === undefined || typeof value.changedAt === "string");

export const isDataTableRiskValue = (
  value: unknown,
): value is DataTableRiskValue =>
  isRecord(value) &&
  typeof value.label === "string" &&
  typeof value.tone === "string" &&
  tones.has(value.tone as DataTableTone) &&
  (value.detail === undefined || typeof value.detail === "string");

export const isDataTableEntityValue = (
  value: unknown,
): value is DataTableEntityValue =>
  isRecord(value) &&
  typeof value.primary === "string" &&
  value.primary.trim().length > 0 &&
  (value.supportingValues === undefined ||
    (Array.isArray(value.supportingValues) &&
      value.supportingValues.length <= 3 &&
      value.supportingValues.every((item) => typeof item === "string"))) &&
  (value.context === undefined || typeof value.context === "string");

export const resolveDataTableProjection = (
  projection: DataTableProjection,
): DataTableResolution => {
  try {
    const { schema, rows, pageInfo } = projection;
    const issues: string[] = [];
    const columnCodes = new Set<string>();
    const rowIds = new Set<string>();
    const filterCodes = new Set<string>();

    if (!schema.schemaId.trim()) issues.push("缺少 schemaId");
    if (!Number.isInteger(schema.schemaVersion) || schema.schemaVersion < 1)
      issues.push("schemaVersion 无效");
    if (!schema.label.trim()) issues.push("缺少表格名称");

    schema.columns.forEach((column) => {
      if (!codePattern.test(column.code))
        issues.push(`列码无效: ${column.code}`);
      if (columnCodes.has(column.code)) issues.push(`列码重复: ${column.code}`);
      if (!column.label.trim()) issues.push(`列名为空: ${column.code}`);
      if (!cellKinds.has(column.kind))
        issues.push(`列渲染类型不支持: ${column.code}`);
      if (!Number.isFinite(column.order))
        issues.push(`列顺序无效: ${column.code}`);
      if (
        !Number.isFinite(column.width) ||
        column.width < 44 ||
        column.width > 480
      )
        issues.push(`列宽无效: ${column.code}`);
      if (column.queryKey && !queryKeyPattern.test(column.queryKey))
        issues.push(`筛选参数无效: ${column.code}`);
      if (column.kind === "action" && column.rowAction !== "open")
        issues.push(`操作列缺少受控动作: ${column.code}`);
      if (
        column.dividerBefore !== undefined &&
        typeof column.dividerBefore !== "boolean"
      )
        issues.push(`分组边界无效: ${column.code}`);
      columnCodes.add(column.code);
    });

    if (!columnCodes.has(schema.rowLabelColumnCode))
      issues.push("行标签列不存在");

    if (schema.defaultSort) {
      const sortColumn = schema.columns.find(
        (column) => column.code === schema.defaultSort?.columnCode,
      );
      if (!sortColumn || !sortColumn.sortable)
        issues.push("默认排序列不存在或不可排序");
      if (!(["asc", "desc"] as const).includes(schema.defaultSort.direction))
        issues.push("默认排序方向无效");
    }

    schema.quickFilters?.forEach((filter) => {
      if (!codePattern.test(filter.code))
        issues.push(`快速筛选码无效: ${filter.code}`);
      if (filterCodes.has(filter.code))
        issues.push(`快速筛选码重复: ${filter.code}`);
      if (!filter.label.trim()) issues.push(`快速筛选名称为空: ${filter.code}`);
      filterCodes.add(filter.code);
    });
    if (
      (schema.quickFilters?.filter((filter) => filter.matchAll).length ?? 0) > 1
    )
      issues.push("只能配置一个全量筛选");

    rows.forEach((row) => {
      if (!row.rowId.trim()) issues.push("存在空行 ID");
      if (rowIds.has(row.rowId)) issues.push(`行 ID 重复: ${row.rowId}`);
      if (!isRecord(row.values)) issues.push(`行值结构无效: ${row.rowId}`);
      if (row.tone && !tones.has(row.tone))
        issues.push(`行语义色无效: ${row.rowId}`);
      rowIds.add(row.rowId);
    });

    if (
      !Number.isInteger(pageInfo.total) ||
      pageInfo.total < 0 ||
      !Number.isInteger(pageInfo.offset) ||
      pageInfo.offset < 0 ||
      !Number.isInteger(pageInfo.limit) ||
      pageInfo.limit < 1
    )
      issues.push("分页信息无效");

    if (issues.length) return { columns: [], rows: [], issues };
    return {
      columns: schema.columns
        .slice()
        .sort((left, right) => left.order - right.order),
      rows,
      issues: [],
    };
  } catch {
    return { columns: [], rows: [], issues: ["表格投影结构无效"] };
  }
};

export const resolveDataTableCell = (
  column: DataTableColumnDefinition,
  value: unknown,
  locale = "zh-CN",
): ResolvedDataTableCell => {
  if (column.kind === "action") {
    return { displayValue: column.label, valueState: "valid" };
  }
  if (column.kind === "entity") {
    if (!isDataTableEntityValue(value)) {
      return { displayValue: "格式错误", valueState: "invalid" };
    }
    return {
      displayValue: value.primary,
      valueState: "valid",
      supportingValues: value.supportingValues,
      context: value.context,
    };
  }
  if (column.kind === "status") {
    if (!isDataTableStatusValue(value)) {
      return { displayValue: "格式错误", valueState: "invalid" };
    }
    return {
      displayValue: value.label,
      valueState: "valid",
      tone: value.tone,
      detail: value.changedAt,
      code: value.code,
    };
  }
  if (column.kind === "risk") {
    if (!isDataTableRiskValue(value)) {
      return { displayValue: "格式错误", valueState: "invalid" };
    }
    return {
      displayValue: value.label,
      valueState: "valid",
      tone: value.tone,
      detail: value.detail,
    };
  }

  const field: DisplayFieldDefinition = {
    code: column.code,
    label: column.label,
    groupCode: "table",
    type: column.kind,
    order: column.order,
    emptyLabel: column.emptyLabel,
    unit: column.unit,
    timeZone: column.timeZone,
  };
  return formatDisplayFieldValue(field, value, locale);
};

const comparableCellValue = (
  column: DataTableColumnDefinition,
  row: DataTableRow,
) => {
  const resolved = resolveDataTableCell(column, row.values[column.code]);
  return [
    resolved.code,
    resolved.displayValue,
    ...(resolved.supportingValues ?? []),
    resolved.context,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("zh-CN");
};

export const queryDataTableRows = (options: {
  rows: readonly DataTableRow[];
  columns: readonly DataTableColumnDefinition[];
  query: string;
  filterCode?: string;
  matchAllFilterCode?: string;
  externalFilters?: Readonly<Record<string, string>>;
  sort?: DataTableSort;
}) => {
  const normalizedQuery = options.query.trim().toLocaleLowerCase("zh-CN");
  const searchableColumns = options.columns.filter(
    (column) => column.searchable,
  );
  const filterColumns = new Map(
    options.columns.map((column) => [column.code, column]),
  );
  const filtered = options.rows.filter((row) => {
    const matchesQuery =
      !normalizedQuery ||
      searchableColumns.some((column) =>
        comparableCellValue(column, row).includes(normalizedQuery),
      );
    const matchesQuickFilter =
      !options.filterCode ||
      options.filterCode === options.matchAllFilterCode ||
      row.filterKeys?.includes(options.filterCode);
    const matchesExternalFilters = Object.entries(
      options.externalFilters ?? {},
    ).every(([columnCode, expected]) => {
      const column = filterColumns.get(columnCode);
      return column
        ? comparableCellValue(column, row) === expected.toLocaleLowerCase()
        : false;
    });
    return matchesQuery && matchesQuickFilter && matchesExternalFilters;
  });

  if (!options.sort) return filtered;
  const sortColumn = options.columns.find(
    (column) =>
      column.code === options.sort?.columnCode && column.sortable === true,
  );
  if (!sortColumn) return filtered;
  const direction = options.sort.direction === "asc" ? 1 : -1;
  return filtered.slice().sort((left, right) => {
    const result = comparableCellValue(sortColumn, left).localeCompare(
      comparableCellValue(sortColumn, right),
      "zh-CN",
      { numeric: true },
    );
    return result * direction || left.rowId.localeCompare(right.rowId);
  });
};

export const extractDataTableRouteFilters = (
  schema: DataTableSchema,
  query: Readonly<Record<string, unknown>>,
) =>
  Object.fromEntries(
    schema.columns.flatMap((column) => {
      if (!column.queryKey) return [];
      const value = query[column.queryKey];
      return typeof value === "string" && value
        ? [[column.code, value] as const]
        : [];
    }),
  );
