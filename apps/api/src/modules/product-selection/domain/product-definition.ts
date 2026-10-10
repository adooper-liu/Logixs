import { createHash } from "node:crypto";
import type {
  ProductDefinitionPendingFieldCodeV1,
  ProductDefinitionReleaseCommandV1,
  ProductDefinitionWriteCommandV1,
} from "@logix/contracts";

/**
 * 产品定义：把一件已领的立项推进到**可发布**，交给主数据侧建档。
 *
 * **阶段用行业通用名 EVT/DVT/PVT/MP**（代工厂说的就是这四个词），阶段推进不是
 * 空状态字段 —— 每一段都要有人登记的**结论与依据**，上一段结论没登记就前进不了。
 * 系统不替人判断"验证通过"，它只检查"该登记的登记了没有"。
 *
 * 规则与立项同构：期望版本乐观锁 + 幂等键；缺口**现算**，不存成库里的人工状态。
 */

export const NPI_STAGES = ["evt", "dvt", "pvt", "mp"] as const;
export type NpiStage = (typeof NPI_STAGES)[number];

/** 需要登记出段结论的阶段。`mp` 不在其中：量产段以"发布"离开本工作台。 */
const CONCLUSION_STAGES: readonly NpiStage[] = ["evt", "dvt", "pvt"];

/** 类型守卫：下面靠它把 `npiStage` 收窄成带结论阶段，缺口码才能拼得出来。 */
function requiresConclusion(stage: NpiStage): stage is "evt" | "dvt" | "pvt" {
  return CONCLUSION_STAGES.includes(stage);
}

export interface CurrentProductDefinition {
  version: number;
  npiStage: NpiStage;
  specification: string | null;
  complianceAssumptions: readonly string[];
  /** 已登记结论的阶段。用来判断"能不能前进"，也用来现算缺口。 */
  concludedStages: readonly NpiStage[];
}

export interface PreparedStageOutcome {
  stage: NpiStage;
  conclusion: string;
  evidenceRefs: string[];
}

export interface PreparedProductDefinitionWrite {
  expectedDefinitionVersion: number;
  version: number;
  npiStage: NpiStage;
  specification: string;
  complianceAssumptions: string[];
  /** 本次登记的结论；没有就是 `null`（沿用之前登记的）。 */
  conclusion: PreparedStageOutcome | null;
  idempotencyKey: string;
  payloadHash: string;
}

export type ProductDefinitionReleaseDecision =
  "release" | "defer" | "terminate";

export interface PreparedProductDefinitionRelease {
  expectedDefinitionVersion: number;
  version: number;
  decision: ProductDefinitionReleaseDecision;
  releaseState: "released" | "deferred" | "terminated";
  reason: string | null;
  idempotencyKey: string;
  payloadHash: string;
}

export class ProductDefinitionValidationError extends Error {}
export class ProductDefinitionConflictError extends Error {}

/**
 * 按**当前阶段**现算还缺什么。阶段一前进，缺口的组成就跟着变 ——
 * 所以它不能存成库里的状态，否则阶段动了、缺口还停在原地。
 */
export function productDefinitionPendingFieldCodes(
  current: CurrentProductDefinition,
): ProductDefinitionPendingFieldCodeV1[] {
  const pending: ProductDefinitionPendingFieldCodeV1[] = [];
  if (!current.specification) pending.push("specification");
  if (current.complianceAssumptions.length === 0) {
    pending.push("compliance_assumptions");
  }
  // 只要求**当前阶段**的结论：走到 DVT 之后就不该再提"还缺 EVT 结论"。
  const stage = current.npiStage;
  if (requiresConclusion(stage) && !current.concludedStages.includes(stage)) {
    pending.push(`${stage}_conclusion`);
  }
  return pending;
}

export function prepareProductDefinitionWrite(
  current: CurrentProductDefinition,
  actorId: string,
  command: ProductDefinitionWriteCommandV1,
): PreparedProductDefinitionWrite {
  if (command.contractVersion !== "product-definition-write.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const expectedDefinitionVersion = version(
    command.expectedDefinitionVersion,
    "expectedDefinitionVersion",
  );
  if (expectedDefinitionVersion !== current.version) {
    conflict("PRODUCT_DEFINITION_VERSION_CONFLICT");
  }
  const specification = text(command.specification, "specification", 4000);
  const complianceAssumptions = stringList(
    command.complianceAssumptions ?? [],
    "complianceAssumptions",
  );

  const conclusion = command.conclusion
    ? {
        stage: current.npiStage,
        conclusion: text(command.conclusion.text, "conclusion.text", 4000),
        evidenceRefs: uniqueUuids(
          command.conclusion.evidenceRefs ?? [],
          "conclusion.evidenceRefs",
        ),
      }
    : null;

  let npiStage = current.npiStage;
  if (command.advanceStage) {
    if (current.npiStage === "mp") {
      // 量产段靠发布离开，不靠再推一段；再点前进说明前端状态旧了。
      conflict("PRODUCT_DEFINITION_ALREADY_AT_MASS_PRODUCTION");
    }
    // 本段结论可以是这次写的，也可以是之前写过的 —— 但必须有，否则前进只是改了个字。
    const concluded =
      current.concludedStages.includes(current.npiStage) || conclusion !== null;
    if (!concluded) {
      invalid(
        `PRODUCT_DEFINITION_STAGE_INCOMPLETE: ${current.npiStage}_conclusion`,
      );
    }
    npiStage = NPI_STAGES[NPI_STAGES.indexOf(current.npiStage) + 1]!;
  }

  const normalized = {
    expectedDefinitionVersion,
    version: current.version + 1,
    npiStage,
    specification,
    complianceAssumptions,
    idempotencyKey,
  };
  return { ...normalized, conclusion, payloadHash: hash(normalized) };
}

export function prepareProductDefinitionRelease(
  current: CurrentProductDefinition,
  actorId: string,
  command: ProductDefinitionReleaseCommandV1,
): PreparedProductDefinitionRelease {
  if (command.contractVersion !== "product-definition-release.v1") {
    invalid("contractVersion");
  }
  text(actorId, "actorId", 200);
  const idempotencyKey = text(command.idempotencyKey, "idempotencyKey", 200);
  const expectedDefinitionVersion = version(
    command.expectedDefinitionVersion,
    "expectedDefinitionVersion",
  );
  if (expectedDefinitionVersion !== current.version) {
    conflict("PRODUCT_DEFINITION_VERSION_CONFLICT");
  }
  if (!RELEASE_DECISIONS.has(command.decision)) invalid("decision");

  const reason = optionalText(command.reason, "reason", 500);
  if (command.decision === "release") {
    if (current.npiStage !== "mp") {
      invalid("PRODUCT_DEFINITION_RELEASE_REQUIRES_MP");
    }
    // 发布的硬门槛：下游要拿它建稳定身份，没规格或没合规假设就发不出去。
    const missing = productDefinitionPendingFieldCodes(current).filter(
      (code) => code === "specification" || code === "compliance_assumptions",
    );
    if (missing.length > 0) {
      invalid(`PRODUCT_DEFINITION_RELEASE_INCOMPLETE: ${missing.join(",")}`);
    }
  } else if (!reason) {
    // 暂缓或终止却不说为什么，事后无从复盘 —— 这是硬要求，不是待补。
    invalid(`VALIDATION_FORMAT: reason（${command.decision} 必须说明原因）`);
  }

  const normalized = {
    expectedDefinitionVersion,
    version: current.version + 1,
    decision: command.decision,
    releaseState: RELEASE_STATES[command.decision],
    reason,
    idempotencyKey,
  };
  return { ...normalized, payloadHash: hash(normalized) };
}

const RELEASE_DECISIONS = new Set<string>(["release", "defer", "terminate"]);
const RELEASE_STATES: Record<
  ProductDefinitionReleaseDecision,
  PreparedProductDefinitionRelease["releaseState"]
> = {
  release: "released",
  defer: "deferred",
  terminate: "terminated",
};

function text(value: string, field: string, maxLength: number): string {
  if (typeof value !== "string") invalid(field);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) invalid(field);
  return normalized;
}

function optionalText(
  value: string | undefined | null,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) return null;
  return text(value, field, maxLength);
}

function stringList(values: readonly string[], field: string): string[] {
  if (!Array.isArray(values)) invalid(field);
  return values.map((value) => text(value, field, 200));
}

function version(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) invalid(field);
  return value;
}

function uniqueUuids(values: readonly string[], field: string): string[] {
  if (!Array.isArray(values) || values.length > 100) invalid(field);
  const normalized = values.map((value) => uuid(value, field));
  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) invalid(field);
  return unique;
}

function uuid(value: string, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) invalid(field);
  return value.toLowerCase();
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function invalid(field: string): never {
  throw new ProductDefinitionValidationError(`VALIDATION_FORMAT: ${field}`);
}

function conflict(code: string): never {
  throw new ProductDefinitionConflictError(code);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
