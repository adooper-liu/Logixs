import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertSafeExtractionTarget,
  buildDictionaryModel,
  buildNormalizedStructure,
  createPendingAnnotations,
  createTemporarySchemaName,
  parsePrismaDdl,
  summarizeStructure,
  validateAnnotations,
} from "./generate-data-dictionary.mjs";

const LOCAL_URL = "postgresql://logix:logix@localhost:5433/logix";

test("temporary schema names use the reserved prefix", () => {
  const schema = createTemporarySchemaName({
    pid: 42,
    randomId: "12345678-abcd-4321-aaaa-1234567890ab",
  });

  assert.equal(schema, "logix_dictionary_tmp_42_12345678abcd4321");
});

test("safe extraction target requires a loopback database and reserved schema", () => {
  const schema = "logix_dictionary_tmp_42_12345678abcd4321";

  assert.doesNotThrow(() => assertSafeExtractionTarget(LOCAL_URL, schema));
  assert.throws(
    () =>
      assertSafeExtractionTarget(
        "postgresql://logix:logix@db.example.com:5432/logix",
        schema,
      ),
    /DICTIONARY_DATABASE_NOT_LOOPBACK/,
  );
  assert.throws(
    () => assertSafeExtractionTarget(LOCAL_URL, "public"),
    /DICTIONARY_SCHEMA_NOT_ISOLATED/,
  );
  assert.throws(
    () => assertSafeExtractionTarget(LOCAL_URL, "integration_shared"),
    /DICTIONARY_SCHEMA_NOT_ISOLATED/,
  );
});

test("Prisma DDL parser records declared indexes and foreign keys", () => {
  const parsed = parsePrismaDdl(`
    CREATE UNIQUE INDEX "order_tenant_key" ON "order"("tenant_id");
    ALTER TABLE "order_line"
      ADD CONSTRAINT "order_line_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT;
  `);

  assert.deepEqual([...parsed.indexNames], ["order_tenant_key"]);
  assert.deepEqual(parsed.foreignKeys, [
    {
      tableName: "order_line",
      constraintName: "order_line_order_id_fkey",
      columnNames: ["order_id"],
      referencedTableName: "order",
      referencedColumnNames: ["id"],
      onDelete: "RESTRICT",
      onUpdate: "NO ACTION",
    },
  ]);
});

test("normalization separates physical fields from Prisma relations", () => {
  const structure = buildNormalizedStructure({
    schemaName: "logix_dictionary_tmp_42_12345678abcd4321",
    verifiedThroughMigration: "20261001000000_latest",
    dmmf: {
      datamodel: {
        models: [
          {
            name: "Order",
            dbName: "order",
            fields: [
              { name: "id", kind: "scalar", type: "String", dbName: "id" },
              {
                name: "lines",
                kind: "object",
                type: "OrderLine",
                relationName: "OrderToOrderLine",
              },
            ],
          },
        ],
      },
    },
    catalog: {
      tables: [{ tableName: "order" }],
      columns: [
        {
          tableName: "order",
          columnName: "id",
          ordinalPosition: 1,
          formattedType: "uuid",
          isNullable: false,
          defaultExpression: null,
          identityKind: "",
          generatedKind: "",
        },
      ],
      constraints: [],
      indexes: [
        {
          tableName: "order",
          indexName: "order_native_idx",
          isConstraintBacked: false,
          definition:
            'CREATE INDEX order_native_idx ON "logix_dictionary_tmp_42_12345678abcd4321"."order" USING btree (id)',
        },
      ],
      enums: [],
      functions: [],
      triggers: [],
    },
    prismaDdl: { indexNames: new Set(), foreignKeys: [] },
  });

  assert.equal(structure.models[0].fields.length, 1);
  assert.equal(structure.relations.length, 1);
  assert.equal(structure.models[0].fields[0].databaseColumn, "id");
  assert.equal(
    structure.database.indexes[0].definition,
    'CREATE INDEX order_native_idx ON "public"."order" USING btree (id)',
  );
  assert.deepEqual(structure.findings, []);
  assert.equal(
    structure.source.physicalVerificationMode,
    "isolated_temporary_schema",
  );
});

test("normalization reports missing and database-only tables and columns", () => {
  const structure = buildNormalizedStructure({
    schemaName: "logix_dictionary_tmp_42_12345678abcd4321",
    verifiedThroughMigration: "latest",
    dmmf: {
      datamodel: {
        models: [
          {
            name: "Expected",
            dbName: "expected",
            fields: [
              { name: "id", kind: "scalar", type: "String", dbName: "id" },
              {
                name: "missing",
                kind: "scalar",
                type: "String",
                dbName: "missing",
              },
            ],
          },
        ],
      },
    },
    catalog: {
      tables: [{ tableName: "expected" }, { tableName: "native_table" }],
      columns: [
        {
          tableName: "expected",
          columnName: "id",
          ordinalPosition: 1,
          formattedType: "text",
          isNullable: false,
          defaultExpression: null,
          identityKind: "",
          generatedKind: "",
        },
        {
          tableName: "expected",
          columnName: "native_column",
          ordinalPosition: 2,
          formattedType: "text",
          isNullable: true,
          defaultExpression: null,
          identityKind: "",
          generatedKind: "",
        },
      ],
      constraints: [],
      indexes: [],
      enums: [],
      functions: [],
      triggers: [],
    },
    prismaDdl: { indexNames: new Set(), foreignKeys: [] },
  });

  assert.deepEqual(
    structure.findings.map(({ code, object }) => `${code}:${object}`),
    [
      "DATABASE_ONLY_TABLE:native_table",
      "DATABASE_ONLY_COLUMN:expected.native_column",
      "PRISMA_COLUMN_MISSING_IN_DATABASE:expected.missing",
    ],
  );
});

test("normalization separates native foreign keys from action drift", () => {
  const structure = buildNormalizedStructure({
    schemaName: "logix_dictionary_tmp_42_12345678abcd4321",
    verifiedThroughMigration: "latest",
    dmmf: {
      datamodel: {
        models: [
          {
            name: "Order",
            dbName: "order",
            fields: [
              { name: "id", kind: "scalar", type: "String", dbName: "id" },
            ],
          },
        ],
      },
    },
    catalog: {
      tables: [{ tableName: "order" }],
      columns: [
        {
          tableName: "order",
          columnName: "id",
          ordinalPosition: 1,
          formattedType: "uuid",
          isNullable: false,
          defaultExpression: null,
          identityKind: "",
          generatedKind: "",
        },
      ],
      constraints: [
        {
          tableName: "order",
          constraintName: "order_parent_fkey",
          constraintType: "f",
          columnNames: ["id"],
          referencedTableName: "order",
          referencedColumnNames: ["id"],
          onDelete: "r",
          onUpdate: "c",
        },
        {
          tableName: "order",
          constraintName: "order_native_fkey",
          constraintType: "f",
          columnNames: ["id"],
          referencedTableName: "native_parent",
          referencedColumnNames: ["id"],
          onDelete: "r",
          onUpdate: "c",
        },
      ],
      indexes: [],
      enums: [],
      functions: [],
      triggers: [],
    },
    prismaDdl: {
      indexNames: new Set(),
      foreignKeys: [
        {
          tableName: "order",
          constraintName: "generated_name_does_not_matter",
          columnNames: ["id"],
          referencedTableName: "order",
          referencedColumnNames: ["id"],
          onDelete: "RESTRICT",
          onUpdate: "NO ACTION",
        },
      ],
    },
  });

  const nativeConstraint = structure.database.constraints.find(
    (constraint) => constraint.constraintName === "order_native_fkey",
  );
  const driftedConstraint = structure.database.constraints.find(
    (constraint) => constraint.constraintName === "order_parent_fkey",
  );
  assert.equal(nativeConstraint.prismaDeclared, false);
  assert.equal(driftedConstraint.prismaDeclared, true);
  assert.deepEqual(structure.findings, [
    {
      code: "FOREIGN_KEY_ACTION_DRIFT",
      object: "order.order_parent_fkey",
      database: { onDelete: "RESTRICT", onUpdate: "CASCADE" },
      prisma: { onDelete: "RESTRICT", onUpdate: "NO ACTION" },
    },
  ]);
});

test("summary counts are derived from normalized objects", () => {
  const summary = summarizeStructure({
    models: [{ fields: [{}, {}] }],
    relations: [{}, {}, {}],
    database: {
      tables: [{}],
      columns: [{}, {}],
      constraints: [
        { type: "check" },
        { type: "foreign_key", prismaDeclared: false },
        { type: "foreign_key", prismaDeclared: true },
      ],
      indexes: [
        { isConstraintBacked: false, prismaDeclared: false },
        { isConstraintBacked: false, prismaDeclared: true },
        { isConstraintBacked: true, prismaDeclared: false },
      ],
      enums: [{}],
      functions: [{}, {}],
      triggers: [{}],
    },
    findings: [{}],
  });

  assert.deepEqual(summary, {
    prismaModels: 1,
    prismaPhysicalFields: 2,
    prismaRelations: 3,
    databaseTables: 1,
    databaseColumns: 2,
    postgresEnums: 1,
    checkConstraints: 1,
    prismaUnexpressedIndexes: 1,
    databaseFunctions: 2,
    databaseTriggers: 1,
    prismaUnexpressedForeignKeys: 1,
    findings: 1,
  });
});

test("annotation bootstrap covers every table and physical column as pending", () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });

  assert.deepEqual(Object.keys(annotations.tables), ["public.order"]);
  assert.deepEqual(Object.keys(annotations.fields), ["public.order.id"]);
  assert.equal(annotations.tables["public.order"].nameZh, "待业务确认");
  assert.equal(
    annotations.fields["public.order.id"].purposeZh,
    "业务用途待确认；当前仅确认结构与技术消费者",
  );
  assert.equal(
    annotations.fields["public.order.id"].purposeStatus,
    "needs_business_confirmation",
  );
});

test("annotation validation rejects missing, orphan, untracked, and unsupported confirmed evidence", () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  delete annotations.fields["public.order.id"];
  annotations.fields["public.order.ghost"] = pendingAnnotation();
  annotations.sources.untracked = {
    path: "doc/local-only.md",
    authority: "business",
  };
  annotations.tables["public.order"] = {
    ...annotations.tables["public.order"],
    nameZh: "订单",
    nameStatus: "confirmed_business",
    sourceRefs: ["untracked"],
  };

  assert.deepEqual(
    validateAnnotations({
      annotations,
      structure,
      trackedFiles: new Set(["database/schema.prisma"]),
    }).map(({ code, object }) => `${code}:${object}`),
    [
      "ANNOTATION_FIELD_MISSING:public.order.id",
      "ANNOTATION_FIELD_ORPHAN:public.order.ghost",
      "ANNOTATION_SOURCE_UNTRACKED:untracked",
      "ANNOTATION_CONFIRMED_WITHOUT_ELIGIBLE_SOURCE:public.order:name",
    ],
  );
});

test("dictionary model joins annotations without promoting pending semantics", () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });

  const model = buildDictionaryModel({
    structure,
    annotations,
    trackedFiles: new Set(["database/schema.prisma"]),
  });

  assert.equal(model.tables[0].key, "public.order");
  assert.equal(model.fields[0].key, "public.order.id");
  assert.equal(model.fields[0].nameStatus, "needs_business_confirmation");
  assert.equal(model.statistics.pendingFields, 1);
  assert.equal(model.validationFindings.length, 0);
});

function dictionaryFixture() {
  return buildNormalizedStructure({
    schemaName: "logix_dictionary_tmp_42_12345678abcd4321",
    verifiedThroughMigration: "20261001000000_latest",
    dmmf: {
      datamodel: {
        models: [
          {
            name: "Order",
            dbName: "order",
            fields: [
              { name: "id", kind: "scalar", type: "String", dbName: "id" },
            ],
          },
        ],
      },
    },
    catalog: {
      tables: [{ tableName: "order" }],
      columns: [
        {
          tableName: "order",
          columnName: "id",
          ordinalPosition: 1,
          formattedType: "uuid",
          isNullable: false,
          defaultExpression: null,
          identityKind: "",
          generatedKind: "",
        },
      ],
      constraints: [],
      indexes: [],
      enums: [],
      functions: [],
      triggers: [],
    },
    prismaDdl: { indexNames: new Set(), foreignKeys: [] },
  });
}

function pendingAnnotation() {
  return {
    nameZh: "待业务确认",
    nameStatus: "needs_business_confirmation",
    purposeZh: "业务用途待确认；当前仅确认结构与技术消费者",
    purposeStatus: "needs_business_confirmation",
    sourceRefs: [],
    ownerModule: null,
    workbenchCodes: [],
    sensitivityClass: "pending_policy",
    notes: [],
  };
}

test("CLI rejects a non-loopback database before attempting extraction", () => {
  const scriptPath = fileURLToPath(
    new URL("./generate-data-dictionary.mjs", import.meta.url),
  );
  const result = spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      DICTIONARY_DATABASE_URL:
        "postgresql://logix:logix@production.example.com:5432/logix",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DICTIONARY_DATABASE_NOT_LOOPBACK/);
});
