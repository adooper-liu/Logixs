import type { ShipmentRiskSortV1 } from "@logix/contracts";

/**
 * 风险队列的分页与排序键。
 *
 * **游标必须记住排序键**：队列可以换排序，若游标只记位置不记顺序，
 * 用户换一个排序再翻页就会看到重复行或整段漏掉 —— 这是最难在测试里
 * 发现、却最容易在生产上骗人的一类缺陷。
 *
 * 排序值用 `Date | null`：**null 表示该票没有截止**。SQL 侧对应
 * `ORDER BY <deadline> ASC NULLS LAST`，与 `shipment-risk.ts` 里
 * `shipmentRiskSortValue` 返回正无穷是**同一条规则**（没有时限的排最后），
 * 两处改动必须一起动。
 */
export const DEFAULT_SHIPMENT_RISK_SORT: ShipmentRiskSortV1 =
  "nearest_deadline";

export const SHIPMENT_RISK_QUEUE_CURSOR_SCOPE =
  "container.read+lifecycle.read+risk-queue";

/**
 * 可选的排序键。**不含免用箱期** —— 它在本片留了位置但不启用，
 * 列在这里会让人以为系统在盯免箱期（负责人 2026-09-27 定）。
 */
const SHIPMENT_RISK_SORTS = new Set<ShipmentRiskSortV1>([
  "nearest_deadline",
  "eta",
  "task_due",
  "updated_at",
]);

export interface ShipmentRiskCursor {
  tenantId: string;
  sort: ShipmentRiskSortV1;
  /** 参与排序的截止时刻；null = 该票没有截止，排在最后。 */
  sortValue: Date | null;
  id: string;
}

export function parseShipmentRiskSort(
  raw: string | undefined,
): ShipmentRiskSortV1 {
  if (raw === undefined || raw === "") return DEFAULT_SHIPMENT_RISK_SORT;
  if (!SHIPMENT_RISK_SORTS.has(raw as ShipmentRiskSortV1)) {
    throw new Error("VALIDATION_FORMAT: sort");
  }
  return raw as ShipmentRiskSortV1;
}

export function encodeShipmentRiskCursor(
  cursor: ShipmentRiskCursor,
  cursorScope = SHIPMENT_RISK_QUEUE_CURSOR_SCOPE,
): string {
  return Buffer.from(
    JSON.stringify({
      tenantId: cursor.tenantId,
      permissionScope: cursorScope,
      sort: cursor.sort,
      sortValue: cursor.sortValue?.toISOString() ?? null,
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeShipmentRiskCursor(
  raw: string,
  cursorScope = SHIPMENT_RISK_QUEUE_CURSOR_SCOPE,
): ShipmentRiskCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as {
      tenantId?: unknown;
      permissionScope?: unknown;
      sort?: unknown;
      sortValue?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.tenantId !== "string" ||
      parsed.permissionScope !== cursorScope ||
      typeof parsed.sort !== "string" ||
      !SHIPMENT_RISK_SORTS.has(parsed.sort as ShipmentRiskSortV1) ||
      typeof parsed.id !== "string" ||
      !parsed.id ||
      !(parsed.sortValue === null || typeof parsed.sortValue === "string")
    ) {
      invalid();
    }
    let sortValue: Date | null = null;
    if (typeof parsed.sortValue === "string") {
      sortValue = new Date(parsed.sortValue);
      if (Number.isNaN(sortValue.getTime())) invalid();
    }
    return {
      tenantId: parsed.tenantId as string,
      sort: parsed.sort as ShipmentRiskSortV1,
      sortValue,
      id: parsed.id as string,
    };
  } catch {
    invalid();
  }
}

function invalid(): never {
  throw new Error("VALIDATION_FORMAT: cursor");
}
