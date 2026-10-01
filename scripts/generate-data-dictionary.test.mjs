import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  EVIDENCE_SLOT_POLICIES,
  pendingDimensions,
} from "./data-dictionary/annotation-status.mjs";
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
  serializeAnnotations,
  summarizeStructure,
  validateAnnotations,
} from "./generate-data-dictionary.mjs";

const LOCAL_URL = "postgresql://logix:logix@localhost:5433/logix";

test("evidence slot policies are the single complete dimension authority", () => {
  assert.deepEqual(
    EVIDENCE_SLOT_POLICIES.map(({ key, appliesTo }) => [key, appliesTo]),
    [
      ["workbenchEvidence", ["table", "field"]],
      ["sensitivityEvidence", ["table", "field"]],
      ["unitSemantic", ["field"]],
      ["currencySemantic", ["field"]],
      ["timezoneSemantic", ["field"]],
      ["snapshotAttribute", ["field"]],
      ["versionAttribute", ["field"]],
      ["auditAttribute", ["field"]],
    ],
  );
});

test("evidence slot matrix rejects contradictory pending and workbench facts", () => {
  const cases = [
    {
      name: "pending workbench with value",
      target: "table",
      key: "workbenchEvidence",
      slot: {
        value: ["invented-wb"],
        status: "needs_business_confirmation",
        sourceRefs: [],
      },
      code: "ANNOTATION_PENDING_WITH_VALUE",
    },
    {
      name: "pending sensitivity with source",
      target: "table",
      key: "sensitivityEvidence",
      slot: {
        value: null,
        status: "needs_business_confirmation",
        sourceRefs: ["business"],
      },
      code: "ANNOTATION_PENDING_WITH_SOURCE",
    },
    {
      name: "workbench contract status with business evidence",
      target: "table",
      key: "workbenchEvidence",
      slot: {
        value: ["market_signals"],
        status: "confirmed_contract",
        sourceRefs: ["business"],
      },
      code: "ANNOTATION_STATUS_INVALID",
    },
    {
      name: "field-only slot on table",
      target: "table",
      key: "unitSemantic",
      slot: {
        value: "kg",
        status: "confirmed_contract",
        sourceRefs: ["contract"],
      },
      code: "ANNOTATION_SLOT_NOT_APPLICABLE",
    },
  ];
  for (const item of cases) {
    const structure = dictionaryFixture();
    const annotations = createPendingAnnotations(structure, {
      baselineCommit: "abc123",
    });
    annotations.sources.business = {
      path: "doc/cross-border-supply-chain/08-role-workbenches.md",
      authority: "business",
    };
    annotations.sources.contract = {
      path: "docs/product/domain/TIME_CURRENCY_REFERENCE_CONTRACT_V1.md",
      authority: "formal_contract",
    };
    const collection =
      item.target === "table" ? annotations.tables : annotations.fields;
    const key = item.target === "table" ? "public.order" : "public.order.id";
    collection[key][item.key] = item.slot;
    const findings = validateAnnotations({
      annotations,
      structure,
      trackedFiles: new Set([
        "doc/cross-border-supply-chain/08-role-workbenches.md",
        "docs/product/domain/TIME_CURRENCY_REFERENCE_CONTRACT_V1.md",
      ]),
    });
    assert.ok(
      findings.some(
        (finding) =>
          finding.code === item.code && finding.object === `${key}:${item.key}`,
      ),
      item.name,
    );
  }

  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.tables["public.order"].unitSemantic = {
    value: "kg",
    status: "confirmed_contract",
    sourceRefs: ["contract"],
  };
  assert.equal(
    "unitSemantic" in serializeAnnotations(annotations).tables["public.order"],
    false,
  );
});

test("root manifest owns workbook dependencies", () => {
  const requireFromRoot = createRequire(
    new URL("../package.json", import.meta.url),
  );
  assert.match(
    requireFromRoot.resolve("exceljs"),
    /node_modules[\\/]exceljs[\\/]/u,
  );
  assert.match(
    requireFromRoot.resolve("jszip"),
    /node_modules[\\/]jszip[\\/]/u,
  );
});

test("pending dimensions include independent table and field evidence", () => {
  const table = pendingAnnotation();
  delete table.unitSemantic;
  delete table.currencySemantic;
  delete table.timezoneSemantic;
  delete table.snapshotAttribute;
  delete table.versionAttribute;
  delete table.auditAttribute;
  table.workbenchEvidence = pendingSlot([]);
  table.sensitivityEvidence = pendingSlot(null);
  assert.deepEqual(pendingDimensions(table, "table"), [
    "name",
    "purpose",
    "workbench",
    "sensitivity",
  ]);

  const field = pendingAnnotation();
  field.workbenchEvidence = pendingSlot([]);
  field.sensitivityEvidence = pendingSlot(null);
  assert.deepEqual(pendingDimensions(field, "field"), [
    "name",
    "purpose",
    "workbench",
    "sensitivity",
    "unit",
    "currency",
    "timezone",
    "snapshot",
    "version",
    "audit",
  ]);
});

test("confirmed evidence slots require meaningful values and their own sources", () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.sources.business = {
    path: "doc/cross-border-supply-chain/08-role-workbenches.md",
    authority: "business",
  };
  annotations.tables["public.order"].workbenchEvidence = {
    value: [],
    status: "confirmed_business",
    sourceRefs: ["business"],
  };
  annotations.tables["public.order"].sensitivityEvidence = {
    value: "",
    status: "confirmed_business",
    sourceRefs: ["business"],
  };
  annotations.fields["public.order.id"].currencySemantic = {
    value: null,
    status: "confirmed_contract",
    sourceRefs: ["business"],
  };

  assert.deepEqual(
    validateAnnotations({
      annotations,
      structure,
      trackedFiles: new Set([
        "doc/cross-border-supply-chain/08-role-workbenches.md",
      ]),
    })
      .filter(({ code }) => code === "ANNOTATION_CONFIRMED_EMPTY_VALUE")
      .map(({ object }) => object),
    [
      "public.order:workbenchEvidence",
      "public.order:sensitivityEvidence",
      "public.order.id:currencySemantic",
    ],
  );
});

test("workbench confirmation accepts only business authority", () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.sources.contract = {
    path: "docs/product/domain/TARGET_FIELD_CATALOG.md",
    authority: "formal_contract",
  };
  annotations.tables["public.order"].workbenchEvidence = {
    value: ["orders-wb"],
    status: "confirmed_contract",
    sourceRefs: ["contract"],
  };

  assert.ok(
    validateAnnotations({
      annotations,
      structure,
      trackedFiles: new Set(["docs/product/domain/TARGET_FIELD_CATALOG.md"]),
    }).some(
      (finding) =>
        finding.code === "ANNOTATION_STATUS_INVALID" &&
        finding.object === "public.order:workbenchEvidence",
    ),
  );
});

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

test("Prisma DDL parser records complete column shape", () => {
  const parsed = parsePrismaDdl(`
    CREATE TABLE "order" (
      "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "amount" DECIMAL(18, 3) NOT NULL
    );
  `);

  assert.deepEqual(parsed.columns, [
    {
      tableName: "order",
      columnName: "amount",
      formattedType: "DECIMAL(18, 3)",
      isNullable: false,
      hasDefault: false,
      defaultExpression: null,
      isList: false,
    },
    {
      tableName: "order",
      columnName: "created_at",
      formattedType: "TIMESTAMPTZ",
      isNullable: false,
      hasDefault: true,
      defaultExpression: "CURRENT_TIMESTAMP",
      isList: false,
    },
    {
      tableName: "order",
      columnName: "tags",
      formattedType: "TEXT[]",
      isNullable: true,
      hasDefault: true,
      defaultExpression: "ARRAY[]::TEXT[]",
      isList: true,
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

test("normalization reports field type, nullability, arity, and default drift", () => {
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
              {
                name: "amount",
                kind: "scalar",
                type: "Int",
                dbName: "amount",
                isRequired: false,
                isList: false,
                hasDefaultValue: false,
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
          columnName: "amount",
          ordinalPosition: 1,
          formattedType: "text[]",
          isNullable: false,
          defaultExpression: "ARRAY[]::text[]",
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
      "FIELD_TYPE_DRIFT:order.amount",
      "FIELD_NULLABILITY_DRIFT:order.amount",
      "FIELD_ARITY_DRIFT:order.amount",
      "FIELD_DEFAULT_DRIFT:order.amount",
    ],
  );
});

test("normalization treats PostgreSQL type aliases as equivalent", () => {
  const aliases = [
    ["TIMESTAMPTZ", "timestamp with time zone"],
    ["TIMESTAMP(3)", "timestamp(3) without time zone"],
    ["CHAR(2)", "character(2)"],
  ];
  for (const [prismaType, databaseType] of aliases) {
    const input = dictionaryFixtureInput();
    input.catalog.columns[0].formattedType = databaseType;
    input.prismaDdl.columns = [
      {
        tableName: "order",
        columnName: "id",
        formattedType: prismaType,
        isNullable: false,
        hasDefault: false,
        defaultExpression: null,
        isList: false,
      },
    ];
    assert.deepEqual(buildNormalizedStructure(input).findings, []);
  }
});

test("normalization reports native type precision and simple default value drift", () => {
  const input = dictionaryFixtureInput();
  input.dmmf.datamodel.models[0].fields[0] = {
    name: "amount",
    kind: "scalar",
    type: "Decimal",
    dbName: "amount",
  };
  input.catalog.columns[0] = {
    ...input.catalog.columns[0],
    columnName: "amount",
    formattedType: "numeric(18,4)",
    defaultExpression: "1",
  };
  input.prismaDdl.columns = [
    {
      tableName: "order",
      columnName: "amount",
      formattedType: "DECIMAL(18, 3)",
      isNullable: false,
      hasDefault: true,
      defaultExpression: "0",
      isList: false,
    },
  ];

  const structure = buildNormalizedStructure(input);

  assert.deepEqual(
    structure.findings.map(({ code, object }) => `${code}:${object}`),
    [
      "FIELD_NATIVE_TYPE_DRIFT:order.amount",
      "FIELD_DEFAULT_VALUE_DRIFT:order.amount",
    ],
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

test("normalization rejects duplicate catalog object keys", () => {
  const input = dictionaryFixtureInput();
  input.catalog.indexes = [
    {
      tableName: "order",
      indexName: "order_pkey",
      isConstraintBacked: true,
      definition: "CREATE UNIQUE INDEX order_pkey ON order USING btree (id)",
    },
    {
      tableName: "order",
      indexName: "order_pkey",
      isConstraintBacked: false,
      definition: "CREATE UNIQUE INDEX order_pkey ON order USING btree (id)",
    },
  ];

  assert.throws(
    () => buildNormalizedStructure(input),
    /DUPLICATE_INDEX_KEY:order\.order_pkey/,
  );
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

test("technical enrichment confirms only contract-backed currency and timezone semantics", () => {
  const structure = dictionaryFixture();
  for (const [columnName, ordinalPosition] of [
    ["price_currency", 2],
    ["timezone", 3],
    ["source_version", 4],
  ]) {
    structure.database.columns.push({
      tableName: "order",
      columnName,
      ordinalPosition,
      formattedType: "text",
      isNullable: true,
      defaultExpression: null,
      identityKind: "",
      generatedKind: "",
    });
  }
  const annotations = enrichTechnicalAnnotations(
    createPendingAnnotations(structure, { baselineCommit: "abc123" }),
    structure,
  );

  assert.deepEqual(
    annotations.fields["public.order.price_currency"].currencySemantic,
    {
      value: "ISO 4217 货币代码",
      status: "confirmed_contract",
      sourceRefs: ["time-currency-contract"],
    },
  );
  assert.deepEqual(
    annotations.fields["public.order.timezone"].timezoneSemantic,
    {
      value: "IANA 时区标识",
      status: "confirmed_contract",
      sourceRefs: ["time-currency-contract"],
    },
  );
  assert.deepEqual(
    annotations.fields["public.order.source_version"].versionAttribute,
    pendingSlot(),
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

test("annotation bootstrap preserves independently reviewed auxiliary metadata", () => {
  const structure = dictionaryFixture();
  const existing = createPendingAnnotations(structure, {
    baselineCommit: "old",
  });
  existing.sources.review = {
    path: "docs/product/domain/TARGET_FIELD_CATALOG.md",
    authority: "formal_contract",
  };
  existing.tables["public.order"] = {
    ...existing.tables["public.order"],
    sourceRefs: ["review"],
    moduleCode: "orders",
    ownerModule: "orders-owner",
    workbenchEvidence: {
      value: ["orders-wb"],
      status: "confirmed_contract",
      sourceRefs: ["review"],
    },
    sensitivityEvidence: {
      value: "restricted",
      status: "confirmed_contract",
      sourceRefs: ["review"],
    },
    notes: ["reviewed independently"],
  };

  const merged = mergeAnnotationCoverage({
    existing,
    structure,
    baselineCommit: "new",
  });
  const annotation = merged.tables["public.order"];

  assert.equal(annotation.nameStatus, "needs_business_confirmation");
  assert.equal(annotation.purposeStatus, "needs_business_confirmation");
  assert.deepEqual(annotation.sourceRefs, ["review"]);
  assert.equal(annotation.moduleCode, "orders");
  assert.equal(annotation.ownerModule, "orders-owner");
  assert.deepEqual(annotation.workbenchEvidence, {
    value: ["orders-wb"],
    status: "confirmed_contract",
    sourceRefs: ["review"],
  });
  assert.deepEqual(annotation.sensitivityEvidence, {
    value: "restricted",
    status: "confirmed_contract",
    sourceRefs: ["review"],
  });
  assert.deepEqual(annotation.notes, ["reviewed independently"]);
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

test("annotation validation derives authority from eligible paths and validates logical references", () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.sources.fakeBusiness = {
    path: "apps/web/src/Fake.vue",
    authority: "business",
  };
  annotations.tables["public.order"] = {
    ...annotations.tables["public.order"],
    nameZh: "订单",
    nameStatus: "confirmed_business",
    sourceRefs: ["fakeBusiness"],
  };
  annotations.logicalReferences.push({
    sourceTable: "order",
    sourceFields: ["missing_id"],
    targetTable: "missing_target",
    targetFields: ["id"],
    name: "guessed-reference",
    sourceRefs: [],
  });

  assert.deepEqual(
    validateAnnotations({
      annotations,
      structure,
      trackedFiles: new Set(["apps/web/src/Fake.vue"]),
    }).map(({ code, object }) => `${code}:${object}`),
    [
      "ANNOTATION_SOURCE_AUTHORITY_MISMATCH:fakeBusiness",
      "ANNOTATION_CONFIRMED_WITHOUT_ELIGIBLE_SOURCE:public.order:name",
      "LOGICAL_REFERENCE_SOURCE_FIELD_MISSING:guessed-reference:order.missing_id",
      "LOGICAL_REFERENCE_TARGET_TABLE_MISSING:guessed-reference:missing_target",
      "LOGICAL_REFERENCE_EVIDENCE_MISSING:guessed-reference",
    ],
  );
});

test("field semantic slots stay independent and require eligible evidence", () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.fields["public.order.id"].unitSemantic = {
    value: "kg",
    status: "confirmed_contract",
    sourceRefs: [],
  };

  const findings = validateAnnotations({
    annotations,
    structure,
    trackedFiles: new Set(),
  });
  assert.deepEqual(findings, [
    {
      code: "ANNOTATION_CONFIRMED_WITHOUT_ELIGIBLE_SOURCE",
      object: "public.order.id:unitSemantic",
    },
  ]);

  const model = buildDictionaryModel({
    structure,
    annotations: createPendingAnnotations(structure, {
      baselineCommit: "abc123",
    }),
    trackedFiles: new Set(),
  });
  for (const field of [
    "unitSemantic",
    "currencySemantic",
    "timezoneSemantic",
    "snapshotAttribute",
    "versionAttribute",
    "auditAttribute",
  ]) {
    assert.deepEqual(model.fields[0][field], {
      value: null,
      status: "needs_business_confirmation",
      sourceRefs: [],
    });
  }
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
  annotations.tables["public.order"].moduleCode = "orders";
  annotations.tables["public.order"].ownerModule = "order-owner";
  annotations.tables["public.order"].workbenchEvidence = {
    value: ["orders-wb"],
    status: "confirmed_business",
    sourceRefs: ["workbench"],
  };
  annotations.sources.workbench = {
    path: "doc/cross-border-supply-chain/08-role-workbenches.md",
    authority: "business",
    note: "workbench",
  };
  annotations.sources.schema = {
    path: "database/schema.prisma",
    authority: "implementation",
    note: "schema",
  };
  const model = buildDictionaryModel({
    structure,
    annotations,
    trackedFiles: new Set([
      "doc/cross-border-supply-chain/08-role-workbenches.md",
    ]),
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
  assert.equal(fieldSheet.rowCount, model.fields.length + 1);
  assert.equal(fieldSheet.views[0].state, "frozen");
  const fieldHeaders = fieldSheet.getRow(1).values;
  for (const header of [
    "单位语义证据",
    "币种语义证据",
    "时区语义证据",
    "快照属性证据",
    "版本属性证据",
    "审计属性证据",
  ]) {
    assert.ok(fieldHeaders.includes(header), `${header} must be present`);
  }
  assert.equal(fieldSheet.autoFilter, "A1:AE2");
  assert.ok(
    fieldSheet.getRow(1).values.includes("建议中文名"),
    "review columns must be present",
  );
  const noteColumn = fieldSheet
    .getRow(1)
    .values.findIndex((value) => value === "备注");
  assert.equal(fieldSheet.getRow(2).getCell(noteColumn).value, "'=unsafe");
  const moduleSheet = workbook.getWorksheet("01_模块汇总");
  assert.deepEqual(moduleSheet.getRow(1).values.slice(1), [
    "模块",
    "技术所有者",
    "工作台",
    "表数",
    "字段数",
    "待确认表",
    "待确认字段",
  ]);
  assert.deepEqual(moduleSheet.getRow(2).values.slice(1), [
    "orders",
    "order-owner",
    "orders-wb",
    1,
    1,
    1,
    1,
  ]);
  const sourceSheet = workbook.getWorksheet("09_来源追溯");
  assert.ok(sourceSheet.getRow(1).values.includes("基线提交"));
  assert.equal(sourceSheet.getRow(2).values.at(-1), "abc123");
  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) =>
      row.eachCell((cell) => assert.equal(cell.type === 6, false)),
    );
  }
});

test("source trace counts logical references as consumer objects", async () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.sources.contract = {
    path: "docs/product/domain/CROSS_MODULE_REFERENCE_CONTRACT_V1.md",
    authority: "formal_contract",
    note: "logical reference",
  };
  annotations.logicalReferences.push({
    sourceTable: "order",
    sourceFields: ["id"],
    targetTable: "order",
    targetFields: ["id"],
    name: "order-self-reference",
    sourceRefs: ["contract"],
  });
  const model = buildDictionaryModel({
    structure,
    annotations,
    trackedFiles: new Set([
      "docs/product/domain/CROSS_MODULE_REFERENCE_CONTRACT_V1.md",
    ]),
  });
  const workbook = await loadWorkbook(
    await renderWorkbook(model, {
      fixedDate: new Date("2026-10-01T00:00:00.000Z"),
    }),
  );
  const sourceSheet = workbook.getWorksheet("09_来源追溯");
  const rows = sourceSheet.getSheetValues();
  const contractRow = rows.find((row) => row?.[1] === "contract");

  assert.equal(contractRow[5], 1);
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

test("annotation artifact stores field evidence slots sparsely while model restores defaults", async () => {
  const structure = dictionaryFixture();
  const annotations = createPendingAnnotations(structure, {
    baselineCommit: "abc123",
  });
  annotations.fields["public.order.id"].currencySemantic = {
    value: "USD",
    status: "confirmed_contract",
    sourceRefs: ["contract"],
  };
  annotations.sources.contract = {
    path: "docs/product/domain/TIME_CURRENCY_REFERENCE_CONTRACT_V1.md",
    authority: "formal_contract",
  };
  const artifacts = await buildDictionaryArtifacts({
    structure,
    annotations,
    trackedFiles: new Set([
      "docs/product/domain/TIME_CURRENCY_REFERENCE_CONTRACT_V1.md",
    ]),
    fixedDate: new Date("2026-10-01T00:00:00.000Z"),
  });
  const stored = JSON.parse(artifacts["dictionary.annotations.json"]);
  const storedField = stored.fields["public.order.id"];

  assert.deepEqual(storedField.currencySemantic, {
    value: "USD",
    status: "confirmed_contract",
    sourceRefs: ["contract"],
  });
  for (const field of [
    "unitSemantic",
    "timezoneSemantic",
    "snapshotAttribute",
    "versionAttribute",
    "auditAttribute",
  ]) {
    assert.equal(field in storedField, false, `${field} should stay derived`);
  }
  assert.equal("unitSemantic" in stored.tables["public.order"], false);
  assert.equal("workbenchEvidence" in stored.tables["public.order"], false);
  assert.equal("sensitivityEvidence" in stored.tables["public.order"], false);
  assert.equal("workbenchEvidence" in storedField, false);
  assert.equal("sensitivityEvidence" in storedField, false);

  const restored = mergeAnnotationCoverage({
    existing: stored,
    structure,
    baselineCommit: "abc123",
  });
  assert.deepEqual(
    restored.fields["public.order.id"].unitSemantic,
    pendingSlot(),
  );
  assert.deepEqual(
    restored.tables["public.order"].workbenchEvidence,
    pendingSlot([]),
  );
  assert.deepEqual(
    restored.fields["public.order.id"].sensitivityEvidence,
    pendingSlot(),
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
  const require = createRequire(import.meta.url);
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

async function workbookEntryDates(buffer) {
  const require = createRequire(import.meta.url);
  const JSZip = require("jszip");
  const archive = await JSZip.loadAsync(buffer);
  return Object.values(archive.files).map((entry) => entry.date);
}

function dictionaryFixture() {
  return buildNormalizedStructure(dictionaryFixtureInput());
}

function dictionaryFixtureInput() {
  return {
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
  };
}

function pendingAnnotation() {
  return {
    nameZh: "待业务确认",
    nameStatus: "needs_business_confirmation",
    purposeZh: "业务用途待确认；当前仅确认结构与技术消费者",
    purposeStatus: "needs_business_confirmation",
    sourceRefs: [],
    moduleCode: null,
    ownerModule: null,
    workbenchEvidence: pendingSlot([]),
    sensitivityEvidence: pendingSlot(),
    unitSemantic: pendingSlot(),
    currencySemantic: pendingSlot(),
    timezoneSemantic: pendingSlot(),
    snapshotAttribute: pendingSlot(),
    versionAttribute: pendingSlot(),
    auditAttribute: pendingSlot(),
    notes: [],
  };
}

function pendingSlot(value = null) {
  return {
    value,
    status: "needs_business_confirmation",
    sourceRefs: [],
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
