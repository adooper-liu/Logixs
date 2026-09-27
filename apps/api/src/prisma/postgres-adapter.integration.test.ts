// 「schema 怎么进 SQL」这条不变量的守卫。
//
// Prisma 7 的 driver adapter 下，schema 要同时告诉两条互不相通的路径：适配器
// 的 `{ schema }` 选项（管 Prisma 模型查询）和连接的 `search_path`（管裸 SQL）。
// 少设一半**不会报错**，只会让两条路径查不同的 schema —— 生产 `public` 里表都
// 在，看起来一切正常，直到某次翻页悄悄丢行。
//
// 这里把它做成机器可检的断言：在一个非 public 的 schema 上，模型查询与裸 SQL
// 必须看到同一批数据，且连接串里已有的 `options` 不被吞掉。
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../../../../generated/prisma";
import { createPostgresAdapter } from "./postgres-adapter";

const BASE_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://logix:logix@localhost:5433/logix?schema=public";
const schemaName = `it_pg_adapter_${process.pid}_${randomUUID().replaceAll("-", "")}`;
const testDatabaseUrl = withSchema(BASE_DATABASE_URL, schemaName);
const publicDatabaseUrl = withSchema(BASE_DATABASE_URL, "public");

let client: PrismaClient;
let admin: PrismaClient;

beforeAll(async () => {
  admin = new PrismaClient({
    adapter: createPostgresAdapter(publicDatabaseUrl, "public"),
  });
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
  // 只建 Prisma 读这张表真正用到的列：`count()` 不引用任何列，够用且跑得快。
  await admin.$executeRawUnsafe(
    `CREATE TABLE "${schemaName}"."reference_data_release" ("id" uuid PRIMARY KEY)`,
  );
  await admin.$executeRawUnsafe(
    `INSERT INTO "${schemaName}"."reference_data_release" ("id") VALUES ($1)`,
    randomUUID(),
  );

  client = new PrismaClient({
    adapter: createPostgresAdapter(testDatabaseUrl, schemaName),
  });
});

afterAll(async () => {
  await client?.$disconnect();
  try {
    await admin?.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`,
    );
  } finally {
    await admin?.$disconnect();
  }
});

describe("createPostgresAdapter", () => {
  it("把配置的 schema 落到连接的 search_path 上", async () => {
    const rows =
      await client.$queryRawUnsafe<{ search_path: string }[]>(
        "SHOW search_path",
      );

    expect(rows[0]?.search_path).toBe(schemaName);
  });

  it("模型查询落在配置的 schema 上，而不是默认的 public", async () => {
    // public 里也有这张表（迁移建过），所以"落在 public 上"不会报错 ——
    // 只会在数据上说不通。这一条就是在拦这个。
    await expect(client.referenceDataRelease.count()).resolves.toBe(1);
  });

  it("裸 SQL 与模型查询看到同一批数据", async () => {
    const [{ n }] = await client.$queryRawUnsafe<{ n: number }[]>(
      'SELECT count(*)::int AS n FROM "reference_data_release"',
    );

    expect(n).toBe(await client.referenceDataRelease.count());
  });

  it("不吞掉连接串里已有的启动参数", async () => {
    // pg 的 ConnectionParameters 让连接串覆盖显式配置，所以 search_path 只能
    // 拼进连接串；拼错方向会把运维加的 options 悄悄丢掉。
    const withOptions = new PrismaClient({
      adapter: createPostgresAdapter(
        `${testDatabaseUrl}&options=${encodeURIComponent("-c statement_timeout=5000")}`,
        schemaName,
      ),
    });
    try {
      const [{ statement_timeout: timeout }] =
        await withOptions.$queryRawUnsafe<{ statement_timeout: string }[]>(
          "SHOW statement_timeout",
        );
      const [{ n }] = await withOptions.$queryRawUnsafe<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM "reference_data_release"',
      );

      expect(timeout).toBe("5s");
      expect(n).toBe(1);
    } finally {
      await withOptions.$disconnect();
    }
  });
});

function withSchema(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}
