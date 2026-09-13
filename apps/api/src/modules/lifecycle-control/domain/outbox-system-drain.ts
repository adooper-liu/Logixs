export const DEFAULT_MAX_TENANTS = 20;
export const MIN_MAX_TENANTS = 1;
export const MAX_MAX_TENANTS = 100;

export function parseMaxTenants(raw: number | string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_MAX_TENANTS;
  const text = typeof raw === "number" ? String(raw) : raw;
  if (!/^\d+$/.test(text)) {
    throw new Error("VALIDATION_FORMAT: maxTenants 必须是整数");
  }
  const maxTenants = Number(text);
  if (maxTenants < MIN_MAX_TENANTS || maxTenants > MAX_MAX_TENANTS) {
    throw new Error("VALIDATION_FORMAT: maxTenants 超出 1–100");
  }
  return maxTenants;
}

export function sliceDueTenants(
  tenantIds: string[],
  maxTenants: number,
): { tenantIds: string[]; leftoverTenants: boolean } {
  return {
    tenantIds: tenantIds.slice(0, maxTenants),
    leftoverTenants: tenantIds.length > maxTenants,
  };
}
