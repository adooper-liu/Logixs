import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";

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

  return { indexNames, foreignKeys };
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
            return {
              prismaField: field.name,
              prismaKind: field.kind,
              prismaType: field.type,
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
    for (const field of model.fields) {
      if (!databaseColumnNames.has(field.databaseColumn)) {
        findings.push({
          code: "PRISMA_COLUMN_MISSING_IN_DATABASE",
          object: `${model.databaseTable}.${field.databaseColumn}`,
        });
      }
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
    LEFT JOIN pg_catalog.pg_constraint con ON con.conindid = i.indexrelid
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

async function main() {
  const unknownArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== "--json");
  if (unknownArguments.length > 0) {
    throw new Error(`UNKNOWN_ARGUMENT:${unknownArguments.join(",")}`);
  }
  const result = await extractNormalizedStructure();
  process.stdout.write(
    `${JSON.stringify(process.argv.includes("--json") ? result.structure : result.summary, null, 2)}\n`,
  );
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
