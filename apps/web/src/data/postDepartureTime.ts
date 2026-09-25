const LOCAL_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const SOURCE_US_DATETIME_PATTERN =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const SOURCE_ISO_DATETIME_PATTERN =
  /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export const POST_DEPARTURE_TIMEZONES = [
  ["Asia/Shanghai", "中国标准时间 · Asia/Shanghai"],
  ["America/Los_Angeles", "美国西部 · America/Los_Angeles"],
  ["America/New_York", "美国东部 · America/New_York"],
  ["America/Toronto", "加拿大东部 · America/Toronto"],
  ["Europe/London", "英国 · Europe/London"],
  ["Europe/Berlin", "德国 · Europe/Berlin"],
  ["Europe/Paris", "法国 · Europe/Paris"],
  ["Europe/Rome", "意大利 · Europe/Rome"],
  ["Europe/Madrid", "西班牙 · Europe/Madrid"],
  ["Europe/Dublin", "爱尔兰 · Europe/Dublin"],
  ["Europe/Bucharest", "罗马尼亚 · Europe/Bucharest"],
] as const;

export function zonedLocalDateTimeToIso(
  localDateTime: string,
  timeZone: string,
): string {
  const parts = parseLocalDateTime(localDateTime);
  assertTimeZone(timeZone);
  const [year, month, day, hour, minute, second, millisecond] = parts;
  const localAsUtc = Date.UTC(
    year!,
    month! - 1,
    day!,
    hour!,
    minute!,
    second,
    millisecond,
  );
  let instant = localAsUtc - offsetAt(localAsUtc, timeZone);
  instant = localAsUtc - offsetAt(instant, timeZone);
  if (!matchesLocalParts(instant, timeZone, parts)) {
    throw new Error("该时间在所选时区不存在，请检查夏令时切换");
  }
  return new Date(instant).toISOString();
}

export function normalizeLocalDateTimeInput(value: string): string {
  if (!value) return "";
  const [year, month, day, hour, minute, second, millisecond] =
    parseLocalDateTime(value);
  const base = `${pad(year!)}-${pad(month!)}-${pad(day!)}T${pad(hour!)}:${pad(minute!)}`;
  if (millisecond) {
    return `${base}:${pad(second)}.${String(millisecond).padStart(3, "0")}`;
  }
  return second ? `${base}:${pad(second)}` : base;
}

export function sourceDepartureRawToLocalInput(
  sourceValue: string | undefined,
): string {
  const value = sourceValue?.trim();
  if (!value) return "";
  const usMatch = SOURCE_US_DATETIME_PATTERN.exec(value);
  const isoMatch = SOURCE_ISO_DATETIME_PATTERN.exec(value);
  const parts = usMatch
    ? [usMatch[3], usMatch[1], usMatch[2], ...usMatch.slice(4)]
    : isoMatch?.slice(1);
  if (!parts) return "";
  const [year, month, day, hour, minute, second = 0] = parts.map((part) =>
    Number(part ?? 0),
  );
  if (!validDateTimeParts([year!, month!, day!, hour!, minute!, second])) {
    return "";
  }
  return `${pad(year!)}-${pad(month!)}-${pad(day!)}T${pad(hour!)}:${pad(minute!)}`;
}

function parseLocalDateTime(value: string): number[] {
  const match = LOCAL_DATETIME_PATTERN.exec(value);
  if (!match) throw new Error("请输入完整的实际离港日期和时间");
  const parts = match.slice(1, 7).map((part) => Number(part ?? 0));
  const millisecond = Number((match[7] ?? "").padEnd(3, "0") || "0");
  const result = [...parts, millisecond];
  if (!validDateTimeParts(result)) {
    throw new Error("请输入有效的实际离港日期和时间");
  }
  return result;
}

function validDateTimeParts(parts: number[]): boolean {
  const [year, month, day, hour, minute, second = 0, millisecond = 0] = parts;
  const date = new Date(
    Date.UTC(year!, month! - 1, day!, hour!, minute!, second, millisecond),
  );
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second &&
    date.getUTCMilliseconds() === millisecond
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function assertTimeZone(timeZone: string): void {
  if (!timeZone || /^(?:GMT|UTC)[+-]/i.test(timeZone)) {
    throw new Error("请选择来源所在地时区");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error("请选择有效的来源所在地时区");
  }
}

function offsetAt(instant: number, timeZone: string): number {
  const values = formattedParts(instant, timeZone);
  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ) -
    Math.floor(instant / 1000) * 1000
  );
}

function matchesLocalParts(
  instant: number,
  timeZone: string,
  expected: number[],
): boolean {
  const actual = formattedParts(instant, timeZone);
  const localPartsMatch = [
    actual.year,
    actual.month,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second,
  ].every((value, index) => value === (expected[index] ?? 0));
  const millisecond = ((instant % 1000) + 1000) % 1000;
  return localPartsMatch && millisecond === (expected[6] ?? 0);
}

function formattedParts(instant: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(instant))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );
  return values as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}
