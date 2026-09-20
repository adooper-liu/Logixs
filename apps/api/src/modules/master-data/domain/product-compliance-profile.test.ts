import { describe, expect, it } from "vitest";
import {
  normalizeReplaceProductComplianceProfileCommand,
  ProductComplianceProfileCommandError,
  type ReplaceProductComplianceProfileCommand,
} from "./product-compliance-profile";

const baseCommand: ReplaceProductComplianceProfileCommand = {
  tenantId: "tenant-a",
  productSkuId: "11111111-1111-4111-8111-111111111111",
  expectedProfileVersion: 0,
  battery: {
    presenceState: "present",
    chemistryCode: "lithium_ion",
    modelNumber: "BAT-1",
    cellCount: 4,
    batteryCount: 1,
    wattHours: "98.000",
    removable: true,
    packingMode: "contained_in_equipment",
  },
  refrigerant: { presenceState: "absent" },
  dangerousGoods: {
    classificationState: "regulated",
    unNumber: "UN3481",
    properShippingName: "Lithium ion batteries contained in equipment",
    hazardClass: "9",
    marinePollutant: false,
  },
  inspectionRequirements: [
    {
      requirementType: "commodity_inspection",
      requirementState: "required",
      jurisdictionCountryCode: "cn",
    },
  ],
  certificates: [
    {
      certificateKey: "un38-3-main",
      certificateType: "un38_3",
      certificateNumber: "UN38-3-001",
      issuerName: "Qualified Laboratory",
      coverageScope: "countries",
      coveredCountryCodes: ["US", "CN", "US"],
      validFrom: "2026-01-01",
      validUntil: "2027-01-01",
      documentRecordId: "22222222-2222-4222-8222-222222222222",
      verificationState: "verified",
    },
  ],
  ingestionChannel: "manual_ui",
  sourceSystem: "logix-web",
  evidenceRefs: ["evidence:b", "evidence:a", "evidence:a"],
  verificationState: "verified",
  actorId: "user-1",
  reasonCode: "initial_capture",
  idempotencyKey: "manual:profile:1",
};

describe("Product compliance profile command", () => {
  it("归一化结构化档案并生成稳定载荷哈希", () => {
    const normalized =
      normalizeReplaceProductComplianceProfileCommand(baseCommand);
    const reordered = normalizeReplaceProductComplianceProfileCommand({
      ...baseCommand,
      evidenceRefs: [...baseCommand.evidenceRefs].reverse(),
      certificates: [
        {
          ...baseCommand.certificates[0]!,
          coveredCountryCodes: ["CN", "US"],
        },
      ],
    });

    expect(normalized.battery.wattHours).toBe("98");
    expect(normalized.certificates[0]?.coveredCountryCodes).toEqual([
      "CN",
      "US",
    ]);
    expect(normalized.inspectionRequirements[0]?.jurisdictionCountryCode).toBe(
      "CN",
    );
    expect(normalized.evidenceRefs).toEqual(["evidence:a", "evidence:b"]);
    expect(normalized.payloadHash).toBe(reordered.payloadHash);
  });

  it("明确无或未知时拒绝残留专业参数", () => {
    expect(() =>
      normalizeReplaceProductComplianceProfileCommand({
        ...baseCommand,
        battery: { presenceState: "absent", chemistryCode: "lithium_ion" },
      }),
    ).toThrow(ProductComplianceProfileCommandError);
  });

  it("明确含制冷剂时要求完整运输参数", () => {
    expect(() =>
      normalizeReplaceProductComplianceProfileCommand({
        ...baseCommand,
        refrigerant: {
          presenceState: "present",
          refrigerantCode: "R290",
          chargeQuantity: "0.1",
          chargeUnit: "kg",
        },
      }),
    ).toThrow("VALIDATION_REQUIRED: refrigerant present details");
  });

  it("危险品必须使用合法 UN 编号并保留闪点负值", () => {
    expect(() =>
      normalizeReplaceProductComplianceProfileCommand({
        ...baseCommand,
        dangerousGoods: {
          classificationState: "regulated",
          unNumber: "3481",
          properShippingName: "Lithium ion batteries",
          hazardClass: "9",
          marinePollutant: false,
        },
      }),
    ).toThrow("VALIDATION_REQUIRED: dangerous goods regulated details");

    const normalized = normalizeReplaceProductComplianceProfileCommand({
      ...baseCommand,
      dangerousGoods: {
        ...baseCommand.dangerousGoods,
        flashPointCelsius: "-18.000",
      },
    });
    expect(normalized.dangerousGoods.flashPointCelsius).toBe("-18");
  });

  it("拒绝重复检验范围和倒置证书有效期", () => {
    expect(() =>
      normalizeReplaceProductComplianceProfileCommand({
        ...baseCommand,
        inspectionRequirements: [
          baseCommand.inspectionRequirements[0]!,
          baseCommand.inspectionRequirements[0]!,
        ],
      }),
    ).toThrow("VALIDATION_DUPLICATE: inspectionRequirements");

    expect(() =>
      normalizeReplaceProductComplianceProfileCommand({
        ...baseCommand,
        certificates: [
          {
            ...baseCommand.certificates[0]!,
            validUntil: "2025-12-31",
          },
        ],
      }),
    ).toThrow("VALIDATION_RANGE: certificate.validUntil");

    expect(() =>
      normalizeReplaceProductComplianceProfileCommand({
        ...baseCommand,
        certificates: [
          {
            ...baseCommand.certificates[0]!,
            validUntil: "",
          },
        ],
      }),
    ).toThrow("VALIDATION_FORMAT: certificate.validUntil");
  });
});
