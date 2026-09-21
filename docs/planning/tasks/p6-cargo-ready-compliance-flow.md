---
status: review # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/cargo-ready-compliance-flow
verification: local high-risk gates passed; PR CI pending
---

# 任务：`cargo_ready` 合规评审与生命周期门禁

> 路线条目：[`DOMAIN_VERTICAL_DELIVERY_PLAN`](../DOMAIN_VERTICAL_DELIVERY_PLAN.md) `2.1`。

## 目标

把当前 SKU、货柜装载事实和结构化合规档案组合成一次可审计的备货合规评审；只有绑定当前输入快照且仍有效的放行决定，才允许 `cargo_ready` 实际事实完成备货节点。

## 前置标准

- 时间采用 IANA 时区、UTC 持久化和 RFC 3339/ISO 8601 交换；币种采用 ISO 4217 和定点数，详见 [`TIME_CURRENCY_REFERENCE_CONTRACT_V1`](../../product/domain/TIME_CURRENCY_REFERENCE_CONTRACT_V1.md)。
- 上述标准本刀先约束输入与缺口处理；不扩建全量时区/币种后台，也不阻塞合规主线。

## 边界 / 不做

- `compliance-management` 拥有评审、发现和决定；不拥有 SKU 档案、装载事实或生命周期状态。
- 评审只读取 `master-data` 和 `shipment-registry` 的公开 Port，不跨模块直查内部表。
- 首刀冻结 `cargo_ready` 的评审/决定形态和查询门禁；国家法规全文库、任意规则表达式、AI 自动批准及八个完整岗位页面后置。
- 决定不直接推进生命周期；`cargo_ready` 实际日期事实仍须通过来源权威、证据、前序和生命周期事务。
- 装载集合或合规档案更新后，旧决定因输入快照不匹配而失效，禁止沿用。

## 验收

- [x] 可按货柜创建/重放一次评审，锁定当前装载集合、SKU、合规档案及适用规则版本。
- [x] 未装载、SKU 未绑定、缺少活动档案、档案未核验或规则覆盖不足时形成明确发现，不静默放行。
- [x] 有权限的决定写入采用幂等、乐观并发、证据和原因；历史决定不可覆盖。
- [x] 生命周期通过公开查询 Port 校验 `cargo_ready` 当前放行；缺失、阻断或快照过期时保留 `pending_application`。
- [x] 当前后端切片的成功、失败、边界、重放和并发路径有测试；迁移验证覆盖空库、旧库和关键约束。
- [x] 当前评审发现通过公开 Port 投影为独立非生命周期工作项；新版本取消旧开放项，重复/旧版本投影受保护。
- [x] 备货合规最小 UI 可选真实货柜、运行评审、查看规则/发现、提交决定并展示重放结果。
- [ ] 高风险门禁及 PR 必需 CI 通过。

当前功能范围已经收口：活动装载范围公开 Port、基础事实完整性评审、追加式规则版本、国家/日期/SKU/结构化属性适用性、证书有效性、版本化评审/发现/决定、`compliance.read/review/rule.manage` API、`cargo_ready` 查询门禁、决定后自动重放、独立整改工作池及最小 UI 均已落地。全量领取/完成型整改工单不在本刀；本地高风险门禁已通过，等待评审和 PR 必需 CI，因此进入 `review`。

## 验证证据

- `pnpm db:verify:cargo-ready-compliance`：通过旧库升级、空库迁移、规则/评审/决定版本链、整改投影幂等/关闭/旧版本拒绝及租户约束。
- `pnpm contract:check`、`pnpm contract:drift`、`pnpm docs:check`、`pnpm format:check`：通过。
- `pnpm validate`：通过；API `161` 文件 / `731` 测试，Web `62` 文件 / `196` 测试，E2E `50` 通过 / `7` 跳过，生产构建通过。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                  |
| ---------- | ------ | ----- | ------ | ----------------------------------------------------- |
| 2026-09-20 | coding | Codex | -      | 冻结时区/币种标准并开始 `cargo_ready` 合规纵向切片。  |
| 2026-09-20 | coding | Codex | -      | 完成规则版本、适用性、证书校验和评审规则快照。        |
| 2026-09-20 | coding | Codex | -      | 通过上层编排 Port 在放行决定后自动重放 pending 事实。 |
| 2026-09-20 | coding | Codex | -      | 整改发现投影到独立工作池，并接通备货合规最小工作台。  |
