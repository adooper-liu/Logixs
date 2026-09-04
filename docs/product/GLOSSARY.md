# 统一业务词汇表（P0-05）

> 状态：**已确认（初版基线）** · v0.1.1 · 2026-09-04 · **P2 增补 §5（2026-09-04，口径以 domain/ 文档为准）**。词汇表是跨团队沟通的单一真相；本表指明权威定义位置与负责人（负责人按 [RAID](../planning/RAID.md) 占位跟踪），任何人不得在代码/文档中另起口径。

## 1. 导入与数据

| 术语 | 定义 | 权威位置 / 备注 |
| --- | --- | --- |
| 导入批次（batch） | 一次上传及其全生命周期记录，含来源、统计与结果 | `import` 模块；迁移/表名 `import_batch` |
| 导入行（row） | 批次内一条原始记录及逐行状态 | 逐行错误与结果在此级别 |
| 标准字段（target field） | 目标业务对象的受控字段（含语义、格式、币种/单位约束） | 字典 + 字段模板（业务管理员维护） |
| 映射建议 | AI 生成的“源列 → 标准字段”建议，含证据与置信 | 属 AI 产物，非事实 |
| 预检报告 | 写入前由确定性规则生成的通过与失败清单 | 未通过禁止写入业务表 |
| 对账差异 | 导入后按幂等/重复/校验比对出的差异清单 | 来源批次可回查 |

## 2. 业务对象（泛物流首期基线）

| 术语 | 定义 | 备注 |
| --- | --- | --- |
| 订单 / 单证（document） | 被导入的业务单据主体（订舱、运单、货柜信息等，按用例收敛） | 具体对象集合随 P2 前定（IMPORT_WORKFLOW §8 跟踪） |
| 货柜（container） | 运输容器及状态事件主体 | 状态模型在 P2 定义 |
| 批次/波次（lot/batch） | 业务上成组进入系统的记录集合 | 与“导入批次”区分 |
| 状态（status） | 业务对象状态机当前取值 | 状态机单一权威在 Domain/状态契约，禁止多处复制 |
| 异常（exception） | 需要人工处置的偏差（字段冲突、计划偏差、证据缺失） | `exception-management` 模块 |
| 主数据（master data） | 港口、船司、仓库、币种、单位等受控字典 | `dictionary` 模块；未知值进待处理队列，禁止擅自生成含糊字典项 |
| 来源（source） | 文件/上游系统的标识与归属，供审计与幂等 | 每条业务数据须可溯源 |

## 3. AI 与审核

| 术语 | 定义 | 备注 |
| --- | --- | --- |
| AI 产物（artifact） | 抽取/映射/解释/草稿等结果对象 | 与最终业务事实分离 |
| 置信度 | 结合规则、历史评测、字段类型与证据完整度形成的决策值 | 不得仅用模型自报 |
| 审核（review） | 人对 AI 产物/高风险写入的确认、修改或拒绝 | 首批全部人工 |
| 审批（approval） | 对 L3 级操作（写库/通知/同步）的授权 | 由业务 API 执行 |
| 风险等级 | L0–L4（L4 禁 AI 自主） | 权威定义见架构文档 §9 |

## 4. 规则

- 业务词汇只在“权威位置”定义一次；其他文档用链接引用，不复制正文（ENGINEERING_RULES §12）。
- 术语口径变化必须先改本表与权威代码契约，再改派生文档。
- 本表负责人：刘志高（产品 + 数据负责人）。

## 5. P2 领域设计增补术语（2026-09-04；权威正文在 domain/ 文档，本表只登记不抄正文）

| 术语 | 一句话定义（权威口径） | 权威位置 |
| --- | --- | --- |
| 采购订单号（PO） | 采购阶段单据号，先于备货单产生 | [SHIPMENT_FLOW_OVERVIEW](./domain/SHIPMENT_FLOW_OVERVIEW.md) §3、INTEGRATION_BOUNDARIES |
| 备货单号 | **备货阶段唯一建档身份**；一备货单→一货柜(1:1) | [CONTEXT_MAP](./domain/CONTEXT_MAP.md) §3.2、IMPORT_DOMAIN_MODEL §6.2 |
| 主备货单号 | 一票(提单)多柜时**任取一柜备货单号**的票级展示代表；**不作归属关系/唯一键/外键**（曾致“一柜多单/一单多柜”误解） | SHIPMENT_FLOW_OVERVIEW §3 |
| 提单归组 | 一提单(B/L)→多货柜；各柜各属其备货单 | SHIPMENT_FLOW_OVERVIEW §3 |
| 箱号 | **迟绑定**：装箱后与外部（船司/海关/拖车）交换才进入系统 | [CONTAINER_LIFECYCLE](./domain/CONTAINER_LIFECYCLE.md) §3 |
| 实际出运日期 | 迟绑定（装箱后）；备货/订舱阶段仅有预计 | LIFECYCLE_CONSISTENCY R0 |
| ContainerRecord（货柜流转记录） | 一单一柜的记录单元，主锚=备货单号 | [CONTEXT_MAP](./domain/CONTEXT_MAP.md) §3.1 |
| 入库 | WMS 收货/上架；货物侧交接终点，非容器主链 | [CONTAINER_LIFECYCLE](./domain/CONTAINER_LIFECYCLE.md) §2.1 |
| 时间前缀 | `S计划/E预计/A实际 × TD离/TA抵`（std/etd/atd、sta/eta/ata）；预计≠计划 | [LIFECYCLE_CONSISTENCY](./domain/LIFECYCLE_CONSISTENCY.md) R0 |
| 来源权威 | 手工最高(锁，仅手工可改)；导入首次/冲突填充优先、可被二次导入/手工/API 更新；API 可被三者更新 | [INTEGRATION_BOUNDARIES](./domain/INTEGRATION_BOUNDARIES.md) §3.1 |
| 货柜标记 | 多变特征(危险品/需植检/含致冷剂/超限…)的受控集合，触发动作/卫式，不逐特征加列 | [CONTAINER_MARKERS](./domain/CONTAINER_MARKERS.md) |
| 滞港费（Demurrage/Detention/堆存） | 免费期跟踪/费率标准/预估/预警/对账/一键处置的**核心费用能力** | [PRINCIPLES](./PRINCIPLES.md) §1 |
| 交互身份切换 | 装箱后→卸柜前对外交互以**箱号**；卸柜后备货单号重新激活 | CONTAINER_LIFECYCLE §3 |
