import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertSafeExtractionTarget,
  buildDictionaryArtifacts,
  buildDictionaryModel,
  buildNormalizedStructure,
  compareGeneratedArtifacts,
  createPendingAnnotations,
  enrichTechnicalAnnotations,
  mergeAnnotationCoverage,
  createTemporarySchemaName,
  parseCommand,
  parsePrismaModelComments,
  parsePrismaDdl,
  renderDataDictionaryMarkdown,
  renderNativeObjectsMarkdown,
  renderWorkbook,
  resolveAnnotationBaseline,
  summarizeStructure,
  validateAnnotations,
} from "./generate-data-dictionary.mjs";

const LOCAL_URL = "postgresql://logix:logix@localhost:5433/logix";

test("CLI parser exposes one explicit dictionary action", () => {
  assert.deepEqual(parseCommand([]), { action: "summary", json: false });
  assert.deepEqual(parseCommand(["--json"]), { action: "summary", json: true });
  assert.deepEqual(parseCommand(["--bootstrap-annotations"]), {
    action: "bootstrap",
    json: false,
  });
  assert.deepEqual(parseCommand(["--generate"]), {
    action: "generate",
    json: false,
  });
  assert.deepEqual(parseCommand(["--check"]), {
    action: "check",
    json: false,
  });
  assert.throws(
    () => parseCommand(["--generate", "--check"]),
    /DICTIONARY_ACTION_CONFLICT/,
  );
  assert.throws(() => parseCommand(["--unknown"]), /UNKNOWN_ARGUMENT/);
});

test("Prisma model comments provide implementation-confirmed table descriptions", () => {
  const comments = parsePrismaModelComments(`
// 可售 SKU 发布的不可变交接快照。身份齐备即可发布。
model ProductIdentityRelease {
  id String @id
  @@map("product_identity_release")
}

// 事项交接（shipment-registry 拥有）：出运运营把票级事项交给专业岗位队列。
// 只到岗位不到人。
model ShipmentWorkHandoff {
  id String @id
  @@map("shipment_work_handoff")
}
  `);

  assert.deepEqual(comments, {
    product_identity_release: {
      nameZh: "可售 SKU 发布",
      purposeZh: "可售 SKU 发布的不可变交接快照。身份齐备即可发布。",
      ownerModule: null,
    },
    shipment_work_handoff: {
      nameZh: "事项交接",
      purposeZh:
        "事项交接（shipment-registry 拥有）：出运运营把票级事项交给专业岗位队列。 只到岗位不到人。",
      ownerModule: "shipment-registry",
    },
  });
});

test("generation reuses annotation baseline while bootstrap advances it", () => {
  const existing = { baselineCommit: "source-baseline" };
  assert.equal(
    resolveAnnotationBaseline({
      action: "generate",
      existing,
      currentCommit: "working-head",
    }),
    "source-baseline",
  );
  assert.equal(
    resolveAnnotationBaseline({
      action: "bootstrap",
      existing,
      currentCommit: "working-head",
    }),
    "working-head",
  );
});

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

test("dictionary model separates physical foreign keys from Prisma relations", () => {
  const structure = dictionaryFixture();
  structure.database.constraints.push({
    tableName: "order",
    constraintName: "order_parent_fkey",
    type: "foreign_key",
    columnNames: ["id"],
    referencedTableName: "parent",
    referencedColumnNames: ["id"],
    prismaDeclared: false,
  });
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });

  const model = buildDictionaryModel({
    structure,
    annotations,
    trackedFiles: new Set(),
  });

  assert.deepEqual(model.relations, [
    {
      relationType: "physical_fk",
      sourceTable: "order",
      sourceFields: ["id"],
      targetTable: "parent",
      targetFields: ["id"],
      name: "order_parent_fkey",
      prismaDeclared: false,
    },
  ]);
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

test("technical enrichment documents only stable cross-table meanings", () => {
  const structure = dictionaryFixture();
  structure.database.columns.push(
    {
      tableName: "order",
      columnName: "tenant_id",
      ordinalPosition: 2,
      formattedType: "text",
      isNullable: false,
      defaultExpression: null,
      identityKind: "",
      generatedKind: "",
    },
    {
      tableName: "order",
      columnName: "status",
      ordinalPosition: 3,
      formattedType: "text",
      isNullable: false,
      defaultExpression: null,
      identityKind: "",
      generatedKind: "",
    },
  );
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });

  const enriched = enrichTechnicalAnnotations(annotations, structure);

  assert.equal(enriched.fields["public.order.tenant_id"].nameZh, "租户标识");
  assert.equal(
    enriched.fields["public.order.tenant_id"].nameStatus,
    "confirmed_implementation",
  );
  assert.deepEqual(enriched.fields["public.order.tenant_id"].sourceRefs, [
    "engineering-data-governance",
  ]);
  assert.equal(
    enriched.fields["public.order.status"].nameStatus,
    "needs_business_confirmation",
  );
});

test("annotation bootstrap applies Prisma model comments without overriding reviewed values", () => {
  const structure = dictionaryFixture();
  const merged = mergeAnnotationCoverage({
    existing: null,
    structure,
    baselineCommit: "new",
    tableDescriptions: {
      order: {
        nameZh: "订单",
        purposeZh: "订单技术事实。",
        ownerModule: "orders",
      },
    },
  });

  assert.equal(merged.tables["public.order"].nameZh, "订单");
  assert.equal(
    merged.tables["public.order"].nameStatus,
    "confirmed_implementation",
  );
  assert.equal(merged.tables["public.order"].ownerModule, "orders");
  assert.deepEqual(merged.tables["public.order"].sourceRefs, ["prisma-schema"]);
  assert.equal(merged.sources["prisma-schema"].path, "database/schema.prisma");
});

test("annotation bootstrap replaces old pending placeholders with new evidence", () => {
  const structure = dictionaryFixture();
  const existing = createPendingAnnotations(structure, {
    baselineCommit: "old",
  });
  const merged = mergeAnnotationCoverage({
    existing,
    structure,
    baselineCommit: "new",
    tableDescriptions: {
      order: {
        nameZh: "订单",
        purposeZh: "订单技术事实。",
        ownerModule: "orders",
      },
    },
  });

  assert.equal(merged.tables["public.order"].nameZh, "订单");
  assert.equal(
    merged.tables["public.order"].nameStatus,
    "confirmed_implementation",
  );
});

test("artifact generation keeps the explicit annotation baseline", async () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "source-baseline",
  });

  const artifacts = await buildDictionaryArtifacts({
    structure,
    annotations,
    trackedFiles: new Set(),
    fixedDate: new Date("2026-10-01T00:00:00.000Z"),
  });

  assert.match(
    artifacts["DATA_DICTIONARY.generated.md"],
    /baselineCommit: `source-baseline`/,
  );
  assert.equal(
    JSON.parse(artifacts["dictionary.annotations.json"]).baselineCommit,
    "source-baseline",
  );
});

test("annotation bootstrap preserves reviewed values and adds new fields", () => {
  const structure = dictionaryFixture();
  const existing = createPendingAnnotations(structure, {
    baselineCommit: "old",
  });
  existing.tables["public.order"].nameZh = "订单事实";
  existing.tables["public.order"].nameStatus = "confirmed_contract";
  existing.sources.contract = {
    path: "docs/product/domain/ORDER.md",
    authority: "formal_contract",
  };
  existing.tables["public.order"].sourceRefs = ["contract"];
  structure.database.columns.push({
    tableName: "order",
    columnName: "created_at",
    ordinalPosition: 2,
    formattedType: "timestamp with time zone",
    isNullable: false,
    defaultExpression: "now()",
    identityKind: "",
    generatedKind: "",
  });

  const merged = mergeAnnotationCoverage({
    existing,
    structure,
    baselineCommit: "new",
  });

  assert.equal(merged.tables["public.order"].nameZh, "订单事实");
  assert.equal(merged.baselineCommit, "new");
  assert.ok(merged.fields["public.order.created_at"]);
  assert.equal(
    merged.fields["public.order.created_at"].nameStatus,
    "confirmed_implementation",
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

test("Markdown projections come from the normalized dictionary model", () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  const model = buildDictionaryModel({
    structure,
    annotations,
    trackedFiles: new Set(),
  });

  const dictionary = renderDataDictionaryMarkdown(model);
  const nativeObjects = renderNativeObjectsMarkdown(model);

  assert.match(
    dictionary,
    /Generated by scripts\/generate-data-dictionary\.mjs/,
  );
  assert.match(dictionary, /public\.order\.id/);
  assert.match(dictionary, /待业务确认/);
  assert.match(dictionary, /needs_business_confirmation/);
  assert.match(nativeObjects, /原生对象清单/);
  assert.match(nativeObjects, /verifiedThroughMigration/);
  assert.equal(dictionary.endsWith("\n\n"), false);
  assert.equal(nativeObjects.endsWith("\n\n"), false);
});

test("workbook has ten reviewable sheets and stable bytes", async () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.fields["public.order.id"].notes = ["=unsafe"];
  const model = buildDictionaryModel({
    structure,
    annotations,
    trackedFiles: new Set(),
  });
  const fixedDate = new Date("2026-10-01T00:00:00.000Z");

  const first = await renderWorkbook(model, { fixedDate });
  const second = await renderWorkbook(model, { fixedDate });

  assert.deepEqual(first, second);
  const workbook = await loadWorkbook(first);
  const entryDates = await workbookEntryDates(first);
  assert.ok(entryDates.length > 0);
  assert.ok(
    entryDates.every((date) => date.getTime() === fixedDate.getTime()),
    "every XLSX zip entry must use the fixed baseline time",
  );
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    [
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
    ],
  );
  const fieldSheet = workbook.getWorksheet("03_字段清单");
  assert.equal(fieldSheet.views[0].state, "frozen");
  assert.equal(fieldSheet.autoFilter, "A1:Y2");
  assert.ok(
    fieldSheet.getRow(1).values.includes("建议中文名"),
    "review columns must be present",
  );
  const noteColumn = fieldSheet
    .getRow(1)
    .values.findIndex((value) => value === "备注");
  assert.equal(fieldSheet.getRow(2).getCell(noteColumn).value, "'=unsafe");
  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) =>
      row.eachCell((cell) => assert.equal(cell.type === 6, false)),
    );
  }
});

test("artifact builder creates four projections from one model", async () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.sources.schema = {
    path: "database/schema.prisma",
    authority: "implementation",
  };
  annotations.tables["public.order"].sourceRefs = ["schema"];

  const artifacts = await buildDictionaryArtifacts({
    structure,
    annotations,
    trackedFiles: new Set(["database/schema.prisma"]),
    fixedDate: new Date("2026-10-01T00:00:00.000Z"),
  });

  assert.deepEqual(Object.keys(artifacts), [
    "dictionary.annotations.json",
    "DATA_DICTIONARY.generated.md",
    "NATIVE_OBJECTS.generated.md",
    "database-data-dictionary.xlsx",
  ]);
  assert.match(artifacts["DATA_DICTIONARY.generated.md"], /public\.order\.id/);
  assert.ok(Buffer.isBuffer(artifacts["database-data-dictionary.xlsx"]));
  const prettier = await import("prettier");
  assert.equal(
    artifacts["dictionary.annotations.json"],
    await prettier.format(artifacts["dictionary.annotations.json"], {
      parser: "json",
    }),
  );
});

test("artifact comparison reports drift without writing", () => {
  const expected = {
    "a.md": "expected\n",
    "b.xlsx": Buffer.from([1, 2, 3]),
  };
  const committed = {
    "a.md": "changed\n",
    "b.xlsx": Buffer.from([1, 2, 4]),
  };

  assert.deepEqual(compareGeneratedArtifacts({ expected, committed }), [
    { path: "a.md", state: "changed" },
    { path: "b.xlsx", state: "changed" },
  ]);
  assert.equal(committed["a.md"], "changed\n");
});

async function loadWorkbook(buffer) {
  const { createRequire } = await import("node:module");
  const { resolve } = await import("node:path");
  const requireFromApi = createRequire(resolve("apps/api/package.json"));
  const ExcelJS = requireFromApi("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

async function workbookEntryDates(buffer) {
  const { createRequire } = await import("node:module");
  const { resolve } = await import("node:path");
  const requireFromApi = createRequire(resolve("apps/api/package.json"));
  const exceljsPackage = requireFromApi.resolve("exceljs/package.json");
  const requireFromExcel = createRequire(exceljsPackage);
  const JSZip = requireFromExcel("jszip");
  const archive = await JSZip.loadAsync(buffer);
  return Object.values(archive.files).map((entry) => entry.date);
}

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
