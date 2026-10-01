import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { format } from "prettier";

import {
  EVIDENCE_SLOT_POLICIES,
  STATUS_AUTHORITY,
  evidencePoliciesFor,
  isPendingAnnotation,
  pendingEvidenceSlot,
} from "./data-dictionary/annotation-status.mjs";
import {
  renderDataDictionaryMarkdown,
  renderNativeObjectsMarkdown,
} from "./data-dictionary/render-markdown.mjs";
import { renderWorkbook } from "./data-dictionary/render-workbook.mjs";

export {
  renderDataDictionaryMarkdown,
  renderNativeObjectsMarkdown,
  renderWorkbook,
};

const require = createRequire(import.meta.url);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, "..");
const PRISMA_SCHEMA_PATH = resolve(REPOSITORY_ROOT, "database/schema.prisma");
const MIGRATIONS_PATH = resolve(REPOSITORY_ROOT, "database/migrations");
const GENERATED_CLIENT_PATH = resolve(REPOSITORY_ROOT, "generated/prisma");
const MIGRATION_RUNNER_PATH = resolve(
  REPOSITORY_ROOT,
  "scripts/migrate-deploy.mjs",
);
const OUTPUT_DIRECTORY = resolve(REPOSITORY_ROOT, "database/dictionary");
const ANNOTATIONS_PATH = resolve(
  OUTPUT_DIRECTORY,
  "dictionary.annotations.json",
);
const TEMPORARY_SCHEMA_PREFIX = "logix_dictionary_tmp_";
const DEFAULT_DATABASE_URL =
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function createTemporarySchemaName({
  pid = process.pid,
  randomId = randomUUID(),
} = {}) {
  const suffix = randomId.replaceAll("-", "").slice(0, 16).toLowerCase();
  return `${TEMPORARY_SCHEMA_PREFIX}${pid}_${suffix}`;
}

export function assertSafeExtractionTarget(databaseUrl, schemaName) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DICTIONARY_DATABASE_URL_INVALID");
  }

  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw new Error("DICTIONARY_DATABASE_NOT_POSTGRESQL");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("DICTIONARY_DATABASE_NOT_LOOPBACK");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (
    !databaseName ||
    /(^|[_-])(prod|production|live|staging)([_-]|$)/i.test(databaseName)
  ) {
    throw new Error("DICTIONARY_DATABASE_PRODUCTION_LIKE");
  }

  const safeSchemaPattern = new RegExp(
    `^${TEMPORARY_SCHEMA_PREFIX}[1-9][0-9]*_[a-f0-9]{16}$`,
  );
  if (!safeSchemaPattern.test(schemaName)) {
    throw new Error("DICTIONARY_SCHEMA_NOT_ISOLATED");
  }
}

export function parsePrismaDdl(sql) {
  const indexNames = new Set();
  const foreignKeys = [];
  const columns = [];
  const indexPattern =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+"((?:[^"]|"")+)"\s+ON\s+/giu;
  const foreignKeyPattern =
    /ALTER\s+TABLE\s+"((?:[^"]|"")+)"\s+ADD\s+CONSTRAINT\s+"((?:[^"]|"")+)"\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+"((?:[^"]|"")+)"\s*\(([^)]+)\)([^;]*);/giu;

  for (const match of sql.matchAll(indexPattern)) {
    indexNames.add(match[1].replaceAll('""', '"'));
  }
  for (const match of sql.matchAll(foreignKeyPattern)) {
    foreignKeys.push({
      tableName: unescapeIdentifier(match[1]),
      constraintName: unescapeIdentifier(match[2]),
      columnNames: parseIdentifierList(match[3]),
      referencedTableName: unescapeIdentifier(match[4]),
      referencedColumnNames: parseIdentifierList(match[5]),
      onDelete: parseReferentialAction(match[6], "DELETE"),
      onUpdate: parseReferentialAction(match[6], "UPDATE"),
    });
  }
  const tablePattern = /CREATE\s+TABLE\s+"([^"]+)"\s*\(([\s\S]*?)\n\s*\);/giu;
  for (const tableMatch of sql.matchAll(tablePattern)) {
    const tableName = unescapeIdentifier(tableMatch[1]);
    for (const line of tableMatch[2].split(/\r?\n/u)) {
      const columnMatch = line.match(/^\s*"([^"]+)"\s+(.+?)(?:,)?\s*$/u);
      if (!columnMatch || /^\s*CONSTRAINT\b/iu.test(line)) continue;
      const definition = columnMatch[2].replace(/,$/u, "");
      const typeMatch = definition.match(
        /^(.+?)(?=\s+(?:NOT\s+NULL|DEFAULT|PRIMARY\s+KEY|UNIQUE)\b|$)/iu,
      );
      const formattedType = typeMatch?.[1]?.trim();
      if (!formattedType) continue;
      const defaultExpression =
        definition
          .match(
            /\bDEFAULT\s+(.+?)(?=\s+(?:NOT\s+NULL|PRIMARY\s+KEY|UNIQUE)\b|$)/iu,
          )?.[1]
          ?.trim() ?? null;
      columns.push({
        tableName,
        columnName: unescapeIdentifier(columnMatch[1]),
        formattedType,
        isNullable: !/\bNOT\s+NULL\b/iu.test(definition),
        hasDefault: defaultExpression !== null,
        defaultExpression,
        isList: /\[\]$/u.test(formattedType),
      });
    }
  }

  return {
    indexNames,
    foreignKeys,
    columns: columns.sort(
      compareBy(
        (column) => column.tableName,
        (column) => column.columnName,
      ),
    ),
  };
}

export function buildNormalizedStructure({
  schemaName,
  verifiedThroughMigration,
  dmmf,
  catalog,
  prismaDdl,
}) {
  catalog = normalizeCatalogSchema(catalog, schemaName);
  const databaseTablesByName = new Map(
    catalog.tables.map((table) => [table.tableName, table]),
  );
  const databaseColumnsByTable = groupBy(
    catalog.columns,
    (column) => column.tableName,
  );
  const prismaColumnsByTable = groupBy(
    prismaDdl.columns ?? [],
    (column) => column.tableName,
  );
  const models = dmmf.datamodel.models
    .map((model) => {
      const databaseTable = model.dbName ?? model.name;
      const columnsByName = new Map(
        (databaseColumnsByTable.get(databaseTable) ?? []).map((column) => [
          column.columnName,
          column,
        ]),
      );
      return {
        prismaModel: model.name,
        databaseSchema: "public",
        databaseTable,
        fields: model.fields
          .filter((field) => field.kind !== "object")
          .map((field) => {
            const databaseColumn = field.dbName ?? field.name;
            const column = columnsByName.get(databaseColumn) ?? null;
            const prismaColumn = (
              prismaColumnsByTable.get(databaseTable) ?? []
            ).find((item) => item.columnName === databaseColumn);
            return {
              prismaField: field.name,
              prismaKind: field.kind,
              prismaType: field.type,
              prismaRequired:
                prismaColumn === undefined
                  ? (field.isRequired ?? null)
                  : !prismaColumn.isNullable,
              prismaList:
                prismaColumn === undefined
                  ? (field.isList ?? null)
                  : prismaColumn.isList,
              prismaHasDefault:
                prismaColumn === undefined
                  ? (field.hasDefaultValue ?? null)
                  : prismaColumn.hasDefault,
              prismaDefault:
                prismaColumn?.defaultExpression ?? field.default ?? null,
              prismaNativeType: field.nativeType ?? null,
              prismaDatabaseType: prismaColumn?.formattedType ?? null,
              databaseColumn,
              database: column,
            };
          }),
      };
    })
    .sort(compareBy((model) => model.databaseTable));

  const relations = dmmf.datamodel.models
    .flatMap((model) =>
      model.fields
        .filter((field) => field.kind === "object")
        .map((field) => ({
          sourceModel: model.name,
          sourceTable: model.dbName ?? model.name,
          prismaField: field.name,
          targetModel: field.type,
          relationName: field.relationName ?? null,
          relationType: "prisma_relation",
        })),
    )
    .sort(
      compareBy(
        (relation) => relation.sourceTable,
        (relation) => relation.prismaField,
      ),
    );

  const constraints = catalog.constraints
    .map((constraint) => {
      const prismaForeignKey =
        constraint.constraintType === "f"
          ? prismaDdl.foreignKeys.find((foreignKey) =>
              sameForeignKeyShape(constraint, foreignKey),
            )
          : null;
      return {
        ...constraint,
        type: constraintType(constraint.constraintType),
        prismaDeclared:
          constraint.constraintType === "f" ? Boolean(prismaForeignKey) : null,
        referentialActionsMatch:
          constraint.constraintType === "f" && prismaForeignKey
            ? sameReferentialActions(constraint, prismaForeignKey)
            : null,
        prismaReferentialActions: prismaForeignKey
          ? {
              onDelete: prismaForeignKey.onDelete,
              onUpdate: prismaForeignKey.onUpdate,
            }
          : null,
      };
    })
    .sort(
      compareBy(
        (constraint) => constraint.tableName,
        (constraint) => constraint.constraintName,
      ),
    );
  const indexes = catalog.indexes
    .map((index) => ({
      ...index,
      prismaDeclared: prismaDdl.indexNames.has(index.indexName),
    }))
    .sort(
      compareBy(
        (index) => index.tableName,
        (index) => index.indexName,
      ),
    );
  assertUniqueObjectKeys(
    indexes,
    (index) => `${index.tableName}.${index.indexName}`,
    "DUPLICATE_INDEX_KEY",
  );

  const findings = findStructuralDifferences({
    models,
    databaseTablesByName,
    databaseColumnsByTable,
    constraints,
  });

  return {
    source: {
      logicalDatabaseSchema: "public",
      physicalVerificationMode: "isolated_temporary_schema",
      verifiedThroughMigration,
    },
    models,
    relations,
    database: {
      tables: [...catalog.tables].sort(compareBy((table) => table.tableName)),
      columns: [...catalog.columns].sort(
        compareBy(
          (column) => column.tableName,
          (column) => column.ordinalPosition,
        ),
      ),
      constraints,
      indexes,
      enums: [...catalog.enums].sort(compareBy((item) => item.enumName)),
      functions: [...catalog.functions].sort(
        compareBy(
          (item) => item.functionName,
          (item) => item.identityArguments,
        ),
      ),
      triggers: [...catalog.triggers].sort(
        compareBy(
          (item) => item.tableName,
          (item) => item.triggerName,
        ),
      ),
    },
    findings,
  };
}

export function summarizeStructure(structure) {
  return {
    prismaModels: structure.models.length,
    prismaPhysicalFields: structure.models.reduce(
      (total, model) => total + model.fields.length,
      0,
    ),
    prismaRelations: structure.relations.length,
    databaseTables: structure.database.tables.length,
    databaseColumns: structure.database.columns.length,
    postgresEnums: structure.database.enums.length,
    checkConstraints: structure.database.constraints.filter(
      (constraint) => constraint.type === "check",
    ).length,
    prismaUnexpressedIndexes: structure.database.indexes.filter(
      (index) => !index.isConstraintBacked && !index.prismaDeclared,
    ).length,
    databaseFunctions: structure.database.functions.length,
    databaseTriggers: structure.database.triggers.length,
    prismaUnexpressedForeignKeys: structure.database.constraints.filter(
      (constraint) =>
        constraint.type === "foreign_key" && !constraint.prismaDeclared,
    ).length,
    findings: structure.findings.length,
  };
}

const CONFIRMATION_STATUSES = new Set([
  "confirmed_business",
  "confirmed_contract",
  "confirmed_implementation",
  "needs_business_confirmation",
]);
const PENDING_NAME = "待业务确认";
const PENDING_PURPOSE = "业务用途待确认；当前仅确认结构与技术消费者";

export function createPendingAnnotations(
  structure,
  { baselineCommit = null } = {},
) {
  const tables = {};
  const fields = {};
  for (const table of structure.database.tables) {
    tables[`public.${table.tableName}`] = pendingTableAnnotation();
  }
  for (const column of structure.database.columns) {
    fields[`public.${column.tableName}.${column.columnName}`] =
      pendingFieldAnnotation();
  }
  return {
    schemaVersion: "1.0.0",
    baselineCommit,
    sources: {},
    tables,
    fields,
    logicalReferences: [],
  };
}

export function parsePrismaModelComments(source) {
  const result = {};
  const pendingComments = [];
  for (const line of source.split(/\r?\n/u)) {
    const comment = line.match(/^\s*\/\/\s*(.+)$/u);
    if (comment) {
      pendingComments.push(comment[1].trim());
      continue;
    }
    const model = line.match(/^\s*model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/u);
    if (!model) {
      if (line.trim()) pendingComments.length = 0;
      continue;
    }
    const bodyStart = source.indexOf(line);
    const bodyEnd = source.indexOf("\n}", bodyStart);
    const body = source.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd);
    const mapped = body.match(/@@map\("([^"]+)"\)/u)?.[1] ?? model[1];
    const purposeZh = pendingComments.join(" ");
    const headline =
      purposeZh.match(/^([^（：。]+?)(?:（[^）]*）)?(?:：|。)/u)?.[1]?.trim() ??
      "待业务确认";
    const nameZh = headline.includes("的")
      ? headline.slice(0, headline.indexOf("的")).trim()
      : headline;
    result[mapped] = {
      nameZh,
      purposeZh: purposeZh || PENDING_PURPOSE,
      ownerModule: purposeZh.match(/（([a-z0-9-]+)\s+拥有）/iu)?.[1] ?? null,
    };
    pendingComments.length = 0;
  }
  return result;
}

export function mergeAnnotationCoverage({
  existing,
  structure,
  baselineCommit,
  tableDescriptions = {},
}) {
  const pending = enrichTechnicalAnnotations(
    createPendingAnnotations(structure, { baselineCommit }),
    structure,
  );
  pending.sources["prisma-schema"] = {
    path: "database/schema.prisma",
    authority: "implementation",
    note: "Prisma model 上方的中文实施注释。",
  };
  for (const [tableName, description] of Object.entries(tableDescriptions)) {
    const annotation = pending.tables[`public.${tableName}`];
    if (!annotation || description.nameZh === PENDING_NAME) continue;
    annotation.nameZh = description.nameZh;
    annotation.nameStatus = "confirmed_implementation";
    annotation.purposeZh = description.purposeZh;
    annotation.purposeStatus = "confirmed_implementation";
    annotation.ownerModule = description.ownerModule;
    annotation.sourceRefs = ["prisma-schema"];
  }
  return {
    ...pending,
    ...existing,
    baselineCommit,
    sources: { ...pending.sources, ...(existing?.sources ?? {}) },
    tables: mergeReviewedAnnotations(pending.tables, existing?.tables),
    fields: mergeReviewedAnnotations(pending.fields, existing?.fields),
    logicalReferences: existing?.logicalReferences ?? [],
  };
}

function mergeReviewedAnnotations(generated, existing = {}) {
  const merged = { ...generated };
  for (const [key, annotation] of Object.entries(existing)) {
    if (!(key in generated)) continue;
    const base = generated[key];
    const result = { ...base };
    for (const semantic of ["name", "purpose"]) {
      if (annotation[`${semantic}Status`] !== "needs_business_confirmation") {
        result[`${semantic}Zh`] = annotation[`${semantic}Zh`];
        result[`${semantic}Status`] = annotation[`${semantic}Status`];
      }
    }
    for (const field of [
      "moduleCode",
      "ownerModule",
      ...EVIDENCE_SLOT_POLICIES.map((policy) => policy.key),
    ]) {
      if (hasReviewedValue(annotation[field]))
        result[field] = annotation[field];
    }
    for (const field of ["sourceRefs", "notes"]) {
      result[field] = [
        ...new Set([...(base[field] ?? []), ...(annotation[field] ?? [])]),
      ];
    }
    merged[key] = result;
  }
  return merged;
}

function hasReviewedValue(value) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return (
      value.value !== null ||
      value.status !== "needs_business_confirmation" ||
      (value.sourceRefs?.length ?? 0) > 0
    );
  }
  return value !== "pending_policy";
}

export function enrichTechnicalAnnotations(annotations, structure) {
  const enriched = structuredClone(annotations);
  enriched.sources ??= {};
  enriched.sources["engineering-data-governance"] ??= {
    path: "ENGINEERING_RULES.md",
    authority: "implementation",
    note: "数据治理中的租户、时间、版本、幂等、哈希与审计通用技术语义。",
  };
  enriched.sources["time-currency-contract"] ??= {
    path: "docs/product/domain/TIME_CURRENCY_REFERENCE_CONTRACT_V1.md",
    authority: "formal_contract",
    note: "IANA 时区与 ISO 4217 货币代码正式契约。",
  };

  const definitions = {
    tenant_id: ["租户标识", "限定记录所属租户并参与租户隔离。"],
    idempotency_key: ["幂等键", "识别同一写入请求的重复提交。"],
    payload_hash: ["载荷哈希", "校验同一幂等键对应的规范化载荷是否一致。"],
    request_hash: ["请求哈希", "校验重复请求的规范化内容是否一致。"],
    content_hash: ["内容哈希", "用于内容完整性、去重或审计比对。"],
    version: ["版本号", "标识该记录在其对象版本链中的版本。"],
    created_at: ["创建时间", "记录该行首次写入数据库的时间。"],
    updated_at: ["更新时间", "记录该行最近一次更新数据库的时间。"],
  };
  for (const column of structure.database.columns) {
    const definition = definitions[column.columnName];
    if (!definition) continue;
    const key = `public.${column.tableName}.${column.columnName}`;
    const annotation = enriched.fields?.[key];
    if (
      !annotation ||
      annotation.nameStatus !== "needs_business_confirmation"
    ) {
      continue;
    }
    annotation.nameZh = definition[0];
    annotation.nameStatus = "confirmed_implementation";
    annotation.purposeZh = definition[1];
    annotation.purposeStatus = "confirmed_implementation";
    annotation.sourceRefs = ["engineering-data-governance"];
  }
  for (const column of structure.database.columns) {
    const key = `public.${column.tableName}.${column.columnName}`;
    const annotation = enriched.fields?.[key];
    if (!annotation) continue;
    if (/_currency$/u.test(column.columnName)) {
      annotation.currencySemantic = {
        value: "ISO 4217 货币代码",
        status: "confirmed_contract",
        sourceRefs: ["time-currency-contract"],
      };
    }
    if (
      /^(?:timezone|origin_timezone|destination_timezone)$/u.test(
        column.columnName,
      )
    ) {
      annotation.timezoneSemantic = {
        value: "IANA 时区标识",
        status: "confirmed_contract",
        sourceRefs: ["time-currency-contract"],
      };
    }
  }
  return enriched;
}

export function validateAnnotations({ annotations, structure, trackedFiles }) {
  const findings = [];
  const tableKeys = new Set(
    structure.database.tables.map((table) => `public.${table.tableName}`),
  );
  const fieldKeys = new Set(
    structure.database.columns.map(
      (column) => `public.${column.tableName}.${column.columnName}`,
    ),
  );
  const annotationTables = annotations.tables ?? {};
  const annotationFields = annotations.fields ?? {};
  const sources = annotations.sources ?? {};

  appendCoverageFindings(
    findings,
    tableKeys,
    Object.keys(annotationTables),
    "ANNOTATION_TABLE_MISSING",
    "ANNOTATION_TABLE_ORPHAN",
  );
  appendCoverageFindings(
    findings,
    fieldKeys,
    Object.keys(annotationFields),
    "ANNOTATION_FIELD_MISSING",
    "ANNOTATION_FIELD_ORPHAN",
  );

  for (const [sourceId, source] of Object.entries(sources).sort()) {
    if (!trackedFiles.has(source.path)) {
      findings.push({
        code: "ANNOTATION_SOURCE_UNTRACKED",
        object: sourceId,
      });
    } else if (!sourceAuthorityMatchesPath(source)) {
      findings.push({
        code: "ANNOTATION_SOURCE_AUTHORITY_MISMATCH",
        object: sourceId,
      });
    }
  }

  for (const [key, annotation] of [
    ...Object.entries(annotationTables),
    ...Object.entries(annotationFields),
  ].sort(([left], [right]) => left.localeCompare(right, "en"))) {
    validateAnnotationShape(findings, key, annotation);
    for (const semantic of ["name", "purpose"]) {
      const status = annotation[`${semantic}Status`];
      if (
        status !== "needs_business_confirmation" &&
        !hasEligibleSource(annotation, sources, trackedFiles, status)
      ) {
        findings.push({
          code: "ANNOTATION_CONFIRMED_WITHOUT_ELIGIBLE_SOURCE",
          object: `${key}:${semantic}`,
        });
      }
    }
    const objectType = key in annotationFields ? "field" : "table";
    for (const policy of EVIDENCE_SLOT_POLICIES) {
      const applicable = policy.appliesTo.includes(objectType);
      const slotPresent = Object.hasOwn(annotation, policy.key);
      if (!applicable) {
        if (slotPresent) {
          findings.push({
            code: "ANNOTATION_SLOT_NOT_APPLICABLE",
            object: `${key}:${policy.key}`,
          });
        }
        continue;
      }
      const slot = annotation[policy.key];
      validateEvidenceSlot({
        findings,
        key,
        policy,
        slot,
        sources,
        trackedFiles,
      });
    }
  }

  validateLogicalReferences({
    findings,
    references: annotations.logicalReferences ?? [],
    structure,
    sources,
    trackedFiles,
  });
  return findings;
}

function validateEvidenceSlot({
  findings,
  key,
  policy,
  slot,
  sources,
  trackedFiles,
}) {
  const object = `${key}:${policy.key}`;
  if (!slot || !policy.allowedStatuses.includes(slot.status)) {
    findings.push({ code: "ANNOTATION_STATUS_INVALID", object });
    return;
  }
  if (!Array.isArray(slot.sourceRefs)) {
    findings.push({ code: "ANNOTATION_SOURCE_REFS_INVALID", object });
    return;
  }
  if (slot.status === "needs_business_confirmation") {
    if (!isCanonicalEmptyValue(slot.value, policy.emptyValue)) {
      findings.push({ code: "ANNOTATION_PENDING_WITH_VALUE", object });
    }
    if (slot.sourceRefs.length > 0) {
      findings.push({ code: "ANNOTATION_PENDING_WITH_SOURCE", object });
    }
    return;
  }
  if (!hasMeaningfulSlotValue(slot.value, policy)) {
    findings.push({ code: "ANNOTATION_CONFIRMED_EMPTY_VALUE", object });
  }
  if (!hasEligibleSource(slot, sources, trackedFiles, slot.status)) {
    findings.push({
      code: "ANNOTATION_CONFIRMED_WITHOUT_ELIGIBLE_SOURCE",
      object,
    });
  }
}

function isCanonicalEmptyValue(value, emptyValue) {
  if (Array.isArray(emptyValue)) {
    return Array.isArray(value) && value.length === 0;
  }
  return value === emptyValue;
}

function hasMeaningfulSlotValue(value, policy) {
  if (policy.key === "workbenchEvidence") {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => typeof item === "string" && item.trim().length > 0)
    );
  }
  return typeof value === "string" && value.trim().length > 0;
}

function validateLogicalReferences({
  findings,
  references,
  structure,
  sources,
  trackedFiles,
}) {
  const columnsByTable = groupBy(
    structure.database.columns,
    (column) => column.tableName,
  );
  const tableNames = new Set(
    structure.database.tables.map((table) => table.tableName),
  );
  for (const reference of references) {
    const name = reference.name ?? "unnamed";
    const sourceColumns = new Set(
      (columnsByTable.get(reference.sourceTable) ?? []).map(
        (column) => column.columnName,
      ),
    );
    for (const field of reference.sourceFields ?? []) {
      if (!sourceColumns.has(field)) {
        findings.push({
          code: "LOGICAL_REFERENCE_SOURCE_FIELD_MISSING",
          object: `${name}:${reference.sourceTable}.${field}`,
        });
      }
    }
    if (!tableNames.has(reference.targetTable)) {
      findings.push({
        code: "LOGICAL_REFERENCE_TARGET_TABLE_MISSING",
        object: `${name}:${reference.targetTable}`,
      });
    } else {
      const targetColumns = new Set(
        (columnsByTable.get(reference.targetTable) ?? []).map(
          (column) => column.columnName,
        ),
      );
      for (const field of reference.targetFields ?? []) {
        if (!targetColumns.has(field)) {
          findings.push({
            code: "LOGICAL_REFERENCE_TARGET_FIELD_MISSING",
            object: `${name}:${reference.targetTable}.${field}`,
          });
        }
      }
    }
    const eligibleEvidence = (reference.sourceRefs ?? []).some((sourceId) => {
      const source = sources[sourceId];
      return (
        source &&
        source.authority === "formal_contract" &&
        trackedFiles.has(source.path) &&
        sourceAuthorityMatchesPath(source)
      );
    });
    if (!eligibleEvidence) {
      findings.push({
        code: "LOGICAL_REFERENCE_EVIDENCE_MISSING",
        object: name,
      });
    }
  }
}

function sourceAuthorityMatchesPath(source) {
  const path = source.path.replaceAll("\\", "/");
  if (source.authority === "business") return path.startsWith("doc/");
  if (source.authority === "formal_contract") {
    return (
      path.startsWith("packages/contracts/schemas/v1/") ||
      /^docs\/product\/domain\/(?:[A-Z0-9_-]+_V1|TARGET_FIELD_CATALOG)\.md$/u.test(
        path,
      )
    );
  }
  if (source.authority === "implementation") {
    return (
      path === "ENGINEERING_RULES.md" ||
      path === "database/schema.prisma" ||
      path.startsWith("database/migrations/") ||
      path.startsWith("apps/") ||
      path.startsWith("workers/") ||
      path.startsWith("scripts/")
    );
  }
  return false;
}

export function buildDictionaryModel({
  structure,
  annotations,
  trackedFiles = new Set(),
}) {
  const validationFindings = validateAnnotations({
    annotations,
    structure,
    trackedFiles,
  });
  const modelByTable = new Map(
    structure.models.map((model) => [model.databaseTable, model]),
  );
  const fields = structure.database.columns.map((column) => {
    const model = modelByTable.get(column.tableName);
    const prismaField = model?.fields.find(
      (field) => field.databaseColumn === column.columnName,
    );
    const key = `public.${column.tableName}.${column.columnName}`;
    return {
      key,
      databaseSchema: "public",
      ...column,
      prismaModel: model?.prismaModel ?? null,
      prismaField: prismaField?.prismaField ?? null,
      prismaType: prismaField?.prismaType ?? null,
      ...(annotations.fields?.[key] ?? pendingFieldAnnotation()),
    };
  });
  const tables = structure.database.tables.map((table) => {
    const key = `public.${table.tableName}`;
    const model = modelByTable.get(table.tableName);
    return {
      key,
      databaseSchema: "public",
      ...table,
      prismaModel: model?.prismaModel ?? null,
      ...(annotations.tables?.[key] ?? pendingTableAnnotation()),
    };
  });
  return {
    provenance: {
      baselineCommit: annotations.baselineCommit ?? null,
      verifiedThroughMigration: structure.source.verifiedThroughMigration,
    },
    statistics: {
      ...summarizeStructure(structure),
      annotatedTables: tables.length,
      annotatedFields: fields.length,
      pendingTables: tables.filter((item) => isPendingAnnotation(item, "table"))
        .length,
      pendingFields: fields.filter((item) => isPendingAnnotation(item, "field"))
        .length,
    },
    tables,
    fields,
    relations: buildDictionaryRelations(structure, annotations),
    constraintsAndIndexes: [
      ...structure.database.constraints,
      ...structure.database.indexes,
    ],
    codeSets: structure.database.enums,
    nativeObjects: {
      functions: structure.database.functions,
      triggers: structure.database.triggers,
    },
    sources: annotations.sources ?? {},
    findings: structure.findings,
    validationFindings,
  };
}

function buildDictionaryRelations(structure, annotations) {
  return [
    ...structure.database.constraints
      .filter((constraint) => constraint.type === "foreign_key")
      .map((constraint) => ({
        relationType: "physical_fk",
        sourceTable: constraint.tableName,
        sourceFields: constraint.columnNames,
        targetTable: constraint.referencedTableName,
        targetFields: constraint.referencedColumnNames,
        name: constraint.constraintName,
        prismaDeclared: constraint.prismaDeclared,
      })),
    ...structure.relations.map((relation) => ({
      ...relation,
      sourceFields: [],
      targetTable: relation.targetModel,
      targetFields: [],
      name: relation.relationName,
      prismaDeclared: true,
    })),
    ...(annotations.logicalReferences ?? []).map((relation) => ({
      ...relation,
      relationType: "logical_reference",
      prismaDeclared: false,
    })),
  ].sort(
    compareBy(
      (relation) => relation.relationType,
      (relation) => relation.sourceTable,
      (relation) => relation.name,
    ),
  );
}

function pendingAnnotation(objectType) {
  const annotation = {
    nameZh: PENDING_NAME,
    nameStatus: "needs_business_confirmation",
    purposeZh: PENDING_PURPOSE,
    purposeStatus: "needs_business_confirmation",
    sourceRefs: [],
    moduleCode: null,
    ownerModule: null,
    notes: [],
  };
  for (const policy of evidencePoliciesFor(objectType)) {
    annotation[policy.key] = pendingEvidenceSlot(policy.emptyValue);
  }
  return annotation;
}

function pendingTableAnnotation() {
  return pendingAnnotation("table");
}

function pendingFieldAnnotation() {
  return pendingAnnotation("field");
}

function appendCoverageFindings(
  findings,
  expectedKeys,
  annotationKeys,
  missingCode,
  orphanCode,
) {
  const actualKeys = new Set(annotationKeys);
  for (const key of [...expectedKeys].sort()) {
    if (!actualKeys.has(key)) findings.push({ code: missingCode, object: key });
  }
  for (const key of [...actualKeys].sort()) {
    if (!expectedKeys.has(key))
      findings.push({ code: orphanCode, object: key });
  }
}

function validateAnnotationShape(findings, key, annotation) {
  for (const semantic of ["name", "purpose"]) {
    const status = annotation[`${semantic}Status`];
    if (!CONFIRMATION_STATUSES.has(status)) {
      findings.push({
        code: "ANNOTATION_STATUS_INVALID",
        object: `${key}:${semantic}`,
      });
    }
  }
}

function hasEligibleSource(annotation, sources, trackedFiles, status) {
  const eligibleAuthority = STATUS_AUTHORITY[status];
  return (annotation.sourceRefs ?? []).some((sourceId) => {
    const source = sources[sourceId];
    return (
      source &&
      trackedFiles.has(source.path) &&
      source.authority === eligibleAuthority &&
      sourceAuthorityMatchesPath(source)
    );
  });
}

export async function extractNormalizedStructure({
  databaseUrl = process.env.DICTIONARY_DATABASE_URL ??
    process.env.INTEGRATION_DATABASE_URL ??
    process.env.DATABASE_URL ??
    DEFAULT_DATABASE_URL,
  schemaName = createTemporarySchemaName(),
} = {}) {
  assertSafeExtractionTarget(databaseUrl, schemaName);
  const targetUrl = withSchema(databaseUrl, schemaName);
  let schemaCreated = false;

  try {
    await createTemporarySchema(databaseUrl, schemaName);
    schemaCreated = true;
    runPrismaGenerate();
    runMigrations(targetUrl);

    const [catalog, prismaDdlSql] = await Promise.all([
      readCatalog(targetUrl, schemaName),
      Promise.resolve(readPrismaDdl()),
    ]);
    const { Prisma } = require(GENERATED_CLIENT_PATH);
    const structure = buildNormalizedStructure({
      schemaName,
      verifiedThroughMigration: latestMigrationName(),
      dmmf: Prisma.dmmf,
      catalog,
      prismaDdl: parsePrismaDdl(prismaDdlSql),
    });

    return { structure, summary: summarizeStructure(structure) };
  } finally {
    if (schemaCreated) await dropTemporarySchema(databaseUrl, schemaName);
  }
}

function findStructuralDifferences({
  models,
  databaseTablesByName,
  databaseColumnsByTable,
  constraints,
}) {
  const findings = [];
  const modelTables = new Set(models.map((model) => model.databaseTable));

  for (const tableName of [...databaseTablesByName.keys()].sort()) {
    if (!modelTables.has(tableName)) {
      findings.push({ code: "DATABASE_ONLY_TABLE", object: tableName });
    }
  }

  for (const model of models) {
    if (!databaseTablesByName.has(model.databaseTable)) {
      findings.push({
        code: "PRISMA_TABLE_MISSING_IN_DATABASE",
        object: model.databaseTable,
      });
      continue;
    }
    const prismaColumns = new Set(
      model.fields.map((field) => field.databaseColumn),
    );
    const databaseColumns =
      databaseColumnsByTable.get(model.databaseTable) ?? [];
    for (const column of databaseColumns) {
      if (!prismaColumns.has(column.columnName)) {
        findings.push({
          code: "DATABASE_ONLY_COLUMN",
          object: `${model.databaseTable}.${column.columnName}`,
        });
      }
    }
    const databaseColumnNames = new Set(
      databaseColumns.map((column) => column.columnName),
    );
    const databaseColumnByName = new Map(
      databaseColumns.map((column) => [column.columnName, column]),
    );
    for (const field of model.fields) {
      if (!databaseColumnNames.has(field.databaseColumn)) {
        findings.push({
          code: "PRISMA_COLUMN_MISSING_IN_DATABASE",
          object: `${model.databaseTable}.${field.databaseColumn}`,
        });
        continue;
      }
      findings.push(
        ...fieldDriftFindings(
          model.databaseTable,
          field,
          databaseColumnByName.get(field.databaseColumn),
        ),
      );
    }
  }

  for (const constraint of constraints) {
    if (
      constraint.type === "foreign_key" &&
      constraint.prismaDeclared &&
      !constraint.referentialActionsMatch
    ) {
      findings.push({
        code: "FOREIGN_KEY_ACTION_DRIFT",
        object: `${constraint.tableName}.${constraint.constraintName}`,
        database: {
          onDelete: referentialAction(constraint.onDelete),
          onUpdate: referentialAction(constraint.onUpdate),
        },
        prisma: constraint.prismaReferentialActions,
      });
    }
  }

  return findings;
}

function fieldDriftFindings(tableName, field, column) {
  const object = `${tableName}.${field.databaseColumn}`;
  const findings = [];
  const databaseList = /\[\]$/u.test(column.formattedType);
  const prismaFamily = field.prismaDatabaseType
    ? postgresTypeFamily(field.prismaDatabaseType)
    : prismaTypeFamily(field.prismaType);
  const databaseFamily = postgresTypeFamily(column.formattedType);
  if (prismaFamily && databaseFamily && prismaFamily !== databaseFamily) {
    findings.push({ code: "FIELD_TYPE_DRIFT", object });
  }
  if (
    field.prismaDatabaseType &&
    normalizeParameterizedType(field.prismaDatabaseType) !==
      normalizeParameterizedType(column.formattedType)
  ) {
    findings.push({ code: "FIELD_NATIVE_TYPE_DRIFT", object });
  }
  if (
    field.prismaRequired !== null &&
    field.prismaRequired === column.isNullable
  ) {
    findings.push({ code: "FIELD_NULLABILITY_DRIFT", object });
  }
  if (field.prismaList !== null && Boolean(field.prismaList) !== databaseList) {
    findings.push({ code: "FIELD_ARITY_DRIFT", object });
  }
  if (
    field.prismaHasDefault !== null &&
    Boolean(field.prismaHasDefault) !== Boolean(column.defaultExpression)
  ) {
    findings.push({ code: "FIELD_DEFAULT_DRIFT", object });
  }
  const prismaDefault = simpleDefaultValue(field.prismaDefault);
  const databaseDefault = simpleDefaultValue(column.defaultExpression);
  if (
    prismaDefault !== null &&
    databaseDefault !== null &&
    prismaDefault !== databaseDefault
  ) {
    findings.push({ code: "FIELD_DEFAULT_VALUE_DRIFT", object });
  }
  return findings;
}

function normalizeParameterizedType(type) {
  return type
    .replace(/\s+/gu, "")
    .replace(/^decimal/iu, "numeric")
    .replace(/^timestamptz$/iu, "timestampwithtimezone")
    .replace(/^timestamp(\([^)]*\))$/iu, "timestamp$1withouttimezone")
    .replace(/^char(?=\()/iu, "character")
    .toLowerCase();
}

function simpleDefaultValue(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value)
    .trim()
    .replace(/::[a-z0-9_\s[\]"]+$/iu, "");
  return /^(?:-?\d+(?:\.\d+)?|true|false|'[^']*')$/iu.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function prismaTypeFamily(type) {
  return {
    String: "string",
    Int: "integer",
    BigInt: "integer",
    Float: "number",
    Decimal: "number",
    Boolean: "boolean",
    DateTime: "datetime",
    Json: "json",
    Bytes: "bytes",
  }[type];
}

function postgresTypeFamily(type) {
  const base = type.replace(/\[\]$/u, "").toLowerCase();
  if (/^(text|character|character varying|uuid)/u.test(base)) return "string";
  if (/^(smallint|integer|bigint)/u.test(base)) return "integer";
  if (/^(numeric|decimal|real|double precision)/u.test(base)) return "number";
  if (base === "boolean") return "boolean";
  if (/^(timestamp|date|time)/u.test(base)) return "datetime";
  if (base === "json" || base === "jsonb") return "json";
  if (base === "bytea") return "bytes";
  return null;
}

async function createTemporarySchema(databaseUrl, schemaName) {
  assertSafeExtractionTarget(databaseUrl, schemaName);
  await withDatabasePool(
    withSearchPath(databaseUrl, "pg_catalog"),
    async (pool) => {
      await pool.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
    },
  );
}

async function dropTemporarySchema(databaseUrl, schemaName) {
  assertSafeExtractionTarget(databaseUrl, schemaName);
  await withDatabasePool(
    withSearchPath(databaseUrl, "pg_catalog"),
    async (pool) => {
      await pool.query(`DROP SCHEMA ${quoteIdentifier(schemaName)} CASCADE`);
    },
  );
}

async function readCatalog(databaseUrl, schemaName) {
  assertSafeExtractionTarget(databaseUrl, schemaName);
  return withDatabasePool(
    withSearchPath(databaseUrl, schemaName),
    async (pool) => {
      const [
        tables,
        columns,
        constraints,
        indexes,
        enums,
        functions,
        triggers,
      ] = await Promise.all([
        pool.query(CATALOG_QUERIES.tables, [schemaName]),
        pool.query(CATALOG_QUERIES.columns, [schemaName]),
        pool.query(CATALOG_QUERIES.constraints, [schemaName]),
        pool.query(CATALOG_QUERIES.indexes, [schemaName]),
        pool.query(CATALOG_QUERIES.enums, [schemaName]),
        pool.query(CATALOG_QUERIES.functions, [schemaName]),
        pool.query(CATALOG_QUERIES.triggers, [schemaName]),
      ]);
      return {
        tables: tables.rows,
        columns: columns.rows,
        constraints: constraints.rows,
        indexes: indexes.rows,
        enums: enums.rows,
        functions: functions.rows,
        triggers: triggers.rows,
      };
    },
  );
}

async function withDatabasePool(databaseUrl, operation) {
  const factory = new PrismaPg({ connectionString: databaseUrl });
  const adapter = await factory.connect();
  try {
    return await operation(adapter.underlyingDriver());
  } finally {
    await adapter.dispose();
  }
}

function runPrismaGenerate() {
  const prismaCli = require.resolve("prisma/build/index.js");
  runCommand(
    process.execPath,
    [prismaCli, "generate", "--schema", PRISMA_SCHEMA_PATH],
    "PRISMA_GENERATE_FAILED",
  );
}

function runMigrations(databaseUrl) {
  runCommand(
    process.execPath,
    [MIGRATION_RUNNER_PATH],
    "MIGRATION_REPLAY_FAILED",
    { ...process.env, DATABASE_URL: databaseUrl },
  );
}

function readPrismaDdl() {
  const prismaCli = require.resolve("prisma/build/index.js");
  return runCommand(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema",
      PRISMA_SCHEMA_PATH,
      "--script",
    ],
    "PRISMA_DDL_EXTRACTION_FAILED",
  ).stdout;
}

function runCommand(command, args, errorCode, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    env,
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(`${errorCode}${detail ? `\n${detail}` : ""}`);
  }
  return result;
}

function latestMigrationName() {
  const { readdirSync } = require("node:fs");
  return readdirSync(MIGRATIONS_PATH, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1);
}

function withSchema(databaseUrl, schemaName) {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schemaName);
  return url.toString();
}

function withSearchPath(databaseUrl, schemaName) {
  const url = new URL(databaseUrl);
  url.searchParams.delete("schema");
  const declaredOptions = url.searchParams.get("options")?.trim();
  const searchPathOption = `-c search_path=${schemaName}`;
  url.searchParams.set(
    "options",
    declaredOptions
      ? `${declaredOptions} ${searchPathOption}`
      : searchPathOption,
  );
  return url.toString();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function parseIdentifierList(value) {
  return [...value.matchAll(/"((?:[^"]|"")+)"/gu)].map((match) =>
    unescapeIdentifier(match[1]),
  );
}

function unescapeIdentifier(identifier) {
  return identifier.replaceAll('""', '"');
}

function sameForeignKeyShape(left, right) {
  return (
    left.tableName === right.tableName &&
    left.referencedTableName === right.referencedTableName &&
    arraysEqual(left.columnNames, right.columnNames) &&
    arraysEqual(left.referencedColumnNames, right.referencedColumnNames)
  );
}

function sameReferentialActions(left, right) {
  return (
    referentialAction(left.onDelete) === right.onDelete &&
    referentialAction(left.onUpdate) === right.onUpdate
  );
}

function arraysEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function parseReferentialAction(clause, operation) {
  const match = clause.match(
    new RegExp(
      `ON\\s+${operation}\\s+(NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)`,
      "iu",
    ),
  );
  return (match?.[1] ?? "NO ACTION").toUpperCase();
}

function referentialAction(code) {
  return (
    {
      a: "NO ACTION",
      r: "RESTRICT",
      c: "CASCADE",
      n: "SET NULL",
      d: "SET DEFAULT",
    }[code] ?? code
  );
}

function normalizeCatalogSchema(catalog, extractionSchema) {
  return Object.fromEntries(
    Object.entries(catalog).map(([key, rows]) => [
      key,
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([field, value]) => [
            field,
            typeof value === "string"
              ? value.replaceAll(extractionSchema, "public")
              : value,
          ]),
        ),
      ),
    ]),
  );
}

function assertUniqueObjectKeys(items, keyOf, errorCode) {
  const seen = new Set();
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) throw new Error(`${errorCode}:${key}`);
    seen.add(key);
  }
}

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function compareBy(...selectors) {
  return (left, right) => {
    for (const selector of selectors) {
      const comparison = String(selector(left)).localeCompare(
        String(selector(right)),
        "en",
      );
      if (comparison !== 0) return comparison;
    }
    return 0;
  };
}

function constraintType(type) {
  return (
    {
      c: "check",
      f: "foreign_key",
      p: "primary_key",
      u: "unique",
      x: "exclusion",
    }[type] ?? `postgres_${type}`
  );
}

const CATALOG_QUERIES = {
  tables: `
    SELECT c.relname AS "tableName"
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1
      AND c.relkind IN ('r', 'p')
      AND c.relname <> '_prisma_migrations'
    ORDER BY c.relname`,
  columns: `
    SELECT
      c.relname AS "tableName",
      a.attname AS "columnName",
      a.attnum::int AS "ordinalPosition",
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS "formattedType",
      NOT a.attnotnull AS "isNullable",
      pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) AS "defaultExpression",
      a.attidentity AS "identityKind",
      a.attgenerated AS "generatedKind"
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_catalog.pg_attrdef ad
      ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE n.nspname = $1
      AND c.relkind IN ('r', 'p')
      AND c.relname <> '_prisma_migrations'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum`,
  constraints: `
    SELECT
      tbl.relname AS "tableName",
      con.conname AS "constraintName",
      con.contype AS "constraintType",
      con.confdeltype AS "onDelete",
      con.confupdtype AS "onUpdate",
      pg_catalog.pg_get_constraintdef(con.oid, true) AS "definition",
      COALESCE(
        (
          SELECT json_agg(att.attname ORDER BY key.ordinal)
          FROM unnest(con.conkey) WITH ORDINALITY AS key(attnum, ordinal)
          JOIN pg_catalog.pg_attribute att
            ON att.attrelid = con.conrelid AND att.attnum = key.attnum
        ),
        '[]'::json
      ) AS "columnNames",
      ref.relname AS "referencedTableName",
      COALESCE(
        (
          SELECT json_agg(att.attname ORDER BY key.ordinal)
          FROM unnest(con.confkey) WITH ORDINALITY AS key(attnum, ordinal)
          JOIN pg_catalog.pg_attribute att
            ON att.attrelid = con.confrelid AND att.attnum = key.attnum
        ),
        '[]'::json
      ) AS "referencedColumnNames"
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class tbl ON tbl.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = tbl.relnamespace
    LEFT JOIN pg_catalog.pg_class ref ON ref.oid = con.confrelid
    WHERE n.nspname = $1
      AND tbl.relname <> '_prisma_migrations'
      AND con.contype IN ('c', 'f', 'p', 'u', 'x')
    ORDER BY tbl.relname, con.conname`,
  indexes: `
    SELECT
      tbl.relname AS "tableName",
      idx.relname AS "indexName",
      i.indisunique AS "isUnique",
      i.indisprimary AS "isPrimary",
      i.indisvalid AS "isValid",
      con.oid IS NOT NULL AS "isConstraintBacked",
      pg_catalog.pg_get_indexdef(i.indexrelid) AS "definition",
      pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS "predicate"
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_catalog.pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = tbl.relnamespace
    LEFT JOIN pg_catalog.pg_constraint con
      ON con.conindid = i.indexrelid
      AND con.conrelid = i.indrelid
      AND con.contype IN ('p', 'u', 'x')
    WHERE n.nspname = $1
      AND tbl.relname <> '_prisma_migrations'
      AND i.indisvalid
    ORDER BY tbl.relname, idx.relname`,
  enums: `
    SELECT
      typ.typname AS "enumName",
      json_agg(en.enumlabel ORDER BY en.enumsortorder) AS "values"
    FROM pg_catalog.pg_type typ
    JOIN pg_catalog.pg_namespace n ON n.oid = typ.typnamespace
    JOIN pg_catalog.pg_enum en ON en.enumtypid = typ.oid
    WHERE n.nspname = $1
    GROUP BY typ.typname
    ORDER BY typ.typname`,
  functions: `
    SELECT
      proc.proname AS "functionName",
      proc.prokind AS "functionKind",
      pg_catalog.pg_get_function_identity_arguments(proc.oid) AS "identityArguments",
      pg_catalog.pg_get_function_result(proc.oid) AS "resultType",
      pg_catalog.pg_get_functiondef(proc.oid) AS "definition"
    FROM pg_catalog.pg_proc proc
    JOIN pg_catalog.pg_namespace n ON n.oid = proc.pronamespace
    WHERE n.nspname = $1
      AND proc.prokind IN ('f', 'p')
    ORDER BY proc.proname, pg_catalog.pg_get_function_identity_arguments(proc.oid)`,
  triggers: `
    SELECT
      tbl.relname AS "tableName",
      trg.tgname AS "triggerName",
      trg.tgconstraint <> 0 AS "isConstraintTrigger",
      pg_catalog.pg_get_triggerdef(trg.oid, true) AS "definition"
    FROM pg_catalog.pg_trigger trg
    JOIN pg_catalog.pg_class tbl ON tbl.oid = trg.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = tbl.relnamespace
    WHERE n.nspname = $1
      AND NOT trg.tgisinternal
    ORDER BY tbl.relname, trg.tgname`,
};

export function serializeAnnotations(annotations) {
  const stored = structuredClone(annotations);
  for (const annotation of Object.values(stored.tables ?? {})) {
    stripEvidenceForObject(annotation, "table");
  }
  for (const annotation of Object.values(stored.fields ?? {})) {
    stripEvidenceForObject(annotation, "field");
  }
  return stored;
}

function stripEvidenceForObject(annotation, objectType) {
  for (const policy of EVIDENCE_SLOT_POLICIES) {
    if (!policy.appliesTo.includes(objectType)) {
      delete annotation[policy.key];
      continue;
    }
    const slot = annotation[policy.key];
    if (
      slot?.status === "needs_business_confirmation" &&
      isCanonicalEmptyValue(slot.value, policy.emptyValue) &&
      Array.isArray(slot.sourceRefs) &&
      slot.sourceRefs.length === 0
    ) {
      delete annotation[policy.key];
    }
  }
}

export async function buildDictionaryArtifacts({
  structure,
  annotations,
  trackedFiles = new Set(),
  fixedDate,
}) {
  const model = buildDictionaryModel({
    structure,
    annotations,
    trackedFiles,
  });
  if (model.validationFindings.length > 0) {
    throw new Error(
      `DICTIONARY_ANNOTATIONS_INVALID\n${JSON.stringify(model.validationFindings, null, 2)}`,
    );
  }
  const storedAnnotations = serializeAnnotations(annotations);
  return {
    "dictionary.annotations.json": await format(
      JSON.stringify(storedAnnotations),
      {
        parser: "json",
      },
    ),
    "DATA_DICTIONARY.generated.md": renderDataDictionaryMarkdown(model),
    "NATIVE_OBJECTS.generated.md": renderNativeObjectsMarkdown(model),
    "database-data-dictionary.xlsx": await renderWorkbook(model, { fixedDate }),
  };
}

export function compareGeneratedArtifacts({ expected, committed }) {
  return Object.entries(expected)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .flatMap(([path, expectedValue]) => {
      if (!(path in committed)) return [{ path, state: "missing" }];
      const committedValue = committed[path];
      const same = Buffer.isBuffer(expectedValue)
        ? Buffer.isBuffer(committedValue) &&
          expectedValue.equals(committedValue)
        : expectedValue === committedValue;
      return same ? [] : [{ path, state: "changed" }];
    });
}

function readCommittedArtifacts(outputDirectory, names) {
  const artifacts = {};
  for (const name of names) {
    try {
      artifacts[name] = readFileSync(resolve(outputDirectory, name));
      if (!name.endsWith(".xlsx"))
        artifacts[name] = artifacts[name].toString("utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return artifacts;
}

export function resolveAnnotationBaseline({ action, existing, currentCommit }) {
  if (action !== "bootstrap" && existing?.baselineCommit) {
    return existing.baselineCommit;
  }
  return currentCommit;
}

export function parseCommand(args) {
  const actions = new Map([
    ["--bootstrap-annotations", "bootstrap"],
    ["--generate", "generate"],
    ["--check", "check"],
  ]);
  const selected = args.filter((argument) => actions.has(argument));
  const unknown = args.filter(
    (argument) => !actions.has(argument) && argument !== "--json",
  );
  if (unknown.length > 0) {
    throw new Error(`UNKNOWN_ARGUMENT:${unknown.join(",")}`);
  }
  if (selected.length > 1) throw new Error("DICTIONARY_ACTION_CONFLICT");
  if (selected.length === 1 && args.includes("--json")) {
    throw new Error("DICTIONARY_ACTION_CONFLICT");
  }
  return {
    action: selected.length === 0 ? "summary" : actions.get(selected[0]),
    json: args.includes("--json"),
  };
}

async function main() {
  const command = parseCommand(process.argv.slice(2));
  const result = await extractNormalizedStructure();
  if (command.action === "summary") {
    process.stdout.write(
      `${JSON.stringify(command.json ? result.structure : result.summary, null, 2)}\n`,
    );
    return;
  }

  const currentCommit = gitOutput(["rev-parse", "HEAD"]);
  const existing = existsSync(ANNOTATIONS_PATH)
    ? JSON.parse(readFileSync(ANNOTATIONS_PATH, "utf8"))
    : null;
  const baselineCommit = resolveAnnotationBaseline({
    action: command.action,
    existing,
    currentCommit,
  });
  const annotations = mergeAnnotationCoverage({
    existing,
    structure: result.structure,
    baselineCommit,
    tableDescriptions: parsePrismaModelComments(
      readFileSync(PRISMA_SCHEMA_PATH, "utf8"),
    ),
  });
  if (command.action === "bootstrap") {
    atomicWriteArtifacts(OUTPUT_DIRECTORY, {
      "dictionary.annotations.json": await format(
        JSON.stringify(serializeAnnotations(annotations)),
        {
          parser: "json",
        },
      ),
    });
    process.stdout.write(
      `Updated database/dictionary/dictionary.annotations.json (${Object.keys(annotations.tables).length} tables, ${Object.keys(annotations.fields).length} fields).\n`,
    );
    return;
  }

  const trackedFiles = new Set(
    gitOutput(["ls-files"]).split(/\r?\n/u).filter(Boolean),
  );
  const fixedDate = new Date(
    gitOutput(["show", "-s", "--format=%cI", baselineCommit]),
  );
  const artifacts = await buildDictionaryArtifacts({
    structure: result.structure,
    annotations,
    trackedFiles,
    fixedDate,
  });
  if (command.action === "generate") {
    atomicWriteArtifacts(OUTPUT_DIRECTORY, artifacts);
    process.stdout.write(
      `Generated database dictionary (${result.summary.databaseTables} tables, ${result.summary.databaseColumns} fields).\n`,
    );
    return;
  }

  const drift = compareGeneratedArtifacts({
    expected: artifacts,
    committed: readCommittedArtifacts(OUTPUT_DIRECTORY, Object.keys(artifacts)),
  });
  if (drift.length > 0) {
    for (const item of drift) {
      process.stderr.write(
        `DATA_DICTIONARY_DRIFT:${item.state}:${item.path}\n`,
      );
    }
    process.stderr.write(
      "Run `pnpm data-dictionary:generate` and commit the results.\n",
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Database dictionary artifacts are in sync.\n");
}

function gitOutput(args) {
  return runCommand("git", args, "GIT_COMMAND_FAILED").stdout.trim();
}

function atomicWriteArtifacts(outputDirectory, artifacts) {
  mkdirSync(outputDirectory, { recursive: true });
  const staged = [];
  try {
    for (const [name, content] of Object.entries(artifacts)) {
      const target = resolve(outputDirectory, name);
      const temporary = `${target}.tmp-${process.pid}`;
      writeFileSync(temporary, content);
      staged.push({ temporary, target });
    }
    for (const { temporary, target } of staged) renameSync(temporary, target);
  } finally {
    for (const { temporary } of staged) {
      rmSync(temporary, { force: true });
    }
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
