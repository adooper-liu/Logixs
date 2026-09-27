import { PrismaPg } from "@prisma/adapter-pg";

/**
 * PostgreSQL 适配器的**唯一**构造入口。
 *
 * Prisma 7 + driver adapter 下，schema 要同时告诉两条互不相通的路径，否则它们
 * 会**静默分叉**：
 *
 * | 路径                        | schema 从哪来                                       |
 * | --------------------------- | --------------------------------------------------- |
 * | Prisma 模型查询             | 适配器的 `{ schema }` 选项（不给就写死 `public`）   |
 * | `$queryRaw` / `$executeRaw` | 连接的 `search_path`（缺省 `"$user", public`）      |
 *
 * 裸 SQL **不认**适配器选项；适配器选项也**不认**连接串里的 `?schema=`（那个
 * 只有 `prisma migrate` 之类的 CLI 认）。分叉时不会报错 —— 只是查错 schema，
 * 而生产 `public` 里表都在，看起来一切正常。
 *
 * 所以这里把两者绑成一次调用：调用方拿不到"只设一半"的机会。
 *
 * `search_path` 写进**连接串的 `options`**，而不是 `PoolConfig.options`：`pg` 的
 * `ConnectionParameters` 用 `Object.assign({}, config, parse(connectionString))`
 * 组装连接配置，**连接串里的值会覆盖显式配置** —— 放 `PoolConfig` 里会被连接串
 * 中已有的 `options` 悄悄顶掉。写进连接串则与已有的 `options` 拼接，互不覆盖。
 */
export function createPostgresAdapter(
  connectionString: string,
  schema: string,
): PrismaPg {
  return new PrismaPg(poolConfigForSchema(connectionString, schema), {
    schema,
  });
}

export function poolConfigForSchema(
  connectionString: string,
  schema: string,
): { connectionString: string } {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // 明确失败：解析不了就拼不出 `search_path`，硬走默认值会让两条路径分叉，
    // 而这正是本模块要消灭的失败方式。
    throw new Error("DATABASE_URL_NOT_URL_FORMED");
  }
  const declared = url.searchParams.get("options")?.trim();
  const searchPath = `-c search_path=${schema}`;
  url.searchParams.set(
    "options",
    declared ? `${declared} ${searchPath}` : searchPath,
  );
  return { connectionString: url.toString() };
}
