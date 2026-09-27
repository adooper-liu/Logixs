import { describe, expect, it } from "vitest";
import { poolConfigForSchema } from "./postgres-adapter";

const BASE = "postgresql://logix:logix@localhost:5433/logix?schema=public";

describe("poolConfigForSchema", () => {
  it("carries the schema into the connection's search_path", () => {
    const { connectionString } = poolConfigForSchema(BASE, "it_isolated_1");

    expect(new URL(connectionString).searchParams.get("options")).toBe(
      "-c search_path=it_isolated_1",
    );
  });

  it("keeps the rest of the connection string intact", () => {
    const { connectionString } = poolConfigForSchema(BASE, "it_isolated_1");
    const url = new URL(connectionString);

    expect(url.hostname).toBe("localhost");
    expect(url.port).toBe("5433");
    expect(url.pathname).toBe("/logix");
    expect(url.username).toBe("logix");
    expect(url.searchParams.get("schema")).toBe("public");
  });

  it("appends to options the connection string already declares", () => {
    // pg 让连接串覆盖显式配置，所以这里必须拼接而不是覆盖 —— 否则运维在
    // DATABASE_URL 里加的启动参数会被悄悄丢掉。
    const { connectionString } = poolConfigForSchema(
      `${BASE}&options=${encodeURIComponent("-c statement_timeout=5000")}`,
      "it_isolated_1",
    );

    expect(new URL(connectionString).searchParams.get("options")).toBe(
      "-c statement_timeout=5000 -c search_path=it_isolated_1",
    );
  });

  it("leaves a blank options parameter out of the result", () => {
    const { connectionString } = poolConfigForSchema(
      `${BASE}&options=`,
      "it_isolated_1",
    );

    expect(new URL(connectionString).searchParams.get("options")).toBe(
      "-c search_path=it_isolated_1",
    );
  });

  it("refuses a connection string it cannot rewrite instead of guessing", () => {
    // 非 URL 形式拼不出 search_path；静默沿用默认值正是本模块要消灭的分叉方式。
    expect(() =>
      poolConfigForSchema("host=localhost dbname=logix", "it_isolated_1"),
    ).toThrow("DATABASE_URL_NOT_URL_FORMED");
  });
});
