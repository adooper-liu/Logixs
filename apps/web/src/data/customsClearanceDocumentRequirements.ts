/** 2026-10-30 负责人提供的国别清关资料表。Y=必交，¥=表内记号但不按必交，空列不建要求行。 */

export type DocumentApplicability = "required" | "marked" | "noted";
export type EnsDirection = "import" | "export" | "both";

export interface CustomsDocumentType {
  code: string;
  nameZh: string;
  nameEn: string;
  sortOrder: number;
}

export interface CustomsDocumentRequirement {
  countryCode: string;
  documentCode: string;
  applicability: DocumentApplicability;
  note: string | null;
}

export interface CustomsEnsFilingRule {
  countryCode: string;
  direction: EnsDirection;
}

export const ENS_IMPORT_FILE_RULE =
  "提单下的所有货品单号+国别路径+Overseas+ENS.xls";
export const ENS_EXPORT_FILE_RULE = "提单下的所有货品单号+ENS.xls";

export const customsDocumentTypes: CustomsDocumentType[] = [
  { code: "bl", nameZh: "提单", nameEn: "B/L", sortOrder: 10 },
  { code: "pl", nameZh: "装箱单", nameEn: "PL", sortOrder: 20 },
  { code: "inv", nameZh: "发票", nameEn: "IN", sortOrder: 30 },
  { code: "ens", nameZh: "ENS", nameEn: "ENS", sortOrder: 40 },
  {
    code: "product_info",
    nameZh: "产品资料",
    nameEn: "Product Info.",
    sortOrder: 50,
  },
  {
    code: "pharmaceutical_control",
    nameZh: "药品监管声明",
    nameEn: "Pharmaceutical Control",
    sortOrder: 60,
  },
  {
    code: "end_use_certification",
    nameZh: "农业产品声明",
    nameEn: "End Use Certification",
    sortOrder: 70,
  },
  {
    code: "cpc_astm",
    nameZh: "婴童玩具证书",
    nameEn: "CPC & ASTM",
    sortOrder: 80,
  },
  {
    code: "textile",
    nameZh: "纺织品工厂备案",
    nameEn: "Textile",
    sortOrder: 90,
  },
  {
    code: "lacey_act",
    nameZh: "Lacey Act",
    nameEn: "Lacey Act",
    sortOrder: 100,
  },
  {
    code: "phytosanitary",
    nameZh: "植检证书附件",
    nameEn: "Phytosanitary Certificate",
    sortOrder: 110,
  },
  {
    code: "power_of_attorney",
    nameZh: "授权委托书",
    nameEn: "Power of Attorney",
    sortOrder: 120,
  },
  {
    code: "an_emanifest",
    nameZh: "到港通知",
    nameEn: "AN/E-manifest",
    sortOrder: 130,
  },
  {
    code: "energy_related_products",
    nameZh: "能效产品文件",
    nameEn: "Energy-related Products",
    sortOrder: 140,
  },
  {
    code: "nameplate",
    nameZh: "产品铭牌",
    nameEn: "Nameplate",
    sortOrder: 150,
  },
  { code: "gcc", nameZh: "GCC", nameEn: "GCC", sortOrder: 160 },
];

const required = (
  countryCode: string,
  documentCodes: string[],
): CustomsDocumentRequirement[] =>
  documentCodes.map((documentCode) => ({
    countryCode,
    documentCode,
    applicability: "required",
    note: null,
  }));

export const customsDocumentRequirements: CustomsDocumentRequirement[] = [
  ...required("US", [
    "bl",
    "pl",
    "inv",
    "ens",
    "pharmaceutical_control",
    "cpc_astm",
    "textile",
    "lacey_act",
    "gcc",
  ]),
  ...required("CA", ["bl", "pl", "inv", "ens", "an_emanifest"]),
  {
    countryCode: "CA",
    documentCode: "product_info",
    applicability: "marked",
    note: null,
  },
  ...required("UK", [
    "bl",
    "pl",
    "inv",
    "ens",
    "phytosanitary",
    "energy_related_products",
    "nameplate",
  ]),
  ...required("DE", [
    "bl",
    "pl",
    "inv",
    "ens",
    "product_info",
    "phytosanitary",
    "power_of_attorney",
  ]),
  ...required("FR", [
    "bl",
    "pl",
    "inv",
    "ens",
    "product_info",
    "phytosanitary",
  ]),
  ...required("IT", [
    "bl",
    "pl",
    "inv",
    "ens",
    "product_info",
    "phytosanitary",
  ]),
  ...required("RO", [
    "bl",
    "pl",
    "inv",
    "ens",
    "product_info",
    "phytosanitary",
  ]),
  ...required("ES", [
    "bl",
    "pl",
    "inv",
    "product_info",
    "pharmaceutical_control",
  ]),
  {
    countryCode: "ES",
    documentCode: "ens",
    applicability: "marked",
    note: null,
  },
  ...required("IE", ["bl", "pl", "inv", "ens"]),
  {
    countryCode: "IE",
    documentCode: "phytosanitary",
    applicability: "noted",
    note: "进口关务加标记",
  },
];

export const customsEnsFilingRules: CustomsEnsFilingRule[] = [
  { countryCode: "UK", direction: "import" },
  { countryCode: "IE", direction: "import" },
  { countryCode: "DE", direction: "both" },
  { countryCode: "FR", direction: "both" },
  { countryCode: "IT", direction: "both" },
  { countryCode: "ES", direction: "export" },
  { countryCode: "US", direction: "import" },
];

const countryNames: Record<string, string> = {
  US: "美国",
  CA: "加拿大",
  UK: "英国",
  DE: "德国",
  FR: "法国",
  IT: "意大利",
  RO: "罗马尼亚",
  ES: "西班牙",
  IE: "爱尔兰",
};

export function countryFromUnlocode(
  code: string | null | undefined,
): string | null {
  if (!code || code.length < 2) return null;
  const iso = code.slice(0, 2).toUpperCase();
  return iso === "GB" ? "UK" : iso;
}

export interface CustomsChecklistItem {
  code: string;
  nameZh: string;
  nameEn: string;
  applicability: DocumentApplicability;
  note: string | null;
  ensFileRule: string | null;
  satisfied: boolean;
}

export function customsDocumentChecklist(
  destinationCode: string | null | undefined,
  filedDocumentCodes: readonly string[] = [],
): {
  countryCode: string | null;
  countryName: string | null;
  known: boolean;
  items: CustomsChecklistItem[];
  requiredCount: number;
  satisfiedCount: number;
} {
  const countryCode = countryFromUnlocode(destinationCode);
  if (!countryCode) {
    return {
      countryCode: null,
      countryName: null,
      known: false,
      items: [],
      requiredCount: 0,
      satisfiedCount: 0,
    };
  }
  const filed = new Set(filedDocumentCodes);
  const ens = customsEnsFilingRules.find(
    (rule) => rule.countryCode === countryCode,
  );
  const ensFileRule = !ens
    ? null
    : ens.direction === "import"
      ? ENS_IMPORT_FILE_RULE
      : ens.direction === "export"
        ? ENS_EXPORT_FILE_RULE
        : `${ENS_IMPORT_FILE_RULE}；${ENS_EXPORT_FILE_RULE}`;
  const items = customsDocumentRequirements
    .filter((row) => row.countryCode === countryCode)
    .map((row) => {
      const type = customsDocumentTypes.find(
        (item) => item.code === row.documentCode,
      );
      return {
        code: row.documentCode,
        nameZh: type?.nameZh ?? row.documentCode,
        nameEn: type?.nameEn ?? row.documentCode,
        sortOrder: type?.sortOrder ?? 0,
        applicability: row.applicability,
        note: row.note,
        ensFileRule: row.documentCode === "ens" ? ensFileRule : null,
        satisfied:
          row.applicability === "required" && filed.has(row.documentCode),
      };
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(
      ({
        code,
        nameZh,
        nameEn,
        applicability,
        note,
        ensFileRule,
        satisfied,
      }) => ({
        code,
        nameZh,
        nameEn,
        applicability,
        note,
        ensFileRule,
        satisfied,
      }),
    );
  const requiredItems = items.filter(
    (item) => item.applicability === "required",
  );
  return {
    countryCode,
    countryName: countryNames[countryCode] ?? null,
    known: items.length > 0,
    items,
    requiredCount: requiredItems.length,
    satisfiedCount: requiredItems.filter((item) => item.satisfied).length,
  };
}

export function checklistStatusLabel(item: CustomsChecklistItem): string {
  if (item.applicability === "marked") return "表内记号";
  if (item.applicability === "noted") return "备注";
  return item.satisfied ? "已满足" : "未满足";
}
