export const TARGET_TENANT = "demo-real-sample-20260921";
export const OTHER_TENANT = "tenant-other";
export const directCatalog = {
  models: {
    Product: {
      table: "product",
      rule: "direct_tenant",
      tenantField: "tenantId",
      deleteRank: 10,
    },
    ReferenceDataRelease: {
      table: "reference_data_release",
      rule: "preserve_global",
    },
  },
};
