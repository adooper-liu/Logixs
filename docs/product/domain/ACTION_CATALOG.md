# 动作目录 v0.1（ACTION_CATALOG，首期候选）

> 状态：**候选（初稿，待 P2 评审）** · v0.1 · 2026-09-04 · 负责人：刘志高。
> 定位：「一键动作」的**有限稳定 actionCode 单一权威初稿**；动作由服务端推导并执行（见
> [UX_CONTAINER_WORKBENCH](../UX_CONTAINER_WORKBENCH.md) §4），执行受状态机/密封/来源权威/权限约束。
> 字段列：`触发`（节点/标记/异常，代码固定）、`默认载荷/渠道`、`权限/二次确认`、`备注`。
> 本目录定稿后实例化为 `packages/contracts` 动作码 + 配置（字典），评审通过前为候选。

## 组 A · 确认与状态推进（内部）

| actionCode | 名称 | 触发 | 默认载荷 / 渠道 | 权限 / 二次确认 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `confirm_stuffing` | 确认装箱定稿 | 节点#2 装箱（已装未出） | 真实毛重/件数/体积/封号、箱号（迟绑定回填）/ 内部状态推进 | 操作员 / 低 | 走合法转换；需 R4 可写窗口与证据齐 |
| `confirm_departure` | 确认出运/离港 | 节点#3/#4 出运·离港 | atd/出运时间 / 内部 | 操作员 / 低 | 前进式写入 |
| `confirm_arrival` | 确认到港 | 节点#8 目的港 | ata / 内部 | 操作员 / 低 | |
| `confirm_unstuffed` | 确认卸空可还箱 | 节点#13 卸空 | 卸空时间 / 内部 | 操作员+仓库 / 中 | 触发后续还箱待办 |
| `cancel_container` | 取消记录 | 计划段（#4 离港前） | 原因 / 内部 | 操作员+审核 / 高 | 终态；禁 AI 自主（L4 语义） |

## 组 B · 标记驱动动作（危险品/植检/温控等）

| actionCode | 名称 | 触发 | 默认载荷 / 渠道 | 权限 / 二次确认 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `issue_dg_declaration` | 生成并发送 DG 声明 | 标记 `dangerous_goods` | 危险品信息/申报模板 / 邮件+EDI | 审核 / **高（外发）** | AI 仅可产草稿，发送须审批；禁自动 |
| `request_phytosanitary` | 植检预约/证书要求 | 标记 `phytosanitary` | 证书要求/预约 / 邮件+指令 | 审核 / 中 | 节点时间提示 |
| `apply_temp_requirement` | 温控要求下发 | 标记 `refrigerant` | 温度要求→承运/仓库 / 指令 | 操作员 / 低 | 与柜型校验联动 |
| `notify_over_limit` | 超限尺寸确认 | 标记 `over_limit` | 尺寸/承运·码头确认 / 邮件 | 操作员+承运 / 中 | 装卸前二次确认 |

## 组 C · 指令/派单（integration）

| actionCode | 名称 | 触发 | 默认载荷 / 渠道 | 权限 / 二次确认 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `order_trucking_pickup` | 一键派拖提柜 | 节点#10 拖卡（待提） | 默认拖车商/时间/箱号/目的仓库 / 指令 | 操作员 / 中 | 出站经 integration |
| `schedule_empty_return` | 安排还箱/通知承运 | 卸空后 #14 前 | 还箱点/时间 / 指令 | 操作员 / 中 | |

## 组 D · 邮件/通知（notification）

| actionCode | 名称 | 触发 | 默认载荷 / 渠道 | 权限 / 二次确认 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `notify_arrival` | 到港/ETA 通知 | 到港附近 | 收件人映射/模板 / 邮件 | 操作员 / 低 | 模板可配置 |
| `forward_document` | 一键转发单据 | 装箱单/发票/报关单 | 默认收件人 / 邮件 | 操作员 / 低 | 全程留审计 |
| `notify_delay` | 延误/甩柜通知 | 异常（甩柜/滞留/延误） | 受影响方 / 邮件 | 审核 / 中 | 合并 dispatch_exception |

## 组 E · 异常与审核（import/exception）

| actionCode | 名称 | 触发 | 默认载荷 / 渠道 | 权限 / 二次确认 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `dispatch_exception` | 创建异常并升级 | 异常（甩柜/滞留/扣货等） | 类型/影响/负责人 / 内部 | 操作员+审核 / 中 | 入 exception-management |
| `confirm_mapping` | 采纳导入映射建议 | ImportRow 待审（P6 V1） | 该行映射 / 内部 | 操作员 / 低 | 进预检；见 IMPORT_DOMAIN_MODEL |
| `reject_mapping` | 拒绝映射建议 | ImportRow 待审（P6 V1） | 原因/重映射 / 内部 | 操作员 / 低 | |

## 规则

- actionCode、标记码、状态码均固定，字典可配（D11–D13）；新增动作=新 actionCode + 触发绑定 + 默认载荷配置，不改核心逻辑。
- 动作执行前服务端校验：可写窗口 R3/R4、来源权威 D7、权限与二次确认等级；高危（外发/终态/费用/删除）显式标记，禁 AI 自主（架构 §9/L3/L4）。
- **状态推进类（confirm_*）默认必须二次确认或提供可撤销窗口（负责人采纳 2026-09-04，评审 A3）**：一旦推进即进入密封区（R3）难回改，禁止"低确认一键即推"。
- 一次动作 = 一条审计记录（操作者、默认载荷、确认内容、结果、Trace）。

## 关联与维护

- 关联 [UX_CONTAINER_WORKBENCH](../UX_CONTAINER_WORKBENCH.md) §4、[CONTAINER_MARKERS](./CONTAINER_MARKERS.md)、[MARKER_CATALOG](./MARKER_CATALOG.md)、生命周期节点（LIFECYCLE_CONSISTENCY L）。
- 派生：P2-09 动作契约、notification/integration 出站、P6 V1–V3。
- 评审定稿后转为配置/字典数据；本目录保留为指针。
