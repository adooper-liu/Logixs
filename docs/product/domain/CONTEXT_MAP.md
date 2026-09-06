# 领域上下文与聚合边界（CONTEXT_MAP · v0.5 人话重构）

> 状态：**候选 v0.5** · 2026-09-06 · 负责人：刘志高。
> 一句话：把系统切成几块，说清每块管什么数据、和别块怎么传，谁也不能越界直连。
> 依据：MODULE_DEPENDENCIES（模块→公共入口）、ENGINEERING §3（依赖方向）、GLOSSARY、VISION 产品边界（货柜收端+WMS 对接+控制塔）。

## ① 可落库/关系清单

### A. 上下文与聚合（谁管什么）

| 上下文        | 职责(一句话)                                                | 聚合根                                                 | 首期落点    | 证实 |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------ | ----------- | ---- |
| Identity      | 登录/租户/角色/数据范围                                     | Tenant·User·Role                                       | P2-05/P5    | O    |
| Dictionary    | 港口/船司/柜型/币种别名与未知值                             | MasterDictionary·DictionaryUnknown                     | P2-04       | O    |
| Shipment      | 当前从已出运货柜列表承接货柜业务事实（一单一柜记录+状态机） | **ContainerRecord(主锚=备货单号)**；ShipmentPlan(候选) | P2-01~02/06 | O    |
| Import        | 当前把已出运货柜文件可靠导进来(批次/预检/审核/对账)         | ImportBatch                                            | P2-03/06    | O    |
| Integration   | 后续把上游与外部系统数据转换为统一业务输入                  | Adapter/Channel（具体模型待定）                        | 后续切片    | O·C  |
| AI Governance | 能力/风险分级/预算/审批令牌                                 | AiCapability                                           | P2-11       | O    |
| Audit         | 写操作留痕                                                  | 审计读模型                                             | P2-07       | O    |
| 相邻          | exception/notification/reporting/workflow                   | —                                                      | 各切片      | O    |

### B. ContainerRecord 组成（Shipment 内）

| 部分         | 内容                                                                    | 备注              |
| ------------ | ----------------------------------------------------------------------- | ----------------- |
| 主键/身份    | surrogate id · orderNumber(唯一锚) · containerNumber(迟绑定,非全局唯一) | 一单一柜          |
| 航次上下文   | 船司/船名航次/POL·POD/单证/时间(planned·actual)                         | ← sea_freight     |
| 港口作业序列 | origin/transit/destination × 时间/清关/免费期                           | ← port_operations |
| 运营后段     | 拖卡/卸柜/卸空/还箱（记录挂接）                                         | ← 三表            |
| 状态/时间    | currentStatus(8) · 各节点时间字段                                       | NODE_TIME_FIELDS  |
| 标记/扩展    | markers/attributes（受控键）                                            | CONTAINER_MARKERS |

### C. 公共端口（块与块怎么传，禁直连）

| 调用方 → 端口                                           | 用途                                |
| ------------------------------------------------------- | ----------------------------------- |
| Import → Shipment 写端口(applyContainerRecordPlan 候选) | 导入写入唯一通道；命中更新/未中新建 |
| Import/Dictionary 解析端口                              | 主数据归一，未命中→未知队列         |
| → Identity 授权                                         | 服务端对象级授权                    |
| Shipment → Dictionary                                   | 港口/船司/柜型校验引用              |
| → AI Governance                                         | AI 调用前置治理                     |
| 各写 → Audit                                            | 留痕                                |

### D. 四对象追踪（P2 门禁）

AI 产物(建议)→ 审核结果(人)→ 执行结果(行+orderNumber)→ 业务事实(ContainerRecord)；来源批次/行/操作者留痕（同 IMPORT D 表）。

### E. 关键决策（已确认）

| 决策         | 值                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------- |
| 聚合形态     | ContainerRecord=一单一柜整体（拖卡/仓库/还箱在聚合内）                                      |
| 主锚         | orderNumber（备货单号）                                                                     |
| 导入写       | 只经 Shipment 端口，Import 不持其仓储                                                       |
| 当前实施边界 | 备货单→出运的转换结果（已出运货柜列表）起，至还空箱；列表是所有后续节点的数据起点           |
| 接入演进     | 当前 Import 文件适配器；后续 Integration 直连适配器；二者进入同一 Shipment 应用写入边界     |
| 未来前端边界 | 向计划→采购→备货→订舱→出运延伸；上游对象归属待后续切片定稿，不复制出运后 ContainerRecord 链 |
| 产品边界     | Logix 本体=货柜收端+与 WMS 对接+控制塔；仓储内业为扩展线(VISION)                            |

## ② 定义与澄清

- "上下文"≈一块只管自己的事；跨块只走 公共端口/事件/契约，不 import 对方内部。
- ContainerRecord 管"货柜业务事实"；ImportBatch 管"导入这批活"，两者解耦。
- 当前 Import 与后续 Integration 只是不同来源适配器；二者都不能拥有或直接修改 Shipment 内的货柜事实。
- 相同箱号跨不同备货单＝不同记录（复用），非重复。

## ③ 规则与约束/边界

- 依赖方向：UI→Application→Domain←Infrastructure；Domain 不碰 ORM/Web。
- 业务 API 是认证/校验/最终写唯一入口；AI Service/Worker 不直写生产表。
- 主备货单号不作键；一备货单≤一柜；迟绑定可空。
- 当前范围外的计划/采购/备货/订舱前端只保留扩展边界，不在本切片提前确定聚合或表结构。

## ④ 流程（怎么用）

新改动先定位 属于哪个上下文 → 走其公共端口/契约 → 影响跨上下文须评审（MODULE_DEPENDENCIES/ADR 规则）。

## ⑤ 注意事项（坑）

- 别跨包 import 内部路径（只走公共入口）。
- 别让 Import/AI 直写业务表。
- 别把"上下文"当成表前缀即完事——依赖方向是硬约束。

## ⑥ 白话注解（🗣️）

🗣️ 系统像几家分工的部门：身份管人、字典管"标准叫法"、货柜这块管"柜子的实情"、导入是"收文件干活的入口"。部门之间只通过"窗口"传东西，不许互相翻抽屉；导数据想动柜子实情，必须走 Shipment 那扇窗，谁都不能抄近道直改。

## ⑦ 落库/实现映射

| 清单        | 落库/包                                      |
| ----------- | -------------------------------------------- |
| 上下文/聚合 | packages/{domain,contracts,...} 模块划分(P3) |
| 端口        | Application 用例/契约(public entry)          |
| 容器记录    | container_record + 关联表(FIELD_MIGRATION)   |
| 追踪键      | orderNumber→row→review→ai_artifact→audit     |

## ⑧ 待评审/关联

- 待定：ShipmentPlan/Booking 归属、写端口命名、Integration 适配器具体契约与上游上下文拆分。
- 关联：MODULE_DEPENDENCIES、IMPORT_DOMAIN_MODEL、CONTAINER_STATUS_MODEL、GLOSSARY、VISION。
