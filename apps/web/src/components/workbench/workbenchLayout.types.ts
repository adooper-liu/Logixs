export type WorkbenchPaneId = "queue" | "detail" | "context";
export type WorkbenchMobileScreen = WorkbenchPaneId;
export type WorkbenchTone = "neutral" | "info" | "ok" | "warn" | "risk";

export interface WorkbenchResponsibilityItem {
  label: string;
  value: string | null;
  state: "known" | "unknown" | "not-applicable";
}

export type WorkbenchPaneState =
  | { kind: "ready" }
  | { kind: "loading"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string; traceId?: string }
  | { kind: "receipt"; message: string };
