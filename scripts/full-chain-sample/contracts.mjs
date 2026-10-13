import fs from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  packageHashProjection,
  validatePackageArtifacts,
} from "@logix/full-chain-sample-contracts";

const schemaDir = new URL("./schemas/", import.meta.url);
const schemaNames = ["source-manifest", "policy"];
const schemas = Object.fromEntries(
  schemaNames.map((name) => [
    name,
    JSON.parse(
      fs.readFileSync(new URL(`${name}.schema.json`, schemaDir), "utf8"),
    ),
  ]),
);
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validators = Object.fromEntries(
  schemaNames.map((name) => [name, ajv.compile(schemas[name])]),
);
const V05_SHEETS = [
  "00_说明与总览",
  "00b_资料分类",
  "01_市场信号",
  "02_选品立项",
  "03_NPI",
  "04_主数据",
  "05_寻源",
  "06_需求补货",
  "07_采购",
  "08_可出运供给",
  "09_出运计划",
  "09a_订舱",
  "10_备货",
  "11_装箱",
  "11a_出口报关",
  "12_出运",
  "13_海运运营",
  "13a_外部跟踪字段",
  "14_进口清关",
  "15_提柜",
  "16_送仓",
  "17_卸柜",
  "18_还箱",
  "19_费用",
  "19a_费率表",
  "19b_滞港费计算",
  "20_异常中心",
  "21_交接链",
  "22_对账",
  "23_待确认",
  "24_历史实绩",
  "25_推导依据",
  "26_样本构建清单",
];
const V05_RECORD_SHEETS = new Set([
  "09_出运计划",
  "09a_订舱",
  "10_备货",
  "11_装箱",
  "11a_出口报关",
  "12_出运",
]);

function fail(code, errors = []) {
  const detail = errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}
function validate(name, value, code) {
  if (!validators[name](value)) fail(code, validators[name].errors);
  return value;
}
export function validateSourceManifest(value) {
  return validate("source-manifest", value, "SOURCE_MANIFEST_INVALID");
}
export function validatePolicy(value) {
  validate("policy", value, "POLICY_INVALID");
  if (value.policyVersion === "full-chain-policy.v0.5") {
    const names = value.sheets.map((sheet) => sheet.name);
    if (
      names.length !== V05_SHEETS.length ||
      new Set(names).size !== names.length ||
      names.some((name, index) => name !== V05_SHEETS[index])
    )
      fail("POLICY_SHEET_SET_INVALID");
    for (const sheet of value.sheets) {
      const expected = V05_RECORD_SHEETS.has(sheet.name)
        ? "records"
        : sheet.name === "23_待确认"
          ? "gap"
          : [
                "00_说明与总览",
                "00b_资料分类",
                "13a_外部跟踪字段",
                "22_对账",
                "24_历史实绩",
                "25_推导依据",
                "26_样本构建清单",
              ].includes(sheet.name)
            ? "evidence_only"
            : "unsupported";
      if (sheet.disposition !== expected || sheet.headerRow !== 6)
        fail("POLICY_DISPOSITION_INVALID");
    }
    if (
      value.pilotMappings.length !== 6 ||
      new Set(value.pilotMappings.map((mapping) => mapping.recordType)).size !==
        6
    )
      fail("POLICY_MAPPING_INVALID");
    for (const mapping of value.pilotMappings) {
      const payloadFields = new Set(Object.keys(mapping.payload));
      const policyFields = new Set(Object.keys(mapping.fieldPolicy));
      if (
        payloadFields.size !== policyFields.size ||
        [...payloadFields].some((field) => !policyFields.has(field))
      )
        fail("POLICY_FIELD_POLICY_INVALID");
    }
  }
  return value;
}
export function packageHashProjectionFor(artifacts) {
  return packageHashProjection(artifacts);
}

export { fail, validatePackageArtifacts };
