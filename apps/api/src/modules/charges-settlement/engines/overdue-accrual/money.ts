const AMOUNT_PATTERN = /^\d+\.\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export type MoneyReject = {
  kind: "reject";
  code: "BUSINESS_PRECONDITION_FAILED";
  message: string;
};

export function parseMinorUnits(
  amount: string,
): { kind: "ok"; cents: bigint } | MoneyReject {
  if (!AMOUNT_PATTERN.test(amount)) {
    return {
      kind: "reject",
      code: "BUSINESS_PRECONDITION_FAILED",
      message: "金额必须是两位小数的定点十进制",
    };
  }
  const [whole, fraction] = amount.split(".");
  return {
    kind: "ok",
    cents: BigInt(whole) * 100n + BigInt(fraction),
  };
}

export function formatMinorUnits(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  return `${negative ? "-" : ""}${whole.toString()}.${fraction.toString().padStart(2, "0")}`;
}

export function isIsoCurrency(value: string): boolean {
  return CURRENCY_PATTERN.test(value);
}
