import type {
  MarketSignalCreateCommandV1,
  MarketSignalDecisionCommandV1,
  MarketSignalDecisionResultV1,
  MarketSignalDetailV1,
  MarketSignalPageV1,
  MarketSignalUpdateCommandV1,
  MarketSignalV1,
  ProductOpportunityIntakeCommandV1,
  ProductOpportunityPageV1,
  ProductOpportunityV1,
} from "@logix/contracts";
import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

const HEADERS = {
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "operations_dispatcher",
};

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

async function requestJson<T = unknown>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    fallback: string;
  },
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      ...HEADERS,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        options.fallback,
      ),
    );
  }
  return (await response.json()) as T;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
