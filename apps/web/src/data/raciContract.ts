export type RaciRole =
  | "ops"
  | "forwarder"
  | "customs"
  | "trucking"
  | "warehouse"
  | "finance"
  | "sales"
  | "manager";

export type RaciCode = "R" | "A" | "C" | "I";

export interface RaciCell {
  role: RaciRole;
  code: RaciCode;
}

export interface RaciNodeRow {
  nodeKey: string;
  nodeName: string;
  cells: RaciCell[];
}

export const raciRoleDefinitions: readonly {
  key: RaciRole;
  label: string;
}[] = [
  { key: "ops", label: "运营" },
  { key: "forwarder", label: "货代" },
  { key: "customs", label: "报关行" },
  { key: "trucking", label: "拖车行" },
  { key: "warehouse", label: "仓库" },
  { key: "finance", label: "财务" },
  { key: "sales", label: "销售" },
  { key: "manager", label: "主管" },
];
