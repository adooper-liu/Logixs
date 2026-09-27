import { describe, expect, it } from "vitest";
import type { ShipmentRiskSortV1 } from "@logix/contracts";
import { buildRiskQueueSql } from "./shipment-risk-queue-sql";

const TENANT = "11111111-1111-1111-1111-111111111111";
const SORTS: ShipmentRiskSortV1[] = [
  "nearest_deadline",
  "eta",
  "task_due",
  "updated_at",
];

function build(
  overrides: Partial<Parameters<typeof buildRiskQueueSql>[0]> = {},
) {
  return buildRiskQueueSql({
    tenantId: TENANT,
    sort: "nearest_deadline",
    take: 11,
    ...overrides,
  });
}

describe("buildRiskQueueSql 参数化", () => {
  it("把租户当成参数传，不拼进 SQL 文本", () => {
    const hostile = `x'; DROP TABLE shipment; --`;
    const { text, values } = build({ tenantId: hostile });

    expect(text).not.toContain(hostile);
    expect(text).not.toContain("DROP TABLE");
    expect(values).toContain(hostile);
  });

  it("take 与租户按 $1/$2... 顺序对应", () => {
    const { text, values } = build({ take: 7 });

    expect(text).toContain('s."tenant_id" = $1');
    expect(text).toContain("LIMIT $2");
    expect(values).toEqual([TENANT, 7]);
  });

  it("游标值进参数，不拼进文本", () => {
    const raw = "2026-01-01T00:00:00.000Z";
    const { text, values } = build({
      after: { sortValue: new Date(raw), id: "abc" },
    });

    expect(text).not.toContain(raw);
    expect(values).toContain("abc");
    expect(values).toContainEqual(new Date(raw));
  });
});

describe("buildRiskQueueSql 每个排序键的形状", () => {
  it.each(SORTS)("%s 的排序表达式来自白名单且以 s.id 兜底", (sort) => {
    const { text } = build({ sort });

    expect(text).toMatch(/ORDER BY .+, s\."id" ASC\s*LIMIT/);
  });

  it("截止类按升序、无截止排最后；最近更新按降序", () => {
    expect(build({ sort: "nearest_deadline" }).text).toContain(
      'ORDER BY LEAST(s."eta_at", q."earliest_task_due") ASC NULLS LAST',
    );
    expect(build({ sort: "eta" }).text).toContain(
      'ORDER BY s."eta_at" ASC NULLS LAST',
    );
    expect(build({ sort: "task_due" }).text).toContain(
      'ORDER BY q."earliest_task_due" ASC NULLS LAST',
    );
    expect(build({ sort: "updated_at" }).text).toContain(
      'ORDER BY s."updated_at" DESC NULLS LAST',
    );
  });

  it("任务截止走 shipment → container_link → node_task → work_order 三跳", () => {
    const { text } = build({ sort: "task_due" });

    expect(text).toContain('FROM "shipment_container_link" scl');
    expect(text).toContain('JOIN "node_task" nt');
    expect(text).toContain('JOIN "work_order" w');
  });

  it("三跳里租户经 node_task 限定，因为 work_order 没有 tenant_id", () => {
    const { text } = build({ sort: "task_due" });

    expect(text).toContain('nt."tenant_id" = scl."tenant_id"');
    expect(text).not.toMatch(/w\."tenant_id"/);
  });
});

describe("buildRiskQueueSql 游标", () => {
  it("没有游标时不生成 keyset 条件", () => {
    const { text, values } = build();

    expect(text).not.toContain("$2::timestamptz");
    expect(values).toEqual([TENANT, 11]);
  });

  it("游标值非空时，取严格大于的下一段，并带上无截止那一尾", () => {
    const { text } = build({
      after: { sortValue: new Date("2026-01-01T00:00:00.000Z"), id: "a" },
    });

    // 有截止的：值更大，或值相同但 id 更大；无截止的排在最后，全部跟在后面。
    expect(text).toMatch(/IS NULL\s+THEN/);
    expect(text).toMatch(/\$2::timestamptz/);
    expect(text).toMatch(/> \$2::timestamptz/);
    expect(text).toMatch(/= \$2::timestamptz AND s\."id" > \$3/);
    expect(text).toContain("IS NULL)");
    expect(text).toContain("LIMIT $4");
  });

  it("游标落在无截止那一尾时，只取 id 更大的行", () => {
    const { text, values } = build({ after: { sortValue: null, id: "a" } });

    expect(text).toMatch(/IS NULL\s+THEN[\s\S]+IS NULL AND s\."id" > \$3/);
    expect(text).toContain("LIMIT $4");
    expect(values).toEqual([TENANT, null, "a", 11]);
  });

  it("降序排序键的比较方向跟着反过来", () => {
    const { text } = build({
      sort: "updated_at",
      after: { sortValue: new Date("2026-01-01T00:00:00.000Z"), id: "a" },
    });

    expect(text).toMatch(/< \$2::timestamptz/);
  });
});
