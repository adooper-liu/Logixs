import type {
  PostDepartureSourcePackagePreflightCommandV1,
  PostDepartureSourcePackagePreflightResultV1,
  PostDepartureSourcePackageReviewCommandV1,
  PostDepartureSourcePackageReviewResultV1,
  PostDepartureReferencePortSearchResultV1,
  PostDepartureSourceCandidateCorrectionCommandV1,
  PostDepartureSourceCandidateCorrectionResultV1,
  PostDepartureSourceCandidateCargoCommandV1,
  PostDepartureSourceCandidateAcceptCommandV1,
  PostDepartureSourceCandidateAcceptResultV1,
} from "@logix/contracts";
import { DEV_TENANT_ID } from "./developmentIdentity";
import { formatHttpError } from "./httpError";

const HEADERS = {
  "Content-Type": "application/json",
  "X-Tenant-Id": DEV_TENANT_ID,
  "X-Operator-Id": "dev-operator",
  "X-Roles": "import_operator",
};

export async function preflightPostDepartureSourcePackage(
  sources: PostDepartureSourcePackagePreflightCommandV1["sources"],
): Promise<PostDepartureSourcePackagePreflightResultV1> {
  const command: PostDepartureSourcePackagePreflightCommandV1 = {
    contractVersion: "post-departure-source-package-preflight.v1",
    sources,
  };
  const response = await fetch(
    "/api/post-departure-source-packages/preflight",
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "联合预检失败",
      ),
    );
  }
  return (await response.json()) as PostDepartureSourcePackagePreflightResultV1;
}

export async function savePostDepartureSourcePackageReview(
  packageId: string,
  sources: PostDepartureSourcePackageReviewCommandV1["sources"],
): Promise<PostDepartureSourcePackageReviewResultV1> {
  const command: PostDepartureSourcePackageReviewCommandV1 = {
    contractVersion: "post-departure-source-package-review.v1",
    packageId,
    sources,
  };
  const response = await fetch(
    `/api/post-departure-source-packages/${packageId}/reviews`,
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      formatReviewError(response.status, body) ??
        formatHttpError(response.status, body, "保存补全内容失败"),
    );
  }
  return (await response.json()) as PostDepartureSourcePackageReviewResultV1;
}

export async function searchPostDepartureReferencePorts(
  query: string,
  pageSize = 20,
): Promise<PostDepartureReferencePortSearchResultV1> {
  const params = new URLSearchParams({ query, pageSize: String(pageSize) });
  const response = await fetch(
    `/api/post-departure-source-packages/reference-ports?${params}`,
    { headers: HEADERS },
  );
  if (!response.ok) {
    throw new Error(
      await formatHttpError(
        response.status,
        await response.text(),
        "查找权威港口失败",
      ),
    );
  }
  return (await response.json()) as PostDepartureReferencePortSearchResultV1;
}

export async function correctPostDepartureSourceCandidate(
  command: PostDepartureSourceCandidateCorrectionCommandV1,
): Promise<PostDepartureSourceCandidateCorrectionResultV1> {
  const response = await fetch(
    `/api/post-departure-source-packages/${command.packageId}/reviews/${command.reviewId}/candidates/${encodeURIComponent(command.candidateRef)}/corrections`,
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      formatCorrectionError(response.status, body) ??
        (await formatHttpError(response.status, body, "保存接管信息失败")),
    );
  }
  return (await response.json()) as PostDepartureSourceCandidateCorrectionResultV1;
}

export async function completePostDepartureSourceCandidateCargo(
  command: PostDepartureSourceCandidateCargoCommandV1,
): Promise<PostDepartureSourceCandidateCorrectionResultV1> {
  const response = await fetch(
    `/api/post-departure-source-packages/${command.packageId}/reviews/${command.reviewId}/candidates/${encodeURIComponent(command.candidateRef)}/cargo-lines`,
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      formatCargoLineError(response.status, body) ??
        (await formatHttpError(response.status, body, "保存 SKU 装载明细失败")),
    );
  }
  return (await response.json()) as PostDepartureSourceCandidateCorrectionResultV1;
}

export async function acceptPostDepartureSourceCandidate(
  command: PostDepartureSourceCandidateAcceptCommandV1,
): Promise<PostDepartureSourceCandidateAcceptResultV1> {
  const response = await fetch(
    `/api/post-departure-source-packages/${command.packageId}/candidates/${encodeURIComponent(command.candidateRef)}/accept`,
    {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(command),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      formatAcceptanceError(response.status, body) ??
        formatHttpError(response.status, body, "暂时无法完成接管"),
    );
  }
  return (await response.json()) as PostDepartureSourceCandidateAcceptResultV1;
}

function formatReviewError(status: number, body: string): string | null {
  if (status === 409 && body.includes("SOURCE_PACKAGE_REPLAY_CONFLICT")) {
    return "这批来源已有补全记录，请重新预检后继续；当前输入不会丢失。";
  }
  return null;
}

function formatAcceptanceError(status: number, body: string): string | null {
  if (status === 404 || /Cannot POST/i.test(body)) {
    return "暂时无法完成接管，当前资料和选择已保留，请刷新后重试。";
  }
  if (status === 400 && body.includes("SHIPMENT_HANDOFF_CONTRACT_INVALID")) {
    return "接管资料校验未通过，请重新预检后重试；当前资料和选择已保留。";
  }
  if (body.includes("TARGET_SHIPMENT_VERSION_CONFLICT")) {
    return "所选出运已被其他操作更新，请重新预检并重新选择。";
  }
  if (body.includes("TARGET_SHIPMENT_NOT_DEPARTED")) {
    return "所选出运已进入后续阶段，请选择其他出运或新建独立出运。";
  }
  if (body.includes("TARGET_SHIPMENT_FACT_CONFLICT")) {
    return "当前货物的路线、船名航次或离港时间与所选出运不一致，请重新核对。";
  }
  return null;
}

function formatCorrectionError(status: number, body: string): string | null {
  if (status === 400 && body.includes("SOURCE_CANDIDATE_CORRECTION_INVALID")) {
    return "有一项输入格式未被识别。请重新选择所属出运、港口或离港时间后保存；不确定的内容可以留空。";
  }
  if (body.includes("TARGET_SHIPMENT_VERSION_CONFLICT")) {
    return "所选出运已被其他操作更新，请重新预检并重新选择。";
  }
  if (body.includes("TARGET_SHIPMENT_NOT_DEPARTED")) {
    return "所选出运已进入后续阶段，请选择其他出运或新建独立出运。";
  }
  if (status === 404 && body.includes("RESOURCE_NOT_FOUND")) {
    return "所选出运已不存在，请重新选择或新建独立出运。";
  }
  return null;
}

function formatCargoLineError(status: number, text: string): string | null {
  try {
    const body = JSON.parse(text) as {
      code?: string;
      message?:
        | string
        | {
            code?: string;
            productNumbers?: string[];
            replenishmentOrderNumbers?: string[];
          };
      productNumbers?: string[];
      replenishmentOrderNumbers?: string[];
    };
    const detail = typeof body.message === "object" ? body.message : body;
    const code = detail.code ?? body.code ?? body.message;
    if (code === "CARGO_PRODUCT_SKU_NOT_FOUND") {
      return `SKU 尚未建档：${detail.productNumbers?.join("、") || "请核对货号"}。请联系物料资料负责人完成建档后，再在本页保存。`;
    }
    if (code === "CARGO_REPLENISHMENT_ORDER_MISMATCH") {
      return `备货单不属于当前货柜：${detail.replenishmentOrderNumbers?.join("、") || "请重新选择"}。请在本页改为候选已关联的备货单。`;
    }
    if (code === "POST_DEPARTURE_CORRECTION_VERSION_CONFLICT") {
      return "当前候选已被更新，请重新预检后再保存 SKU 明细。";
    }
    if (code === "SOURCE_CANDIDATE_BASE_CORRECTION_REQUIRED") {
      return "请先在本页完成出运归组、港口和离港事实确认，再录入 SKU 明细。";
    }
    if (code === "SOURCE_CANDIDATE_CARGO_INVALID") {
      return `SKU 装载明细格式不正确（${status}），请核对每行备货单、SKU、数量和单位。`;
    }
  } catch {
    return null;
  }
  return null;
}

export type {
  PostDepartureSourceBatchV1,
  PostDepartureSourceCandidateV1,
  PostDepartureSourceKindV1,
  PostDepartureSourcePackagePreflightResultV1,
  PostDepartureSourcePackageReviewResultV1,
  PostDepartureReferencePortV1,
  PostDepartureReferencePortSearchResultV1,
  PostDepartureSourceCandidateCorrectionCommandV1,
  PostDepartureSourceCandidateCorrectionResultV1,
  PostDepartureSourceCandidateCargoCommandV1,
  PostDepartureSourceCandidateAcceptCommandV1,
  PostDepartureSourceCandidateAcceptResultV1,
} from "@logix/contracts";
