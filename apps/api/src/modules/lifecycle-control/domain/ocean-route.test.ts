import { describe, expect, it } from "vitest";
import {
  hashOceanRouteCommand,
  normalizeOceanRouteCommand,
} from "./ocean-route";

const command = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  containerId: "22222222-2222-4222-8222-222222222222",
  segments: [
    {
      transportMode: "vessel" as const,
      originUnlocode: "cnngb",
      originTimezone: "Asia/Shanghai",
      destinationLocationType: "port" as const,
      destinationUnlocode: "sgsin",
      destinationTimezone: "Asia/Singapore",
    },
    {
      transportMode: "feeder" as const,
      originUnlocode: "sgsin",
      originTimezone: "Asia/Singapore",
      destinationLocationType: "port" as const,
      destinationUnlocode: "uslax",
      destinationTimezone: "America/Los_Angeles",
    },
  ],
  ingestionChannel: "api" as const,
  sourceSystem: "carrier.route-api",
  evidenceRefs: ["33333333-3333-4333-8333-333333333333"],
  expectedVersion: 0,
  idempotencyKey: "route:booking-1:v1",
  traceId: "trace-1",
};

describe("normalizeOceanRouteCommand", () => {
  it("规范化 UN/LOCODE 并保留连续航段", () => {
    const normalized = normalizeOceanRouteCommand(command);
    expect(normalized.segments.map((item) => item.originUnlocode)).toEqual([
      "CNNGB",
      "SGSIN",
    ]);
    expect(normalized.segments.at(-1)?.destinationUnlocode).toBe("USLAX");
    expect(hashOceanRouteCommand(normalized)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("幂等载荷不受 Application 授权上下文影响", () => {
    const withRuntimeContext = normalizeOceanRouteCommand({
      ...command,
      actorCapabilities: ["lifecycle.operate"],
    } as typeof command & { actorCapabilities: string[] });
    expect(hashOceanRouteCommand(withRuntimeContext)).toBe(
      hashOceanRouteCommand(normalizeOceanRouteCommand(command)),
    );
    expect(withRuntimeContext).not.toHaveProperty("actorCapabilities");
  });

  it("拒绝前后不连续的航段", () => {
    expect(() =>
      normalizeOceanRouteCommand({
        ...command,
        segments: [
          command.segments[0],
          { ...command.segments[1], originUnlocode: "CNSHA" },
        ],
      }),
    ).toThrow("VALIDATION_FIELD_CONFLICT");
    expect(() =>
      normalizeOceanRouteCommand({
        ...command,
        segments: [
          command.segments[0],
          { ...command.segments[1], originTimezone: "Etc/UTC" },
        ],
      }),
    ).toThrow("港口或时区不连续");
  });

  it("拒绝无 IANA 时区和无身份的码头目的地", () => {
    expect(() =>
      normalizeOceanRouteCommand({
        ...command,
        segments: [{ ...command.segments[0], originTimezone: "UTC+8" }],
      }),
    ).toThrow("不是有效 IANA 时区");
    expect(() =>
      normalizeOceanRouteCommand({
        ...command,
        segments: [
          {
            ...command.segments[0],
            destinationLocationType: "terminal",
          },
        ],
      }),
    ).toThrow("码头缺少有效 locationId");
  });

  it("人工入口必须携带操作者和原因", () => {
    expect(() =>
      normalizeOceanRouteCommand({
        ...command,
        ingestionChannel: "manual_ui",
      }),
    ).toThrow("人工路线更新缺少操作者或原因");
  });
});
