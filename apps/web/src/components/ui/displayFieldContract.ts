export type DisplayFieldType =
  | "text"
  | "identifier"
  | "date"
  | "datetime"
  | "number"
  | "decimal"
  | "currency"
  | "boolean";

export type DisplayFieldPriority = "primary" | "secondary";
export type DisplayFieldSpan = 1 | 2 | 3 | 4;

export interface DisplayFieldGroup {
  readonly code: string;
  readonly label: string;
  readonly order: number;
}

export interface DisplayFieldDefinition {
  readonly code: string;
  readonly label: string;
  readonly groupCode: string;
  readonly type: DisplayFieldType;
  readonly order: number;
  readonly priority?: DisplayFieldPriority;
  readonly span?: DisplayFieldSpan;
  readonly emptyLabel?: string;
  readonly unit?: string;
  readonly description?: string;
  readonly timeZone?: string;
}

export interface DisplayFieldSchema {
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly groups: readonly DisplayFieldGroup[];
  readonly fields: readonly DisplayFieldDefinition[];
}

export interface DisplayMoneyValue {
  amount: string;
  currency: string;
}

export interface DisplayFieldSet {
  readonly schema: DisplayFieldSchema;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface ResolvedDisplayField extends DisplayFieldDefinition {
  displayValue: string;
  valueState: "valid" | "empty" | "invalid";
}

export interface ResolvedDisplayFieldGroup extends DisplayFieldGroup {
  primaryFields: ResolvedDisplayField[];
  secondaryFields: ResolvedDisplayField[];
}

export interface DisplayFieldResolution {
  groups: ResolvedDisplayFieldGroup[];
  issues: string[];
}

const supportedTypes = new Set<DisplayFieldType>([
  "text",
  "identifier",
  "date",
  "datetime",
  "number",
  "decimal",
  "currency",
  "boolean",
]);
const fieldCodePattern = /^[a-z][A-Za-z0-9]*$/;
const decimalPattern = /^-?\d+(?:\.\d+)?$/;
const currencyPattern = /^[A-Z]{3}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const isValidDate = (value: string) => {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const formatDecimal = (value: string) => {
  const sign = value.startsWith("-") ? "-" : "";
  const unsigned = sign ? value.slice(1) : value;
  const [integer, fraction] = unsigned.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${fraction === undefined ? "" : `.${fraction}`}`;
};

const asDecimal = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && decimalPattern.test(value)) return value;
  return undefined;
};

const isMoney = (value: unknown): value is DisplayMoneyValue => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DisplayMoneyValue>;
  return (
    typeof candidate.amount === "string" &&
    decimalPattern.test(candidate.amount) &&
    typeof candidate.currency === "string" &&
    currencyPattern.test(candidate.currency)
  );
};

const withUnit = (value: string, unit?: string) =>
  unit ? `${value} ${unit}` : value;

const invalidValue = () => ({
  displayValue: "格式错误",
  valueState: "invalid" as const,
});

export const formatDisplayFieldValue = (
  field: DisplayFieldDefinition,
  value: unknown,
  locale = "zh-CN",
): Pick<ResolvedDisplayField, "displayValue" | "valueState"> => {
  if (value === null || value === undefined || value === "") {
    return {
      displayValue: field.emptyLabel ?? "未提供",
      valueState: "empty",
    };
  }

  if (field.type === "text" || field.type === "identifier") {
    if (typeof value !== "string" && typeof value !== "number")
      return invalidValue();
    return { displayValue: String(value), valueState: "valid" };
  }

  if (field.type === "boolean") {
    if (typeof value !== "boolean") return invalidValue();
    return { displayValue: value ? "是" : "否", valueState: "valid" };
  }

  if (field.type === "currency") {
    if (!isMoney(value)) return invalidValue();
    return {
      displayValue: `${value.currency} ${formatDecimal(value.amount)}`,
      valueState: "valid",
    };
  }

  if (field.type === "number" || field.type === "decimal") {
    const decimal = asDecimal(value);
    if (!decimal) return invalidValue();
    return {
      displayValue: withUnit(formatDecimal(decimal), field.unit),
      valueState: "valid",
    };
  }

  if (field.type === "date") {
    if (typeof value !== "string" || !isValidDate(value)) return invalidValue();
    return { displayValue: value, valueState: "valid" };
  }

  if (typeof value !== "string" || !dateTimePattern.test(value))
    return invalidValue();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return invalidValue();
  try {
    return {
      displayValue: new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: field.timeZone,
      }).format(date),
      valueState: "valid",
    };
  } catch {
    return invalidValue();
  }
};

export const createDisplayFieldSet = (
  schema: DisplayFieldSchema,
  source: object,
): DisplayFieldSet => {
  const record = source as Record<string, unknown>;
  const values = Object.fromEntries(
    schema.fields.map((field) => [
      field.code,
      Object.prototype.hasOwnProperty.call(record, field.code)
        ? record[field.code]
        : undefined,
    ]),
  );
  return { schema, values };
};

export const resolveDisplayFieldSet = (
  fieldSet: DisplayFieldSet,
  locale = "zh-CN",
): DisplayFieldResolution => {
  try {
    const { schema, values } = fieldSet;
    const issues: string[] = [];
    const groupCodes = new Set<string>();
    const fieldCodes = new Set<string>();

    if (!schema.schemaId.trim()) issues.push("缺少 schemaId");
    if (!Number.isInteger(schema.schemaVersion) || schema.schemaVersion < 1)
      issues.push("schemaVersion 无效");
    if (!values || typeof values !== "object" || Array.isArray(values))
      issues.push("字段值结构无效");

    schema.groups.forEach((group) => {
      if (!fieldCodePattern.test(group.code))
        issues.push(`分组码无效: ${group.code}`);
      if (groupCodes.has(group.code)) issues.push(`分组码重复: ${group.code}`);
      if (!group.label.trim()) issues.push(`分组名称为空: ${group.code}`);
      if (!Number.isFinite(group.order))
        issues.push(`分组顺序无效: ${group.code}`);
      groupCodes.add(group.code);
    });

    schema.fields.forEach((field) => {
      if (!fieldCodePattern.test(field.code))
        issues.push(`字段码无效: ${field.code}`);
      if (fieldCodes.has(field.code)) issues.push(`字段码重复: ${field.code}`);
      if (!field.label.trim()) issues.push(`字段名称为空: ${field.code}`);
      if (!Number.isFinite(field.order))
        issues.push(`字段顺序无效: ${field.code}`);
      if (!groupCodes.has(field.groupCode))
        issues.push(`字段分组不存在: ${field.code}`);
      if (!supportedTypes.has(field.type))
        issues.push(`字段类型不支持: ${field.code}`);
      if (
        field.priority !== undefined &&
        field.priority !== "primary" &&
        field.priority !== "secondary"
      )
        issues.push(`字段优先级无效: ${field.code}`);
      if (field.span !== undefined && ![1, 2, 3, 4].includes(field.span))
        issues.push(`字段跨度无效: ${field.code}`);
      fieldCodes.add(field.code);
    });

    if (issues.length) return { groups: [], issues };

    const fieldsByGroup = new Map<string, ResolvedDisplayField[]>();
    schema.fields
      .slice()
      .sort((left, right) => left.order - right.order)
      .forEach((field) => {
        const fields = fieldsByGroup.get(field.groupCode) ?? [];
        fields.push({
          ...field,
          ...formatDisplayFieldValue(field, values[field.code], locale),
        });
        fieldsByGroup.set(field.groupCode, fields);
      });

    const groups = schema.groups
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((group) => {
        const fields = fieldsByGroup.get(group.code) ?? [];
        return {
          ...group,
          primaryFields: fields.filter(
            (field) => (field.priority ?? "primary") === "primary",
          ),
          secondaryFields: fields.filter(
            (field) => field.priority === "secondary",
          ),
        };
      })
      .filter(
        (group) => group.primaryFields.length || group.secondaryFields.length,
      );

    return { groups, issues };
  } catch {
    return { groups: [], issues: ["字段配置结构无效"] };
  }
};
