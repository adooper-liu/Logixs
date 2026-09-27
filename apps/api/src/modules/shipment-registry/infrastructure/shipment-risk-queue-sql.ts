import type { ShipmentRiskSortV1 } from "@logix/contracts";
import { OPEN_EXCEPTION_STATUSES } from "../domain/shipment-risk";

/**
 * 风险队列的取页 SQL。
 *
 * 为什么是裸 SQL：排序值是 `min(预计到港, 最早未完成工单截止)` —— 跨三跳的聚合，
 * Prisma 的 `orderBy` 表达不了，而 keyset 分页要求"排序"和"取下一页"用同一个
 * 表达式。**本模块产出的每条 SQL 都靠连接的 `search_path` 落到目标 schema**
 * （见 `apps/api/src/prisma/postgres-adapter.ts`），因此这里**不写 schema 前缀**。
 *
 * 同一条查询里把**排序用的事实**和**展示用的事实**一起取出来（截止、异常计数），
 * 是为了让"它为什么排在这"和"它排在第几"出自同一份数据 —— 分两次查会各自算一遍
 * 截止，两边一旦有出入，界面就会把一票的理由说成另一票的。
 *
 * 三条最容易出错的地方，都有测试盯着：
 * 1. **排序键只从白名单取**，任何用户输入都走 `$n` 参数，不拼进文本；
 * 2. **keyset 三分支 + `NULLS LAST`**：漏掉"无截止那一尾"会让翻页悄悄丢行；
 * 3. **三跳里租户经 `node_task` 限定** —— `work_order` 没有 `tenant_id`。
 */

/**
 * 每个 Shipment 的未完成工单聚合。三跳：
 * `shipment → shipment_container_link → node_task → work_order`。
 *
 * `node_task.container_id` 是逻辑引用（无跨模块外键），`work_order` **没有**
 * `tenant_id` —— 租户只能经 `node_task` 限定。少写这一层会跨租户串数据。
 *
 * 用 LATERAL 而不是把子查询重复进排序表达式：每条 Shipment 只算一次。
 */
const OPEN_TASK_AGGREGATE = `
  JOIN LATERAL (
    SELECT
      min(w."due_at") AS "earliest_task_due",
      count(*) AS "open_task_count"
    FROM "shipment_container_link" scl
    JOIN "node_task" nt
      ON nt."container_id" = scl."container_record_id"
     AND nt."tenant_id" = scl."tenant_id"
    JOIN "work_order" w
      ON w."node_task_id" = nt."id"
     AND w."state" <> 'completed'
    WHERE scl."shipment_id" = s."id"
      AND scl."tenant_id" = s."tenant_id"
      AND scl."state" = 'active'
      AND scl."superseded_at" IS NULL
  ) q ON true`;

/**
 * 本票名下未解决的异常案件数。
 * `OperationalExceptionCase.shipmentId` 是真实外键，直接挂到票。
 */
const OWN_EXCEPTION_COUNT = `(
    SELECT count(*) FROM "operational_exception_case" e
    WHERE e."shipment_id" = s."id"
      AND e."tenant_id" = s."tenant_id"
      AND e."status" IN (${quoteLiterals(OPEN_EXCEPTION_STATUSES)})
  )::int`;

/**
 * 挂在**本票的在链货柜**上、却**没有落到票**的未解决案件数。
 *
 * 这些案件 `shipment_id` 为空，按票聚合时天然看不见 —— 单独计数正是为了不让
 * 它们被当成"没有异常"（任务书：必须如实说明）。与上一项按 `shipment_id` 是否
 * 为空切开，不会重复计数。
 */
const UNASSIGNED_EXCEPTION_COUNT = `(
    SELECT count(*) FROM "operational_exception_case" e
    JOIN "shipment_container_link" scl
      ON scl."container_record_id" = e."container_record_id"
     AND scl."tenant_id" = e."tenant_id"
    WHERE scl."shipment_id" = s."id"
      AND scl."tenant_id" = s."tenant_id"
      AND scl."state" = 'active'
      AND scl."superseded_at" IS NULL
      AND e."shipment_id" IS NULL
      AND e."status" IN (${quoteLiterals(OPEN_EXCEPTION_STATUSES)})
  )::int`;

/**
 * 缺口：与本票的一次**已接管**交接相比，还缺的业务事实。
 *
 * 这一段是 `listPendingCompletion` 里那组 Prisma 条件的 SQL 版 —— 同一业务口径的
 * 两份实现（查询语言不同，无法共用代码）。**两者若分叉，队列与待补列表会互相
 * 矛盾**，所以集成测试里有一条对拍专门盯这个；改动任何一边都要同时改另一边。
 */
const HAS_PENDING_GAP = `(
      EXISTS (
        SELECT 1 FROM "shipment_handoff_record" h
        WHERE h."shipment_id" = s."id"
          AND h."tenant_id" = s."tenant_id"
          AND h."status" IN ('accepted', 'superseded')
      )
      AND (
        s."carrier_code" IS NULL
        OR s."vessel_name" IS NULL
        OR s."voyage_number" IS NULL
        OR s."origin_unlocode" IS NULL
        OR s."destination_unlocode" IS NULL
        OR s."atd_at" IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM "shipment_cargo_line" cl
          WHERE cl."shipment_id" = s."id"
            AND cl."tenant_id" = s."tenant_id"
            AND cl."state" = 'active'
            AND cl."superseded_at" IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM "shipment_cargo_line" cl
          WHERE cl."shipment_id" = s."id"
            AND cl."tenant_id" = s."tenant_id"
            AND cl."state" = 'active'
            AND cl."superseded_at" IS NULL
            AND cl."product_sku_id" IS NULL
        )
        OR NOT EXISTS (
          SELECT 1 FROM "shipment_transport_document" d
          WHERE d."shipment_id" = s."id"
            AND d."tenant_id" = s."tenant_id"
            AND d."state" = 'active'
            AND d."superseded_at" IS NULL
            AND d."document_type" IN ('mbl', 'hbl')
        )
      )
    )`;

/**
 * 「有事可做」——队列只收这些票。
 *
 * 只有一条到港时间、既无待办也无缺口和异常的票**不进队列**：到港时间是事实，
 * 不是待办，把它排进首屏就是替业务编造紧迫度（任务书验收项）。
 */
const HAS_SOMETHING_TO_DO = `(
    q."open_task_count" > 0
    OR ${OWN_EXCEPTION_COUNT} > 0
    OR ${UNASSIGNED_EXCEPTION_COUNT} > 0
    OR ${HAS_PENDING_GAP}
  )`;

/** 排序键 → 排序表达式。**只从这里取**，外部输入永不参与拼接。 */
const SORT_EXPRESSIONS: Record<ShipmentRiskSortV1, string> = {
  // LEAST 忽略 NULL：两条截止只有一条时取那一条，都没有才算没有截止。
  nearest_deadline: `LEAST(s."eta_at", q."earliest_task_due")`,
  eta: `s."eta_at"`,
  task_due: `q."earliest_task_due"`,
  updated_at: `s."updated_at"`,
};

/**
 * 方向按语义固定：截止类升序（最快的排最前），最近更新降序。
 * 「可选方向」不在本片（契约 `ShipmentRiskSortV1` 里没有方向字段）。
 */
const SORT_DIRECTIONS: Record<ShipmentRiskSortV1, "ASC" | "DESC"> = {
  nearest_deadline: "ASC",
  eta: "ASC",
  task_due: "ASC",
  updated_at: "DESC",
};

export interface RiskQueueSqlInput {
  tenantId: string;
  sort: ShipmentRiskSortV1;
  after?: { sortValue: Date | null; id: string };
  take: number;
}

export interface RiskQueueSql {
  text: string;
  values: unknown[];
}

export interface RiskQueueSqlRow {
  id: string;
  sortValue: Date | null;
  etaAt: Date | null;
  taskDueAt: Date | null;
  openExceptionCount: number;
  unassignedExceptionCount: number;
}

export function buildRiskQueueSql(input: RiskQueueSqlInput): RiskQueueSql {
  const expression = SORT_EXPRESSIONS[input.sort];
  const direction = SORT_DIRECTIONS[input.sort];
  const values: unknown[] = [input.tenantId];
  const keyset = input.after
    ? buildKeyset(expression, direction, input.after, values)
    : "";
  values.push(input.take);

  return {
    text: `SELECT
  s."id" AS "id",
  ${expression} AS "sortValue",
  s."eta_at" AS "etaAt",
  q."earliest_task_due" AS "taskDueAt",
  ${OWN_EXCEPTION_COUNT} AS "openExceptionCount",
  ${UNASSIGNED_EXCEPTION_COUNT} AS "unassignedExceptionCount"
FROM "shipment" s${OPEN_TASK_AGGREGATE}
WHERE s."tenant_id" = $1
  AND ${HAS_SOMETHING_TO_DO}${keyset}
ORDER BY ${expression} ${direction} NULLS LAST, s."id" ASC
LIMIT $${values.length}`,
    values,
  };
}

/**
 * keyset 谓词。`NULLS LAST` 让"没有截止"的票排在最后，所以游标落在哪一段，
 * 后续行的形状不同：
 * - 游标有值 → 值更大的、值相同但 id 更大的，**外加整个"无截止"尾段**；
 * - 游标为 `null` → 只在"无截止"尾段里取 id 更大的。
 *
 * 降序键（最近更新）比较方向反过来。漏掉任何一种情形都会让翻页重复或丢行。
 */
function buildKeyset(
  expression: string,
  direction: "ASC" | "DESC",
  after: { sortValue: Date | null; id: string },
  values: unknown[],
): string {
  const cursorValue = `$${values.push(after.sortValue)}::timestamptz`;
  const cursorId = `$${values.push(after.id)}`;
  const comparison = direction === "ASC" ? ">" : "<";

  return `
  AND (
    CASE
      WHEN ${cursorValue} IS NULL
        THEN ${expression} IS NULL AND s."id" > ${cursorId}
      ELSE (${expression} ${comparison} ${cursorValue})
        OR (${expression} = ${cursorValue} AND s."id" > ${cursorId})
        OR (${expression} IS NULL)
    END
  )`;
}

/**
 * 把本模块自己的常量数组拼成 SQL 字面量列表。**只用于代码里写死的枚举**
 * （`OPEN_EXCEPTION_STATUSES`），绝不用于任何外部输入 —— 外部值一律走 `$n`。
 */
function quoteLiterals(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}
