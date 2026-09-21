export interface ParsedZonedDateTime {
  occurredAt: Date;
  sourceUtcOffset: string;
}

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseZonedDateTime(
  localDateTime: string,
  timeZone: string,
): ParsedZonedDateTime {
  const wallTime = parseWallTime(localDateTime);
  const formatter = createFormatter(timeZone);
  const desiredUtc = asUtc(wallTime);
  let candidate = desiredUtc;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const rendered = readWallTime(formatter, new Date(candidate));
    candidate += desiredUtc - asUtc(rendered);
  }

  const matches: number[] = [];
  for (
    let instant = candidate - 3 * 60 * 60 * 1000;
    instant <= candidate + 3 * 60 * 60 * 1000;
    instant += 15 * 60 * 1000
  ) {
    if (sameWallTime(readWallTime(formatter, new Date(instant)), wallTime)) {
      matches.push(instant);
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? "VALIDATION_FORMAT: 该当地时间在所选时区不存在"
        : "VALIDATION_FIELD_CONFLICT: 该当地时间处于夏令时重复时段，请使用不歧义的时间证据",
    );
  }

  const occurredAt = new Date(matches[0]!);
  const rendered = readWallTime(formatter, occurredAt);
  const offsetMinutes = Math.round(
    (asUtc(rendered) - occurredAt.getTime()) / 60_000,
  );
  return { occurredAt, sourceUtcOffset: offsetLabel(offsetMinutes) };
}

function parseWallTime(value: string): WallTime {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) throw new Error("VALIDATION_FORMAT: 请输入有效的当地日期时间");
  const wallTime = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const roundTrip = new Date(asUtc(wallTime));
  if (
    roundTrip.getUTCFullYear() !== wallTime.year ||
    roundTrip.getUTCMonth() + 1 !== wallTime.month ||
    roundTrip.getUTCDate() !== wallTime.day ||
    roundTrip.getUTCHours() !== wallTime.hour ||
    roundTrip.getUTCMinutes() !== wallTime.minute ||
    roundTrip.getUTCSeconds() !== wallTime.second
  ) {
    throw new Error("VALIDATION_FORMAT: 请输入有效的当地日期时间");
  }
  return wallTime;
}

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    throw new Error("VALIDATION_FORMAT: IANA 时区无效");
  }
}

function readWallTime(formatter: Intl.DateTimeFormat, instant: Date): WallTime {
  const values = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
  };
}

function asUtc(value: WallTime): number {
  return Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
  );
}

function sameWallTime(left: WallTime, right: WallTime): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function offsetLabel(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
