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
      label: "在线货柜数",
      value: `${containers.length} 柜`,
      supportingText: "当前生命周期投影",
      helpText: "来源：useDemoOperationsStore 的货柜流转记录总数。",
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
        "演示口径：feeRows 中 Demurrage 与 Detention 已有金额之和除以同币种费用总额；合同样本待回验。",
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
      helpText: "来源：异常投影中状态非 verified_closed 的记录数。",
      tone: openExceptionCount > 0 ? "risk" : "ok",
      to: "/dashboard#decision-queue",
    },
  ];
};
