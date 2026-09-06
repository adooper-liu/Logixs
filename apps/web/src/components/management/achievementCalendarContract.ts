export type AchievementCalendarDimension = "month" | "week" | "day";

export interface AchievementCalendarColumn {
  key: string;
  label: string;
  isCurrent?: boolean;
}

export interface AchievementCalendarRow {
  stage: string;
  tone: "ok" | "warn" | "risk";
  values: Readonly<Record<string, string>>;
}

export interface AchievementCalendarView {
  columns: readonly AchievementCalendarColumn[];
  rows: readonly AchievementCalendarRow[];
}
