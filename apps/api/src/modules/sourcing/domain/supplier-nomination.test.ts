import { describe, expect, it } from "vitest";
import type {
  NominateSupplierCommandV1,
  RecordQuotationCommandV1,
  RegisterSupplierCommandV1,
} from "@logix/contracts";
import {
  prepareNomination,
  prepareQuotation,
  prepareSupplierRegistration,
  SourcingConflictError,
  SourcingValidationError,
} from "./supplier-nomination";

const REGISTER: RegisterSupplierCommandV1 = {
  contractVersion: "supplier-register.v1",
  name: "宁波某某塑胶",
  countryCode: "CN",
  admissionState: "admitted",
  idempotencyKey: "register-1",
};

const QUOTATION: RecordQuotationCommandV1 = {
  contractVersion: "supplier-quotation-record.v1",
  expectedQuotationVersion: 0,
  priceTiers: [
    { minQuantity: 1000, unitPrice: "18.5000", currency: "USD" },
    { minQuantity: 500, unitPrice: "19.2000", currency: "USD" },
  ],
  incoterms: "FOB Ningbo / Incoterms 2020",
  exclusions: "不含目的港费用",
  idempotencyKey: "quotation-1",
};

const NOMINATE: NominateSupplierCommandV1 = {
  contractVersion: "supplier-nominate.v1",
  quotationId: "11111111-1111-4111-8111-111111111111",
  expectedQuotationVersion: 1,
  sampleConclusion: "确认样与图纸一致，缝线加固已改",
  capacityConstraint: "月产能约 3 万件，旺季需提前 45 天排产",
  idempotencyKey: "nominate-1",
};

describe("供应商登记", () => {
  it("国别码必须是两位大写，别的一律明确失败", () => {
    expect(() =>
      prepareSupplierRegistration("buyer", { ...REGISTER, countryCode: "chn" }),
    ).toThrow(SourcingValidationError);
  });

  it("准入状态只能是三档之一", () => {
    expect(() =>
      prepareSupplierRegistration("buyer", {
        ...REGISTER,
        admissionState: "approved" as never,
      }),
    ).toThrow(SourcingValidationError);
  });

  it("名称去掉前后空白后落库，同一请求载荷哈希稳定", () => {
    const prepared = prepareSupplierRegistration("buyer", {
      ...REGISTER,
      name: "  宁波某某塑胶  ",
    });

    expect(prepared.name).toBe("宁波某某塑胶");
    expect(prepared.payloadHash).toBe(
      prepareSupplierRegistration("buyer", REGISTER).payloadHash,
    );
  });
});

describe("报价十项", () => {
  it("数量阶梯按档位从小到大排好，便于比价", () => {
    const prepared = prepareQuotation({ version: 0 }, "buyer", QUOTATION);

    expect(prepared.priceTiers.map((tier) => tier.minQuantity)).toEqual([
      500, 1000,
    ]);
    expect(prepared.version).toBe(1);
  });

  it("同一档位出现两次时明确失败，不静默取一个", () => {
    expect(() =>
      prepareQuotation({ version: 0 }, "buyer", {
        ...QUOTATION,
        priceTiers: [
          { minQuantity: 500, unitPrice: "19.2000", currency: "USD" },
          { minQuantity: 500, unitPrice: "18.9000", currency: "USD" },
        ],
      }),
    ).toThrow(/minQuantity/);
  });

  it("单价必须是定点十进制字符串 —— 浮点表示不了钱", () => {
    expect(() =>
      prepareQuotation({ version: 0 }, "buyer", {
        ...QUOTATION,
        priceTiers: [
          { minQuantity: 500, unitPrice: "19.2.1", currency: "USD" },
        ],
      }),
    ).toThrow(/unitPrice/);
  });

  it("币种必须是三位大写", () => {
    expect(() =>
      prepareQuotation({ version: 0 }, "buyer", {
        ...QUOTATION,
        priceTiers: [{ minQuantity: 500, unitPrice: "19.2", currency: "usd" }],
      }),
    ).toThrow(/currency/);
  });

  it("贸易术语必填 —— 它是条件不是价格，缺了比不了", () => {
    expect(() =>
      prepareQuotation({ version: 0 }, "buyer", {
        ...QUOTATION,
        incoterms: " ",
      }),
    ).toThrow(SourcingValidationError);
  });

  it("关键物料：用量必须为正、损耗率在 0–100、客供必须明确", () => {
    const base = {
      name: "改性 PP 粒子",
      specification: "牌号 K8003",
      quantityPerUnit: 0.42,
      quantityUnit: "kg" as const,
      lossRatePercent: 3,
      suppliedByCustomer: false,
    };
    const prepared = prepareQuotation({ version: 0 }, "buyer", {
      ...QUOTATION,
      keyMaterials: [base],
    });
    expect(prepared.keyMaterials[0]?.name).toBe("改性 PP 粒子");

    expect(() =>
      prepareQuotation({ version: 0 }, "buyer", {
        ...QUOTATION,
        keyMaterials: [{ ...base, quantityPerUnit: 0 }],
      }),
    ).toThrow(/quantityPerUnit/);
    expect(() =>
      prepareQuotation({ version: 0 }, "buyer", {
        ...QUOTATION,
        keyMaterials: [{ ...base, lossRatePercent: 120 }],
      }),
    ).toThrow(/lossRatePercent/);
    expect(() =>
      prepareQuotation({ version: 0 }, "buyer", {
        ...QUOTATION,
        keyMaterials: [{ ...base, suppliedByCustomer: undefined as never }],
      }),
    ).toThrow(/suppliedByCustomer/);
  });

  it("版本对不上时冲突，不覆盖别人刚录的报价", () => {
    expect(() => prepareQuotation({ version: 2 }, "buyer", QUOTATION)).toThrow(
      SourcingConflictError,
    );
  });
});

describe("定点", () => {
  const QUOTED = { version: 1 };

  it("没准入的供应商不能定点 —— 没审过的对象不承担质量责任", () => {
    expect(() =>
      prepareNomination(
        { version: 1, admissionState: "pending" },
        QUOTED,
        "buyer",
        NOMINATE,
      ),
    ).toThrow("SUPPLIER_NOT_ADMITTED");
    expect(() =>
      prepareNomination(
        { version: 1, admissionState: "suspended" },
        QUOTED,
        "buyer",
        NOMINATE,
      ),
    ).toThrow("SUPPLIER_NOT_ADMITTED");
  });

  it("样品结论与产能约束必填 —— 没验过样就定点是拿量产赌", () => {
    for (const field of ["sampleConclusion", "capacityConstraint"] as const) {
      expect(() =>
        prepareNomination(
          { version: 1, admissionState: "admitted" },
          QUOTED,
          "buyer",
          { ...NOMINATE, [field]: "   " },
        ),
      ).toThrow(SourcingValidationError);
    }
  });

  it("准入且报价版本对得上时定点成功", () => {
    const prepared = prepareNomination(
      { version: 1, admissionState: "admitted" },
      QUOTED,
      "buyer",
      NOMINATE,
    );

    expect(prepared.quotationVersion).toBe(1);
    expect(prepared.sampleConclusion).toContain("确认样");
  });

  it("报价版本对不上时冲突，不覆盖别人刚改的价", () => {
    expect(() =>
      prepareNomination(
        { version: 1, admissionState: "admitted" },
        { version: 3 },
        "buyer",
        NOMINATE,
      ),
    ).toThrow(SourcingConflictError);
  });
});
