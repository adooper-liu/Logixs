---
status: coding
branch: feat/post-departure-shipment-lifecycle
verification: # 仅 status: done 时填入完整验证证据
---

# 任务：已出运 Shipment 生命周期闭环实施

> 唯一设计依据：[出运后核心模型差异 V1](../../product/domain/POST_DEPARTURE_CORE_MODEL_GAP_V1.md)。
> 本任务实现负责人已批准的 Shipment 粒度、统一 Handoff、加法迁移和真实样本闭环，不在 brief 复制第二套字段定义。

## 目标

让业务人员可以把已经实际出运的数据先预检、再原子接收为 Shipment 核心事实，并查看逐对象结果与下游吸收状态；后续事件以 Shipment/Container 正确主体推进，最终支持到港、清关、提柜、送仓、卸空、还箱和关闭。

## 边界 / 不做

- 保持现有 `CanonicalEventEnvelopeV1`、`StartLifecycleCommandV1` 和备货导入入口语义不变；新能力使用加法契约和迁移。
- 上游采购、分仓、供应商组合、备货单生成和现场装箱不由本任务实现，只保存稳定引用。
- 四张维护表定义 V1 字段覆盖下限，不复制成四张宽表；十张详情表只对拍只读 `container_operational_view`。
- T1 只原子提交 Shipment 核心事实与 Outbox；清关、内陆、仓库和生命周期由各自 Inbox 事务吸收。
- 不根据日期、件重体或金额推测 SKU、ATD、国家代码或已发生事件。

## 验收

- [x] 146 个原始表头具有规范字段码、所有者、类型、可空性、阶段必填、校验和目标处置。
- [x] `ShipmentHandoffCommandV1`、`CanonicalEventEnvelopeV2`、`StartPostDepartureLifecycleCommandV2` 及结果/错误契约完成生成与 parity。
- [x] 加法迁移支持 Shipment、柜关系、货物、单证、上游引用、版本/幂等和 Outbox，空库与旧库升级通过。
- [x] 统一 preflight 明确返回缺字段、未知字典、重复和业务冲突，不写正式业务表。
- [x] accept 在一个事务内保存首版核心事实、逐对象结果和 Outbox；同键同载荷重放返回原结果，异载荷明确冲突。
- [x] 一个 Shipment 可关联多个柜，一个柜次最多属于一个活动 Shipment；备货单与柜仍通过实际货物支持 N:M。
- [ ] 真实样本覆盖“预检 → 接收 → 一票查看 → 下游状态可见”；不完整样本进入 `review_required`，不伪造 ATD。
- [ ] `container_operational_view` 只读聚合并用十张详情 fixture 对拍，不提供整对象写回。
- [ ] 服务端认证授权、分页、稳定错误码、并发和租户隔离测试通过。
- [x] `pnpm validate`、契约门禁和专项迁移验证通过。
- [x] ISO 3166-1 与 UN/LOCODE 港口权威快照已版本化建档；中文港名按候选关系入库，歧义不自动升级为正式 Shipment 代码。

## 业务与数据协同设计

| 业务岗位要完成什么 | 操作时需要看到什么                                    | 系统允许做什么                                   | 数据如何可靠保存与反馈                                |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| 接收已出运数据     | 票、柜、SKU、提单、路线、离港证据、缺口和冲突         | 上传或接入、预检、修正映射、提交或转人工         | 原文件/来源行保留；规范 Handoff 计算哈希；T1 同成同败 |
| 确认导入结果       | 新增、重复、冲突、失败对象及下游吸收状态              | 查看逐对象结果、重试可恢复下游，不重复写核心事实 | 幂等键、版本、结果和 Outbox/Inbox 状态可追踪          |
| 跟踪在途与到港     | Shipment 下的柜、货物、单证、关键时间、专业状态和缺口 | 从只读详情进入所属业务域的受权动作               | 各域保存权威事实；投影带版本、来源和 `asOf`           |
| 完成后段生命周期   | 当前阶段、逾期节点、异常责任和关闭条件                | 录入/接收事件、处理异常、确认到仓还箱并关闭      | Shipment/Container 主体分离；事件历史和投影版本可重建 |

## 方案

1. 建立 146 字段注册表与来源映射，先关闭未知语义和数据质量门禁。
2. 新增公共 Schema 和生成类型，V1 保持兼容；入口 DTO 从生成契约显式映射。
3. 追加 Shipment 核心表与约束迁移，提供空库/旧库、租户隔离、N:M 和幂等专项验证。
4. 在 `shipment-lifecycle-orchestration` 编排 preflight/accept，在 `shipment-registry` 事务保存核心事实和 Outbox。
5. 增加 Shipment 查询与只读柜综合投影，再接入岗位页面。
6. 使用真实样本和十张详情 fixture 完成端到端对账。

## Review notes

- 实施中，尚未进入只读评审。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------ | ----- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-23 | coding | Codex | —      | 负责人批准主线切换；建立公共契约、加法迁移和统一接收纵向切片。                                                                                                                                                                                                                                                                                     |
| 2026-09-23 | coding | Codex | —      | 完成受保护 preflight/accept API、证据资格检查及首版 T1 原子接收；Shipment 头部事实更正仍明确拒绝，待独立版本事实模型后开放。                                                                                                                                                                                                                       |
| 2026-09-23 | coding | Codex | —      | 完成第二版 Handoff 更正：Cargo、柜关系、装载集合、运输单证和上游引用追加版本，关系版本乐观并发，生命周期推进后阻断静默改写；临时库验证首版/更正/重放/历史链。                                                                                                                                                                                      |
| 2026-09-23 | coding | Codex | —      | 完成 T2 生命周期初始化：Shipment 级 `departed` V2 事件只保存一次并冻结柜范围；按柜原子创建 11 个 `post_departure_ocean` 节点、应用事件、推进生命周期版本并同事务完成 Inbox。相同命令重放幂等，关系版本冲突全事务回滚。                                                                                                                             |
| 2026-09-23 | coding | Codex | —      | T2 专项验证通过：Prisma validate/generate、API lint/typecheck、962 项单测、18 项集成测试、契约 check/drift 与真实备货数据库基础验证；任务保持 coding，下一刀为 Shipment 只读查询投影。                                                                                                                                                             |
| 2026-09-23 | coding | Codex | —      | 完成 GC-010 Shipment 查询投影及 `GET /api/shipments`、`GET /api/shipments/:id`：租户/状态绑定游标、当前票柜货单引用聚合、逐柜装载、生命周期 pending/ready/manual_review 可见；真实 PostgreSQL 临时 schema 查询验证通过。                                                                                                                           |
| 2026-09-23 | coding | Codex | —      | 实现 `GET /api/containers/:id/operational-view` 首个实时聚合：一致快照读取当前 Shipment/柜关系、航次路线、单证/上游引用、Flow/节点、时间、任务工单、专业事实、证据、Block、同步与来源版本，并按任务/证据能力裁剪；真实 PostgreSQL 临时 schema 与租户隔离通过。GC-008 动作、异常案件、146 字段和十张详情对拍仍待后续切片。                          |
| 2026-09-23 | coding | Codex | —      | 完成四张维护表字段注册：146 个唯一表头、176 个来源位置逐项映射规范码、语义、所有者、主体、类型、可空性、阶段必填、校验、数据质量与目标处置；生成公共 JSON/TS 契约并用证据清单阻断遗漏、重复和漂移。`销往国家` 与损坏 `ETA修正` 保持隔离。                                                                                                          |
| 2026-09-23 | coding | Codex | —      | 将十张真实详情提取为 10 条 × 97 列只读对账 fixture，固定文件哈希、工作表、实际范围与对象身份；97 个详情表头全部映射到既有事实所有者，`卸柜方式` 按物流计划/仓库实际来源拆分。当前只完成来源对拍基线，尚未勾选运行时 `container_operational_view` 逐值对拍。                                                                                        |
| 2026-09-23 | coding | Codex | —      | 将真实详情 fixture 接入来源候选适配器，10 条记录逐值保留文件身份、柜/备货单/提单、航次路线、日期与件重体；因国家语义、港口码、离港时区/权威和 SKU 明细缺失，全部明确进入待复核，不伪造正式 Handoff。                                                                                                                                               |
| 2026-09-23 | coding | Codex | —      | preflight 接入数据库感知冲突检查：区分完全重复、幂等异载荷、Shipment 来源/业务号/关系版本、装箱快照、柜来源身份和柜活动 Shipment 冲突；非 ready 交接只保存待处理记录，不创建正式 Shipment。                                                                                                                                                        |
| 2026-09-23 | coding | Codex | —      | GC-008 登记首个真实动作 `record_lifecycle_date_fact`，综合投影返回目标、动作版本、可执行性和 Flow 并发版本；新增独立异常案件表并仅将 `open/investigating` 投影到 `activeExceptions`，异常与流程 Block 保持正交。真实正式接收与 97 列运行时逐值对拍仍未完成。                                                                                       |
| 2026-09-23 | coding | Codex | —      | 数据库专项验证发现并修正异常案件 `container_record_id` 与历史 `container_record.id` 的 UUID/TEXT 类型冲突；隔离 PostgreSQL schema 验证空库迁移、活动异常过滤、解决状态 CHECK、柜/Shipment 复合租户 FK、Shipment 查询和 `post_departure` 下游吸收。`pnpm validate` 全量门禁通过。                                                                   |
| 2026-09-23 | coding | Codex | —      | 建立 ISO 3166-1 与 UNECE UN/LOCODE 2025-1 全局主数据：249 个正式国家代码、17,524 个港口身份、17,600 条官方源行；真实样本 9 个中文地点形成 14 条 candidate 关系。保留 `XZ` 非 ISO area 和一码多官方条目，未复核别名不能自动确认；空库/旧库/幂等/约束专项验证通过，并已迁移、写入本地 `localhost:5433/logix/public`。                                |
| 2026-09-23 | coding | Codex | —      | 负责人澄清 `销往国家/国别` 实为内部货主公司名。新增 9 条负责人确认货主目录，严格分离航线目的国家、销售国家与货主名称；`UK` 内部简称显式映射 ISO `GB`，未知货主继续进入待复核。追加货主参考表与 Shipment 稳定引用，公共 Handoff/查询契约保持加法兼容。                                                                                              |
| 2026-09-23 | coding | Codex | —      | 货主映射完成空库/旧库升级、重复 Seed、ISO 外键与非法简称专项验证，并已应用到本地 `localhost:5433/logix/public`；75 条迁移 up to date，9 个货主均关联 active 发布。Handoff 数据库感知 preflight 会在提交前拒绝伪造或不一致的货主/销售国家组合；完整 `validate` 仅被用户已有文档缺失 8 张图片阻断，其余 lint/typecheck/test/E2E/build 独立门禁通过。 |
