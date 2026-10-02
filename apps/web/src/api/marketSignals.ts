import type {
  MarketSignalCreateCommandV1,
  MarketSignalDecisionCommandV1,
  MarketSignalDecisionResultV1,
  MarketSignalDetailV1,
  MarketSignalPageV1,
  MarketSignalUpdateCommandV1,
  MarketSignalV1,
  ProductDefinitionReleaseCommandV1,
  ProductIdentityDraftCommandV1,
  ProductIdentityV1,
  SellableSkuReleaseCommandV1,
  ProductDefinitionV1,
  ProductDefinitionWriteCommandV1,
  ProductInitiativeClaimCommandV1,
  ProductInitiativeNpiQueueEntryV1,
  ProductInitiativeNpiQueuePageV1,
  ProductInitiativeNpiReturnCommandV1,
  ProductOpportunityIntakeCommandV1,
  ProductOpportunityPageV1,
  ProductOpportunityV1,
  ProductInitiativeDecisionCommandV1,
  ProductInitiativeDetailV1,
  ProductInitiativeQueuePageV1,
  ProductInitiativeV1,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

export async function listMarketSignals(): Promise<MarketSignalPageV1> {
  return requestJson<MarketSignalPageV1>("/api/market-signals?pageSize=100", {
    fallback: "暂时无法加载经营信号",
  });
}

export async function getMarketSignal(
  signalId: string,
): Promise<MarketSignalDetailV1> {
  return requestJson<MarketSignalDetailV1>(
    `/api/market-signals/${encodeURIComponent(signalId)}`,
    { fallback: "暂时无法加载信号依据" },
  );
}

export async function createMarketSignal(
  command: MarketSignalCreateCommandV1,
): Promise<MarketSignalV1> {
  return requestJson<MarketSignalV1>("/api/market-signals", {
    method: "POST",
    body: command,
    fallback: "暂时无法登记经营信号",
  });
}

export async function updateMarketSignal(
  signalId: string,
  command: MarketSignalUpdateCommandV1,
): Promise<MarketSignalV1> {
  return requestJson<MarketSignalV1>(
    `/api/market-signals/${encodeURIComponent(signalId)}`,
    {
      method: "PATCH",
      body: command,
      fallback: "暂时无法保存补充内容",
    },
  );
}

export async function decideMarketSignal(
  signalId: string,
  command: MarketSignalDecisionCommandV1,
): Promise<MarketSignalDecisionResultV1> {
  return requestJson<MarketSignalDecisionResultV1>(
    `/api/market-signals/${encodeURIComponent(signalId)}/decisions`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法保存本次判断",
    },
  );
}

export async function registerMarketSignalEvidence(input: {
  signalId: string;
  sourceName: string;
  sourceUrl: string;
  content: string;
}): Promise<void> {
  const contentRef =
    input.sourceUrl.trim() ||
    `market-signal/${input.signalId}/manual-source/${crypto.randomUUID()}`;
  const contentHash = await sha256Hex(
    JSON.stringify({
      sourceName: input.sourceName.trim(),
      sourceUrl: input.sourceUrl.trim(),
      content: input.content.trim(),
    }),
  );
  await requestJson("/api/evidence", {
    method: "POST",
    body: {
      evidenceType: "document",
      subjectType: "market_signal",
      subjectId: input.signalId,
      authorityLevel: "contextual",
      contentRef,
      contentHash,
      sourceType: "person",
      originatorSystem: "logix.web",
      authoritySystem: "user_supplied",
      sourceReference: input.sourceName.trim() || "业务人员补充",
      ingestionChannel: "manual_ui",
      captureSource: "manual_backfill",
      sourceSummary: input.content.trim(),
    },
    fallback: "信号已保存，但来源证据暂未登记成功",
  });
}

export async function listProductOpportunities(): Promise<ProductOpportunityPageV1> {
  return requestJson<ProductOpportunityPageV1>(
    "/api/product-opportunities?pageSize=100",
    { fallback: "暂时无法加载待领取机会" },
  );
}

/**
 * 选品队列上的立项投影：只用来标出哪些机会已经看过（以及看到哪一步），
 * 队列本身仍以机会列表为主选择源。
 */
export async function listProductInitiatives(): Promise<ProductInitiativeQueuePageV1> {
  return requestJson<ProductInitiativeQueuePageV1>(
    "/api/product-initiatives?pageSize=200",
    { fallback: "暂时无法加载队列上的立项判断" },
  );
}

export async function getProductInitiative(
  handoffId: string,
): Promise<ProductInitiativeDetailV1> {
  return requestJson<ProductInitiativeDetailV1>(
    `/api/product-initiatives/${encodeURIComponent(handoffId)}`,
    { fallback: "暂时无法加载立项判断" },
  );
}

export async function decideProductInitiative(
  handoffId: string,
  command: ProductInitiativeDecisionCommandV1,
): Promise<ProductInitiativeV1> {
  return requestJson<ProductInitiativeV1>(
    `/api/product-initiatives/${encodeURIComponent(handoffId)}/decisions`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法保存本次立项判断",
    },
  );
}

export async function intakeProductOpportunity(
  handoffId: string,
  command: ProductOpportunityIntakeCommandV1,
): Promise<ProductOpportunityV1> {
  return requestJson<ProductOpportunityV1>(
    `/api/product-opportunities/${encodeURIComponent(handoffId)}/intake`,
    {
      method: "POST",
      body: command,
      fallback:
        command.action === "claim" ? "暂时无法领取" : "暂时无法接受交接",
    },
  );
}

/**
 * NPI 待办队列：选品交到产品侧的立项。每条同时带不可变快照与当前领取状态，
 * 界面据此分出"等我接"和"我负责的"，不必再查一次。
 */
export async function listProductInitiativeNpiQueue(): Promise<ProductInitiativeNpiQueuePageV1> {
  return requestJson<ProductInitiativeNpiQueuePageV1>(
    "/api/product-initiative-npi/queue?pageSize=200",
    { fallback: "暂时无法加载产品侧待办" },
  );
}

export async function claimProductInitiative(
  handoffId: string,
  command: ProductInitiativeClaimCommandV1,
): Promise<ProductInitiativeNpiQueueEntryV1> {
  return requestJson<ProductInitiativeNpiQueueEntryV1>(
    `/api/product-initiative-npi/${encodeURIComponent(handoffId)}/claim`,
    { method: "POST", body: command, fallback: "暂时无法领取该立项" },
  );
}

export async function returnProductInitiativeFromNpi(
  handoffId: string,
  command: ProductInitiativeNpiReturnCommandV1,
): Promise<ProductInitiativeV1> {
  return requestJson<ProductInitiativeV1>(
    `/api/product-initiative-npi/${encodeURIComponent(handoffId)}/return-to-selection`,
    { method: "POST", body: command, fallback: "暂时无法退回选品" },
  );
}

/**
 * 一票的产品定义。**还没推进时服务端返回 `null`** —— 界面据此显示"还没登记规格"，
 * 而不是显示一条空定义（那会让人以为已经存过什么）。
 */
export async function getProductDefinition(
  initiativeHandoffId: string,
): Promise<ProductDefinitionV1 | null> {
  return requestJson<ProductDefinitionV1 | null>(
    `/api/product-definitions/${encodeURIComponent(initiativeHandoffId)}`,
    { fallback: "暂时无法加载产品定义" },
  );
}

export async function writeProductDefinition(
  initiativeHandoffId: string,
  command: ProductDefinitionWriteCommandV1,
): Promise<ProductDefinitionV1> {
  return requestJson<ProductDefinitionV1>(
    `/api/product-definitions/${encodeURIComponent(initiativeHandoffId)}/writes`,
    { method: "POST", body: command, fallback: "暂时无法保存产品定义" },
  );
}

export async function releaseProductDefinition(
  initiativeHandoffId: string,
  command: ProductDefinitionReleaseCommandV1,
): Promise<ProductDefinitionV1> {
  return requestJson<ProductDefinitionV1>(
    `/api/product-definitions/${encodeURIComponent(initiativeHandoffId)}/releases`,
    {
      method: "POST",
      body: command,
      fallback:
        command.decision === "release"
          ? "暂时无法发布"
          : "暂时无法保存这个决定",
    },
  );
}

/** 建档队列：3 号节点发布的产品设计，以及它有没有建过档。 */
export async function listProductIdentityQueue(): Promise<{
  items: {
    releaseId: string;
    definitionId: string;
    specification: string;
    npiStage: string;
    releasedBy: string;
    releasedAt: string;
    productId: string | null;
    productNumber: string | null;
  }[];
}> {
  return requestJson("/api/product-identities/queue?pageSize=200", {
    fallback: "暂时无法加载待建档的产品设计",
  });
}

/** 一票的产品身份；**还没建档时服务端返回 null**。 */
export async function getProductIdentity(
  releaseId: string,
): Promise<ProductIdentityV1 | null> {
  return requestJson<ProductIdentityV1 | null>(
    `/api/product-identities/${encodeURIComponent(releaseId)}`,
    { fallback: "暂时无法加载产品身份" },
  );
}

export async function draftProductIdentity(
  releaseId: string,
  command: ProductIdentityDraftCommandV1,
): Promise<ProductIdentityV1> {
  return requestJson<ProductIdentityV1>(
    `/api/product-identities/${encodeURIComponent(releaseId)}/drafts`,
    { method: "POST", body: command, fallback: "暂时无法保存产品身份" },
  );
}

export async function releaseSellableSku(
  releaseId: string,
  command: SellableSkuReleaseCommandV1,
): Promise<ProductIdentityV1> {
  return requestJson<ProductIdentityV1>(
    `/api/product-identities/${encodeURIComponent(releaseId)}/releases`,
    { method: "POST", body: command, fallback: "暂时无法发布可售 SKU" },
  );
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
