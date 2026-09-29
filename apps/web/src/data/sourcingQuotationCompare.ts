import type { SupplierQuotationV1 } from "@logix/contracts";

/**
 * 报价可比性：币种、贸易术语或起订量口径不一致时，禁止呈现「当前最低」。
 * 完整落地成本归一在后续切片；本片只阻断伪排名。
 */
export function quotationsAreComparable(
  quotations: readonly SupplierQuotationV1[],
): boolean {
  if (quotations.length <= 1) return true;
  const first = quotations[0]!;
  const currency = primaryCurrency(first);
  const incoterms = first.incoterms.trim();
  const minQuantity = primaryMinQuantity(first);
  if (!currency || !incoterms || minQuantity === null) return false;
  return quotations.every((quotation) => {
    return (
      primaryCurrency(quotation) === currency &&
      quotation.incoterms.trim() === incoterms &&
      primaryMinQuantity(quotation) === minQuantity
    );
  });
}

export function primaryCurrency(quotation: SupplierQuotationV1): string | null {
  const tier = quotation.priceTiers[0];
  return tier?.currency?.trim() || null;
}

export function primaryMinQuantity(
  quotation: SupplierQuotationV1,
): number | null {
  const tier = quotation.priceTiers[0];
  return tier ? tier.minQuantity : null;
}
