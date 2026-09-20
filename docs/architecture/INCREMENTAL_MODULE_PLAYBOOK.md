# 增量模块开发手册

> 状态：**已接受工作纸** · 2026-09-17 · 锚定 [MODULE_PLUGIN_CONVENTION](./MODULE_PLUGIN_CONVENTION.md)、[MODULE_DEPENDENCIES](./MODULE_DEPENDENCIES.md)、[ADR-010](./decisions/ADR-010-bounded-context-modules.md)、[AGENTS](../../AGENTS.md)、[IDENTITY_ACCESS_MODEL_V1](../product/domain/IDENTITY_ACCESS_MODEL_V1.md)、[GC-008](../product/domain/ACTION_PERMISSION_CONTRACT_V1.md)。
> 白话：下一刀怎么切、先交什么、借 Odoo 哪些业务能力——按优先序照表做；不搬 ORM/XML/`_inherit`/热改 schema。

## 0. 怎么用本文

| 场景            | 读哪一节      |
| --------------- | ------------- |
| 开刀前对齐边界  | §1 提纲       |
| 写码/开 PR 自检 | §2 切片清单   |
| 排期下一刀能力  | §3 采纳优先序 |
| 明确永不照搬    | §4 不采纳清单 |

**硬约束（每刀都成立）**

- 依赖方向：`UI/Transport → Application → Domain ← Infrastructure`。
- Schema 只追加 `database/migrations/`；禁止运行时改模型。
- 跨模块只经公开 Port / `packages/contracts` / 领域事件。
- 写接口服务端授权；前端路由不是安全边界。
- 单任务串行：`docs/planning/tasks/` 同时最多一个 `coding`。

---

## 1. 提纲：一刀怎么切

```text
选上下文 → 写 brief → model → 权限 → control → view → 校验 → PR/合并 → 标 done
```

| 步  | 做什么                                                                  | 权威/样板                                  |
| --- | ----------------------------------------------------------------------- | ------------------------------------------ |
| 1   | 选定限界上下文（§3 挂靠模块）；写清目标 / 不做 / 验收                   | ADR-010、既有 task brief                   |
| 2   | `module.manifest.ts`：`id`/`kind`/`depends`/`permissions`               | MODULE_PLUGIN_CONVENTION §5                |
| 3   | **model**：`domain/` 规则 + `application/` 用例 + Prisma 映射 + 迁移    | 本模块 `domain/`、`database/schema.prisma` |
| 4   | **权限**：`security/permissions.ts` + `@RequireCapabilities` + 角色映射 | IDENTITY_ACCESS_MODEL_V1、GC-008           |
| 5   | **control**：`presentation/*.controller.ts`；输入 schema、分页、幂等    | 邻接模块 controller                        |
| 6   | **view**：`apps/web/src/modules/<id>/` 路由与导航；无业务规则进主题     | inland / notification 样板                 |
| 7   | 契约：共享 DTO/事件只进 `packages/contracts`                            | logix-contract-parity                      |
| 8   | 门禁：按风险跑最近检查；涉及 Prisma 的 CI 须 `db:generate`              | AGENTS §8、`.github/workflows/ci.yml`      |

**切片厚度建议**：一刀只交付一条可演示闭环（一例写路径 + 一例读路径 + 最少 UI）。「下一刀」写进 brief 的不做项，禁止同 PR 夹带。

---

## 2. 切片清单（开 PR 前勾完）

### 2.1 范围与 brief

- [ ] 有且仅有一个 `status: coding` 的 task brief；目标 / 边界 / 验收可勾选。
- [ ] 已声明挂靠模块与 `kind`（`base` | `incremental`）。
- [ ] 「不做」写清（通道、写状态、跨模块捷径、审批引擎等）。

### 2.2 模块与依赖

- [ ] 目录符合 `apps/api/src/modules/<id>/{domain,application,presentation,infrastructure,security}`。
- [ ] `module.manifest.ts` 存在；`depends` ⊆ 已有模块；Nest `imports` ⊆ `depends`。
- [ ] 公共出口只经 `index.ts`；无跨包内部路径引用。
- [ ] `pnpm repo:check` 通过（含 `check-module-manifests`）。

### 2.3 数据与契约

- [ ] 新表/列有迁移；命名 `snake_case`；代码 `camelCase`；显式映射。
- [ ] 非法输入失败，不用静默默认值。
- [ ] 写操作有事务 / 幂等 / 冲突策略（若适用）。
- [ ] 共享类型变更已走 contracts，无复制权威枚举。

### 2.4 权限与安全

- [ ] 能力码已登记并与 IDENTITY / GC-008 对齐。
- [ ] 写接口有认证；敏感读/写挂 `@RequireCapabilities`。
- [ ] 租户/对象范围在 Application 显式断言（无通用行级引擎）。
- [ ] 日志无密钥、Token、多余 PII。

### 2.5 UI

- [ ] Web 仅投影允许动作；不在前端做最终授权。
- [ ] `webNavContribution` 与 manifest 一致（若有导航）。
- [ ] 不直接依赖 `themes/*`（除主题注册入口/测试）。

### 2.6 验证与合并

- [ ] 最近回归：相关单测；触及 API/UI 关键路径时加 E2E（若风险要求）。
- [ ] 本地至少：`repo:check`、相关 `typecheck`/`test`；改格式则 `format:check`。
- [ ] PR 基于最新 `main`；CI `quality` 绿后合并；brief 改为 `done` 并记 commit。

---

## 3. Odoo 可借鉴能力：全部采纳 · 优先序

原则：**业务语义采纳，实现按 Logix 分层重做**。下列条目均纳入路线图；按 P0→P3 排期，不得跳过「不做」列去扩 scope。

### P0 — 加深已落地（下一刀默认从这里选）

| #   | Odoo 语义                | Logix 采纳内容                                        | 挂靠模块                               | 不做                           | 状态                 |
| --- | ------------------------ | ----------------------------------------------------- | -------------------------------------- | ------------------------------ | -------------------- |
| 0.1 | mail chatter（对象消息） | 货柜/任务/异常上的活动时间线；问题通知挂对象          | `notification` + 主链读模型            | Discuss 频道/私聊              | 第一刀已合；深化待开 |
| 0.2 | Activity / 下次动作      | 「到期做什么、谁负责」投影到工单/任务，不另造待办引擎 | `work-execution` / `lifecycle-control` | 通用个人 TODO 产品             | 第一刀已合           |
| 0.3 | mail_bot 上下文问答      | 从通知/对象打开只读助手；带对象摘要与允许动作说明     | `notification` + `ai-governance`       | 助手写业务状态、claim/complete | 第一刀已合；深化待开 |

### P1 — 高价值运营闭环

| #   | Odoo 语义           | Logix 采纳内容                                                    | 挂靠模块                                     | 不做                |
| --- | ------------------- | ----------------------------------------------------------------- | -------------------------------------------- | ------------------- |
| 1.1 | `base_automation`   | 领域事件 → 确定性动作（死信通知、ETA 漂移跟进、LFD 预警等）可配置 | `workflow` + `exception-management` + Outbox | 脚本引擎改业务结论  |
| 1.2 | `digest`            | 日/周运营摘要（滞留、死信、超期、待复核）推送到通知               | `notification` + `performance-improvement`   | 营销邮件平台        |
| 1.3 | documents/附件      | 附件即证据：版本、来源、绑节点/工单、可追溯                       | `document-records`                           | 企业网盘/知识库产品 |
| 1.4 | `portal`（窄）      | 清关行/车队/仓库：指定任务只读 + 回执写入                         | `identity` + 相关专业模块                    | 客户自助全站门户    |
| 1.5 | `barcodes` / GS1    | 扫描作为工单采集手段，码与证据绑定                                | `work-execution` + `document-records`        | 独立 WMS/库存账     |
| 1.6 | `resource`/calendar | 车队班次、仓库卸柜窗口等能力日历，服务 inland 计划                | `inland-fulfillment` + `master-data`         | 全员 HR 排班        |

### P2 — 借形状（中期，专业链成熟后）

| #   | Odoo 语义             | Logix 采纳内容                                    | 挂靠模块                                | 不做                    |
| --- | --------------------- | ------------------------------------------------- | --------------------------------------- | ----------------------- |
| 2.1 | stock/delivery 批次   | 同港同仓合并作业、批量认领                        | `inland-fulfillment` / `work-execution` | 通用库存数量账          |
| 2.2 | `fleet`               | 车队/司机作为执行资源主数据                       | `master-data` + inland                  | 车辆会计全套            |
| 2.3 | `account_followup`    | 费用逾期催办阶梯（提醒节奏，不代替账单真相）      | `charges-settlement` + `notification`   | 总账/税务引擎           |
| 2.4 | `rating` / `survey`   | 节点或供应商服务反馈回流改善                      | `performance-improvement`               | 营销问卷平台            |
| 2.5 | spreadsheet_dashboard | 运营指标板交互隐喻（只读投影）                    | `performance-improvement`               | 表格当业务真相源        |
| 2.6 | `project` 形状        | 异常/改善事项的阶段与负责人（挂异常，不替代主链） | `exception-management`                  | 用 Project 替代货柜主链 |

### P3 — 远期可选加深（仍采纳语义，排在主链之后）

| #   | Odoo 语义      | Logix 采纳内容                          | 挂靠模块                                           | 不做             |
| --- | -------------- | --------------------------------------- | -------------------------------------------------- | ---------------- |
| 3.1 | 伙伴主数据增强 | 外部主体档案与能力标签（支撑门户/分派） | `master-data`                                      | CRM 销售漏斗     |
| 3.2 | SMS/邮件通道   | 通知多通道适配（同一 Port，可插拔通道） | `notification`                                     | 群发营销         |
| 3.3 | 维护/质量隐喻  | 供应商/运力质量事件进异常与绩效         | `exception-management` + `performance-improvement` | MRP 质量模块整迁 |

**排期规则**

1. 同一时间只推进一个 P0/P1 切片进入 `coding`。
2. P2 不得插队挡住 P0/P1 的主链可靠性（同步、证据、权限）。
3. P3 仅在对应 Port 已稳定后开刀。
4. 每刀 brief 必须引用本文条目编号（如 `采纳 1.1`）。

---

## 4. 明确不采纳（避免「借鉴」变跑偏）

| Odoo 能力                        | 原因                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Discuss / Livechat               | 产品禁止统一聊天入口；能力须贴业务对象                                                        |
| mass_mailing / 营销自动化        | 非运营主链摩擦；与通知 Port 目标不符                                                          |
| Studio / 运行时改模型视图        | 与迁移唯一入口、代码化 UI 冲突；见 [ADR-011](./decisions/ADR-011-controlled-ui-projection.md) |
| 完整 MRP / Purchase / Sale / POS | 上游采购链属未来阶段；现会稀释货柜主链                                                        |
| Knowledge / Website              | 非当前运营摩擦主因                                                                            |
| 通用多层审批流引擎               | 原则 P9：按风险触发复核，非常规每单签核                                                       |
| `_inherit` / 热安装改 schema     | MODULE_PLUGIN_CONVENTION 非目标                                                               |

---

## 5. 建议的「下一刀」默认选项（降低摩擦）

`0.1+0.2` 已合入。2026-09-20 起，业务主线按[业务纵向交付路线图](../planning/DOMAIN_VERTICAL_DELIVERY_PLAN.md)执行：先完成 SKU/装载事实与合规纵向切片，再继续 `0.3` 助手深化和 `1.1` 通用自动化。两项仍保留在路线图，但不得在领域事实与门禁之前插队。

开刀前复制 §2 清单到 brief 或 PR 描述，勾选后合并。

---

## 6. 变更本手册

- 增删采纳条目或调整优先序：改本节并更新 [INDEX](../INDEX.md) 一句话。
- 触及部署/模块拆分：另立 ADR，不在本手册静默升级架构。
