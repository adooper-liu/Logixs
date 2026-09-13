import type { ContainerProjection, ExceptionRecord, Tone } from "./sample";

export type KpiSignalKey =
  "online" | "risk" | "feeExposure" | "pendingSync" | "openExceptions";

export interface KpiSignal {
  key: KpiSignalKey;
  label: string;
  value: string;
  supportingText: string;
  helpText: string;
  tone: Exclude<Tone, "muted"> | "brand";
  to: string;
}

interface FeeProjection {
  type: string;
  amount: string;
}

interface KpiProjectionInput {
  containers: readonly ContainerProjection[];
  fees: readonly FeeProjection[];
  exceptions: readonly ExceptionRecord[];
}

interface MoneyInMinorUnits {
  currency: string;
  amount: number;
}

const parseMoney = (value: string): MoneyInMinorUnits | null => {
  const match = /^([A-Z]{3})\s+(\d+)\.(\d{2})$/.exec(value.trim());
  if (!match) return null;

  return {
    currency: match[1],
    amount: Number(match[2]) * 100 + Number(match[3]),
  };
};

const formatMinorUnits = (amount: number) =>
  `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;

const createFeeExposure = (fees: readonly FeeProjection[]) => {
  const parsed = fees
    .map((fee) => ({ ...fee, money: parseMoney(fee.amount) }))
    .filter(
      (fee): fee is FeeProjection & { money: MoneyInMinorUnits } =>
        fee.money !== null,
    );
  const currencies = new Set(parsed.map((fee) => fee.money.currency));
  if (parsed.length === 0 || currencies.size !== 1) {
    return {
      value: "—",
      supportingText: "暂无可同币种汇总的金额",
    };
  }

  const total = parsed.reduce((sum, fee) => sum + fee.money.amount, 0);
  const exposed = parsed
    .filter((fee) => ["Demurrage", "Detention"].includes(fee.type))
    .reduce((sum, fee) => sum + fee.money.amount, 0);
  const currency = parsed[0].money.currency;

  return {
    value: total > 0 ? `${Math.round((exposed * 100) / total)}%` : "—",
    supportingText:
      total > 0
        ? `${currency} ${formatMinorUnits(exposed)} / ${formatMinorUnits(total)}`
        : "暂无可汇总的费用金额",
  };
};

export const createKpiSignals = ({
  containers,
  fees,
  exceptions,
}: KpiProjectionInput): KpiSignal[] => {
  const riskCount = containers.filter((row) => row.tone === "risk").length;
  const pendingSyncCount = containers.filter(
    (row) => !["committed", "idle"].includes(row.syncStatus.code),
  ).length;
  const openExceptionCount = exceptions.filter(
    (row) => row.status !== "verified_closed",
  ).length;
  const feeExposure = createFeeExposure(fees);

  return [
    {
      key: "online",
      label: "货柜",
      value: `${containers.length} 柜`,
      supportingText: "去干活",
      helpText: "当前租户已经记下的货柜数量。",
      tone: "brand",
      to: "/containers",
    },
    {
      key: "risk",
      label: "高风险货柜数",
      value: `${riskCount} 柜`,
      supportingText: "进入风险货柜列表",
      helpText: "来源：货柜投影中 tone 为 risk 的记录数。",
      tone: riskCount > 0 ? "risk" : "ok",
      to: "/containers?filter=risk",
    },
    {
      key: "feeExposure",
      label: "滞箱滞港费用占比",
      value: feeExposure.value,
      supportingText: feeExposure.supportingText,
      helpText:
        "口径：同币种费用中滞箱与滞港金额之和除以总额。没有费用数据时不展示。",
      tone: feeExposure.value === "—" ? "info" : "warn",
      to: "/meso?dimension=fees#fees",
    },
    {
      key: "pendingSync",
      label: "待服务器确认数",
      value: `${pendingSyncCount} 项`,
      supportingText: pendingSyncCount ? "尚未计入完成事实" : "全部已落账",
      helpText:
        "来源：货柜同步状态非 committed 或 idle 的记录数；请求已接收不等于结果已落账。",
      tone: pendingSyncCount > 0 ? "warn" : "ok",
      to: "/tasks",
    },
    {
      key: "openExceptions",
      label: "未关闭异常数",
      value: `${openExceptionCount} 项`,
      supportingText: "进入待决策队列",
      helpText: "尚未关闭的异常数量。没有异常数据时不展示。",
      tone: openExceptionCount > 0 ? "risk" : "ok",
      to: "/dashboard#decision-queue",
    },
  ];
};

export function createWorkspaceOverviewSignals(
  containers: readonly ContainerProjection[],
  options?: { syncReady?: boolean },
): KpiSignal[] {
  const signals = createKpiSignals({
    containers,
    fees: [],
    exceptions: [],
  }).filter((signal) => signal.key === "online");
  if (options?.syncReady !== true) return signals;

  const pending = containers.filter(
    (row) => !["committed", "idle"].includes(row.syncStatus.code),
  ).length;
  if (pending === 0) return signals;

  return [
    ...signals,
    {
      key: "pendingSync",
      label: "还没记下",
      value: `${pending} 柜`,
      supportingText: "去看提交",
      helpText:
        "最近一页提交里，这些柜最新一次还没落账。不是全库总数。请求已收到不等于已经记下。",
      tone: "warn",
      to: "/real-operations",
    },
  ];
}
