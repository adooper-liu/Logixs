import { describe, expect, it } from "vitest";
import type { ImportRow } from "../domain/import-batch";
import {
  collectImportTimeFacts,
  normalizeSourceDateTime,
} from "./import-time-facts";

const mappings = [
  ["实际清关日期", "customsClearanceActualAt"],
  ["清关状态", "customsClearanceStatus"],
  ["来源系统", "timeSourceSystem"],
  ["权威系统", "timeAuthoritySystem"],
  ["UTC偏移", "timeSourceUtcOffset"],
  ["证据ID", "timeEvidenceRef"],
].map(([column, fieldCode]) => ({ column, fieldCode }));

function row(values: Record<string, string>): ImportRow {
  return { id: "row-1", rowNo: 1, values };
}

describe("import time facts", () => {
  it("按来源 UTC 偏移把原始本地时刻标准化为 UTC", () => {
    expect(
      normalizeSourceDateTime("2026-04-09 22:58:00", "+02:00")?.toISOString(),
    ).toBe("2026-04-09T20:58:00.000Z");
  });

  it("拒绝日期-only、未知偏移和显式偏移冲突", () => {
    expect(normalizeSourceDateTime("2026-04-09", "+02:00")).toBeNull();
    expect(
      normalizeSourceDateTime("2026-04-09 22:58:00", "Europe/Madrid"),
    ).toBeNull();
    expect(
      normalizeSourceDateTime("2026-04-09T22:58:00+01:00", "+02:00"),
    ).toBeNull();
  });

  it("形成保留原值、偏移、UTC、来源、状态和证据的 actual 事实", () => {
    const facts = collectImportTimeFacts(
      [
        row({
          实际清关日期: "2026-04-09 22:58:00",
          清关状态: "已完成",
          来源系统: "legacy-lms",
          权威系统: "customs-authority",
          UTC偏移: "+02:00",
          证据ID: "11111111-1111-4111-8111-111111111111",
        }),
      ],
      mappings,
    );

    expect(facts).toEqual([
      expect.objectContaining({
        factCode: "customs_clearance_completed",
        timeKind: "actual",
        captureSource: "controlled_import",
        rawValue: "2026-04-09 22:58:00",
        sourceUtcOffset: "+02:00",
        occurredAtUtc: new Date("2026-04-09T20:58:00.000Z"),
        sourceSystem: "legacy-lms",
        authoritySystem: "customs-authority",
        nodeCode: "customs_clearance",
        mappingVersion: "1.3.0",
        sourceStatus: "已完成",
        evidenceRef: "11111111-1111-4111-8111-111111111111",
      }),
    ]);
  });
});
