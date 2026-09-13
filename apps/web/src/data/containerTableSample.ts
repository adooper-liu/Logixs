import type {
  DataTableProjection,
  DataTableSchema,
  DataTableStatusValue,
} from "../components/ui/dataTableContract";
import type { ContainerProjection, StatusView } from "./sample";

// 演示适配器模拟未来 API 的受控 schema + rows 投影，不代表数据库实体或正式 API 契约。
const containerTableSchema: DataTableSchema = {
  schemaId: "demo.container.shipped-list",
  schemaVersion: 2,
  label: "已出运货柜数据表",
  searchPlaceholder: "柜号 / 备货单 / 提单",
  rowLabelColumnCode: "container",
  defaultSort: { columnCode: "eta", direction: "asc" },
  quickFilters: [
    { code: "all", label: "全部", matchAll: true },
    { code: "risk", label: "风险" },
    { code: "pending", label: "待确认" },
  ],
  columns: [
    {
      code: "container",
      label: "货柜",
      kind: "entity",
      order: 10,
      width: 230,
      searchable: true,
      sortable: true,
      pinned: "left",
      rowAction: "open",
      description: "柜号为查询标识；备货单和提单作为同一流转记录的来源锚点。",
    },
    {
      code: "containerStatus",
      label: "货柜状态",
      kind: "status",
      order: 20,
      width: 138,
      sortable: true,
      queryKey: "status",
      dividerBefore: true,
      description: "货柜实际走到哪里，以已落账业务事实为准。",
    },
    {
      code: "taskStatus",
      label: "任务状态",
      kind: "status",
      order: 30,
      width: 158,
      sortable: true,
      description: "员工或责任方的工作做到哪里，不替代货柜事实。",
    },
    {
      code: "syncStatus",
      label: "同步状态",
      kind: "status",
      order: 40,
      width: 166,
      sortable: true,
      description: "区分请求已接收、业务已接受与业务事实已落账。",
    },
    {
      code: "eta",
      label: "预计到港",
      kind: "text",
      order: 50,
      width: 90,
      sortable: true,
      hideable: true,
      dividerBefore: true,
    },
    {
      code: "actualAt",
      label: "实际到港",
      kind: "text",
      order: 60,
      width: 90,
      sortable: true,
      hideable: true,
      emptyLabel: "待发生",
    },
    {
      code: "risk",
      label: "当前风险",
      kind: "risk",
      order: 70,
      width: 172,
      sortable: true,
      dividerBefore: true,
    },
    {
      code: "open",
      label: "查看",
      kind: "action",
      order: 80,
      width: 48,
      pinned: "right",
      rowAction: "open",
      dividerBefore: true,
    },
  ],
};

const toTableStatus = (status: StatusView): DataTableStatusValue => ({
  code: status.code,
  label: status.label,
  tone: status.tone,
  changedAt: status.changedAt,
});

const liveContainerTableSchema: DataTableSchema = {
  schemaId: "live.container.list",
  schemaVersion: 4,
  label: "干活",
  searchPlaceholder: "柜号 / 备货单",
  rowLabelColumnCode: "container",
  defaultSort: { columnCode: "container", direction: "asc" },
  columns: [
    {
      code: "container",
      label: "货柜",
      kind: "entity",
      order: 10,
      width: 260,
      searchable: true,
      sortable: true,
      pinned: "left",
      rowAction: "open",
      description: "柜号和备货单。点开去做这一柜的任务。",
    },
    {
      code: "containerStatus",
      label: "状态",
      kind: "status",
      order: 20,
      width: 140,
      sortable: true,
      queryKey: "status",
      description: "货柜生命周期八态。",
    },
    {
      code: "currentStation",
      label: "当前站",
      kind: "text",
      order: 22,
      width: 120,
      emptyLabel: "还没有流程",
      description: "流程实例上的当前节点。",
    },
    {
      code: "openTask",
      label: "待办",
      kind: "text",
      order: 25,
      width: 168,
      emptyLabel: "没有待办",
      description: "这一柜还没做完的节点任务。",
    },
    {
      code: "latestSync",
      label: "同步",
      kind: "text",
      order: 27,
      width: 140,
      emptyLabel: "最近没有提交",
      description: "最近一页提交里，这一柜记没记下。",
    },
    {
      code: "open",
      label: "查看",
      kind: "action",
      order: 30,
      width: 56,
      pinned: "right",
      rowAction: "open",
      dividerBefore: true,
    },
  ],
};

export const createContainerTableProjection = (
  containers: readonly ContainerProjection[],
): DataTableProjection => ({
  schema: containerTableSchema,
  rows: containers.map((container) => ({
    rowId: container.containerRecordId,
    tone: container.tone,
    filterKeys: [
      ...(container.tone === "risk" ? ["risk"] : []),
      ...(!["idle", "committed"].includes(container.syncStatus.code)
        ? ["pending"]
        : []),
    ],
    values: {
      container: {
        primary: container.containerNumber,
        supportingValues: [container.orderNumber, container.billOfLading],
        context: container.currentNode,
      },
      containerStatus: toTableStatus(container.currentStatus),
      taskStatus: toTableStatus(container.taskStatus),
      syncStatus: toTableStatus(container.syncStatus),
      eta: container.eta,
      actualAt: container.actualAt,
      risk: { label: container.risk, tone: container.tone },
      open: null,
    },
  })),
  pageInfo: {
    total: containers.length,
    offset: 0,
    limit: 25,
    hasPrevious: false,
    hasNext: false,
  },
});

export const createLiveContainerTableProjection = (
  containers: readonly ContainerProjection[],
  options?: {
    tasksReady?: boolean;
    stationsReady?: boolean;
    syncReady?: boolean;
  },
): DataTableProjection => ({
  schema: liveContainerTableSchema,
  rows: containers.map((container) => ({
    rowId: container.containerRecordId,
    tone: container.tone,
    filterKeys: [],
    values: {
      container: {
        primary: container.containerNumber,
        supportingValues: [container.orderNumber].filter(Boolean),
        context: container.currentNode,
      },
      containerStatus: toTableStatus(container.currentStatus),
      currentStation:
        options?.stationsReady === false
          ? "当前站没能加载"
          : container.currentNode,
      openTask:
        options?.tasksReady === false
          ? "待办没能加载"
          : container.taskStatus.code === "idle"
            ? ""
            : container.taskStatus.label,
      latestSync:
        options?.syncReady === false
          ? "同步没能加载"
          : container.syncStatus.code === "idle"
            ? ""
            : container.syncStatus.label,
      open: null,
    },
  })),
  pageInfo: {
    total: containers.length,
    offset: 0,
    limit: 25,
    hasPrevious: false,
    hasNext: false,
  },
});
