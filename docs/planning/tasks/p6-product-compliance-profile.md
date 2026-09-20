---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/structured-compliance-profiles
verification:
  - "2026-09-20 master-data 定向测试 7 文件/29 项、API lint/typecheck 与 Prisma schema validate 通过。"
  - "2026-09-20 pnpm db:verify:product-compliance-profiles 通过：旧库升级不猜测合规事实；空库完整迁移验证结构化档案、证书版本、幂等、乐观并发、租户与 SKU 隔离。"
  - "2026-09-20 pnpm validate 通过：仓库政策、契约校验/漂移、Prisma 生成、lint、格式、类型、全量测试（API 148 文件/696 项、Web 59 文件/189 项、Worker 5 项）、Playwright E2E（50 通过/7 条件跳过）与生产构建全部完成。"
---

# 任务：Product/SKU 结构化合规档案

> 路线条目：[`DOMAIN_VERTICAL_DELIVERY_PLAN`](../DOMAIN_VERTICAL_DELIVERY_PLAN.md) `1.3`。

## 目标

在 `master-data` 为稳定 Product/SKU 建立追加式、可版本化的结构化合规档案，明确保存电池、危险品、制冷剂、检验要求和证书版本事实，为后续 `cargo_ready` 合规评审提供可查询、可审计的输入。

## 边界 / 不做

- 遵循 [`PRODUCT_ATTRIBUTE_GOVERNANCE`](../../product/domain/PRODUCT_ATTRIBUTE_GOVERNANCE.md)：专业合规事实使用结构化模型，不以任意 JSON/EAV 代替。
- 本刀只拥有 SKU 长期合规属性；不修改 `shipment-registry` 装载事实，不创建法规规则、评审、发现、决定或生命周期放行。
- 证书文件仍由 `document-records` 拥有；本模块只保存证书稳定身份、版本化元数据和逻辑 `documentRecordId` 引用，不跨模块建立数据库外键。
- 国家、签发方等尚未落地的主数据不在本刀猜测创建；证书覆盖范围先限定为 ISO 3166-1 alpha-2 格式码，后续以兼容迁移绑定并校验正式参考数据身份。
- 不实现 HTTP/UI、动态属性模板、搜索投影或通用规则引擎；API、导入和人工入口后续均复用本刀公开 Application Port。

## 验收

- [x] 同租户 SKU 可写入并读取一个当前合规档案；不存在或跨租户 SKU 明确失败。
- [x] 档案更正追加新版本并保留旧版本，使用乐观版本阻止并发覆盖。
- [x] 同租户幂等键同载荷重放返回原版本，异载荷明确冲突。
- [x] 电池、危险品、制冷剂的未知/明确无/明确有语义分离；明确有时校验必要专业字段，明确无时拒绝残留专业参数。
- [x] 检验要求采用受控类型与状态；证书保存稳定身份、版本、覆盖国家、生效期、文件引用和核验状态。
- [x] 数据库约束覆盖租户父子关系、单一当前版本、版本链、数值范围、受控状态和证书版本关系。
- [x] 迁移验证覆盖空库、已有 SKU 数据升级、版本更正、幂等重放、跨租户和非法数据拒绝。
- [x] 高风险门禁通过：专项测试、迁移验证与 `pnpm validate`。

## 方案

1. 以 `ProductComplianceProfile` 作为 SKU 合规档案版本头，每个 SKU 仅一个 `active` 版本；更正通过 `supersedesProfileId` 追加版本。
2. 电池、危险品和制冷剂分别使用一对一结构化子表；检验要求使用一对多受控行。
3. `ProductCertificate` 保存租户内 SKU 的稳定证书身份，`ProductCertificateVersion` 追加版本；档案通过关联表锁定具体证书版本。
4. `REPLACE_PRODUCT_COMPLIANCE_PROFILE` 与 `GET_PRODUCT_COMPLIANCE_PROFILE` 作为公共 Port；Domain 统一归一化、跨字段校验和稳定载荷哈希。
5. Prisma Repository 在一个事务内锁定 SKU 和当前档案，完成版本/幂等检查、证书版本解析、旧档失效及新档写入。

## Review notes

- 档案、专业子表、证书身份和证书版本均归 `master-data`；证书文件继续由 `document-records` 拥有，保持逻辑引用。
- 档案版本头携带来源、渠道、证据、核验、操作者、原因、幂等和载荷哈希；`verified` 仍只是后续评审输入，不构成合规放行。
- 复合外键同时约束租户、SKU 和更正对象，拒绝跨 SKU 挂证书或串接版本链。
- 本刀不暴露 HTTP/UI；路线 `2.1` 继续实现规则适用性、评审、整改、决定、`cargo_ready` 查询门禁与最小工作台。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                          |
| ---------- | ------ | ----- | ------ | --------------------------------------------- |
| 2026-09-20 | coding | Codex | —      | 开始结构化 SKU 合规档案与证书版本运行时切片。 |
| 2026-09-20 | review | Codex | —      | 专项测试和真实迁移验证完成，进入完整门禁。    |
| 2026-09-20 | done   | Codex | —      | 完整门禁通过；路线下一刀切换为 `2.1`。        |
