# 外部集成冗余与故障转移设计（G1 · 候选）

> 状态：**候选（初稿）** · 2026-09-04 · 负责人：刘志高。
> 定位：闭环评审清单 G1——把现网已验证的 Adapter 模式与行业规范落成 TO-BE 设计，供阶段二与 P2-09 契约引用。
> 依据：现网 `IExternalDataAdapter/AdapterManager`（FeiTuo Primary / LogisticsPath Secondary / Custom Fallback、健康检查、自动故障转移、webhook、同步）、
> [INTEGRATION_BOUNDARIES](./INTEGRATION_BOUNDARIES.md)（外部矩阵/来源权威）、[INDUSTRY_STANDARDS_ALIGN](./INDUSTRY_STANDARDS_ALIGN.md)（订阅/查询/预警、数据源优先级 0港区>1船司>2飞驼/AIS3、dbtype、signature）、架构 §7.2/§3。

## 1. 目标与原则

- 目标：任何外部数据源（海关/港口/船司/飞驼/拖车/WMS/铁路）不可用或劣化时，系统能**健康感知 → 主备/故障转移 → 重试/熔断 → 受控降级**，核心业务不错误写入（架构验收：模型不可用不破坏业务事实）。
- 原则：
  - **数据源选择 ≠ 数据可信度**：provider 轮换只决定"从哪取"，可信度/优先级由 [来源权威 D7](./INTEGRATION_BOUNDARIES.md)（§3.1）与 source 决定；写库仅经业务 API（MODULE_DEPENDENCIES §3）。
  - 继承现网 AdapterManager 已验证模式，不另起炉灶；补：统一事件信封、去重/幂等、订阅/查询双通道、配置化策略。
  - 外部一律不可信：隔离解析、校验、未知进待处理（不静默默认）。

## 2. 组件设计（TO-BE）

- **IExternalDataAdapter（统一接口）**：每源一个实现，暴露
  `subscribe(businessNumber, …)→subscriptionId`、`queryStatus`、`events(增量)`、`health()`、`webhook(payload)`、`sync`。
  返回统一事件信封（eventCode/eventTime/isEsti/place/source/descCn·En/origin/dbtype，见 [CONTRACTS_DRAFT](./CONTRACTS_DRAFT.md)）。
- **AdapterManager**：注册/启停/默认/健康检查（周期）/状态；策略数据可配：
  - 每个能力维护 主(Primary)/备(Secondary)/回退(Fallback) 列表；
  - 健康失败 → 自动切换备用 → 全失败 → 走降级（明确失败/人工兜底，不静默写默认）；
  - 重试：指数退避 + 超时（每外部调用设超时，语义重试/熔断/降级，ENGINEERING §11）。
- **订阅 vs 查询双通道**：实时靠 订阅回调/webhook（带签名校验，HmacSHA1 头 `x-ft-*` 模式）；订阅缺失/回调中断靠 查询兜底轮询；频次按源配置（如铁路低频 2–30 条/日 → 低频轮询追加式入库）。
- **去重/幂等**：以 (subscriptionId/businessKey + 事件时间 + dbtype) 去重增量入库；重复到达不重复写业务事实。
- **区域/能力配置**：港口/船司能力矩阵与必填差异（宁波船名航次等，W4/W10）做成配置表，路由/校验按港司取值，防止"某港字段缺失致整单失败"。

## 3. 数据流（写库边界）

```text
外部源 → Adapter(订阅/查询/回调) → [校验/信封/去重] → 归一(内部码,source,D7) 
   → 业务 API 写端口(状态机/密封/来源权威/幂等) → 业务事实 + 审计
异常/预警事件 → exception/task(PDCA) → 通知/动作（ACTION_CATALOG）
```

- 任何源都不直写生产业务表；Provider 故障与业务事实隔离。
- 观测：每源健康/延迟/错误/切换次数/降级次数 → P8 指标与告警。

## 4. 降级矩阵（草案）

| 场景 | 行为 |
| --- | --- |
| 主源健康失败 | 自动切备/回退源；记录切换审计 |
| 全部外部源不可用 | 核心闭环：人工录入/映射或**明确失败**（不产生错误写入） |
| 单事件解析失败 | 隔离：该事件进待处理/对账，不污染其余 |
| 模型/AI 不可用 | 人工映射或失败关闭（架构 §7/产品基线） |
| 数据源可信度冲突 | 按 D7（手工锁优先；导入/API 更新规则）裁决 |

## 5. 落地与待办

- 阶段二按本节实现 Adapter 契约；健康/指标入 P8；签名/密钥经密钥管理（P5）。
- **待评审**：能力-源优先级静态配置 vs 动态评分；故障转移阈值（健康检查间隔/连续失败次数）；各源订阅频次与配额；密钥与回调签名管理。

## 6. 关联与维护

- 上链 G1 / [INTEGRATION_BOUNDARIES](./INTEGRATION_BOUNDARIES.md) / [CONTRACTS_DRAFT](./CONTRACTS_DRAFT.md) / ASIS GAP §2。
- 变更须评审；涉及架构 §19 先走 ADR。
