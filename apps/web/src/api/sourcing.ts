import type {
  AdmitSupplierCommandV1,
  NominateSupplierCommandV1,
  RecordQuotationCommandV1,
  RegisterSupplierCommandV1,
  SupplierNominationHandoffV1,
  SupplierQuotationV1,
  SupplierV1,
} from "@logix/contracts";
import { requestJson } from "./httpClient";

/** 队列上的一条：一份发布里的一个 SKU，以及它已有的候选、报价与定点。 */
export interface SourcingQueueEntry {
  skuReleaseId: string;
  skuId: string;
  /** 对外编号：队列要能让人认出"这是哪一件"，只给 id 等于让人拿 UUID 干活。 */
  skuCode: string;
  productNumber: string;
  suppliers: SupplierV1[];
  quotations: SupplierQuotationV1[];
  nominated: SupplierNominationHandoffV1 | null;
}

export async function listSourcingQueue(): Promise<{
  suppliers: SupplierV1[];
  entries: SourcingQueueEntry[];
}> {
  return requestJson("/api/sourcing/queue?take=100", {
    fallback: "暂时无法加载待寻源的可售 SKU",
  });
}

export async function registerSupplier(
  command: RegisterSupplierCommandV1,
): Promise<SupplierV1> {
  return requestJson<SupplierV1>("/api/sourcing/suppliers", {
    method: "POST",
    body: command,
    fallback: "暂时无法登记供应商",
  });
}

export async function admitSupplier(
  supplierId: string,
  command: AdmitSupplierCommandV1,
): Promise<SupplierV1> {
  return requestJson<SupplierV1>(
    `/api/sourcing/suppliers/${encodeURIComponent(supplierId)}/admit`,
    {
      method: "POST",
      body: command,
      fallback: "暂时无法准入供应商",
    },
  );
}

export async function recordQuotation(
  input: { supplierId: string; skuReleaseId: string; skuId: string },
  command: RecordQuotationCommandV1,
): Promise<SupplierQuotationV1> {
  return requestJson<SupplierQuotationV1>(
    `/api/sourcing/suppliers/${encodeURIComponent(input.supplierId)}/releases/${encodeURIComponent(input.skuReleaseId)}/skus/${encodeURIComponent(input.skuId)}/quotations`,
    { method: "POST", body: command, fallback: "暂时无法录入报价" },
  );
}

export async function nominateSupplier(
  command: NominateSupplierCommandV1,
): Promise<SupplierNominationHandoffV1> {
  return requestJson<SupplierNominationHandoffV1>("/api/sourcing/nominations", {
    method: "POST",
    body: command,
    fallback: "暂时无法定点",
  });
}
