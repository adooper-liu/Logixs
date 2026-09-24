# 业务决策记录

> 本目录记录业务层长期决定；技术实现ADR仍位于 `docs/architecture/decisions/`。业务ADR说明“为什么和业务结果”，技术ADR说明“如何实现和约束”。

| ADR                                                                 | 决策                           | 状态              |
| ------------------------------------------------------------------- | ------------------------------ | ----------------- |
| [ADR-001](./ADR-001-shipment-business-identity.md)                  | Shipment作为内部稳定业务身份   | accepted-business |
| [ADR-002](./ADR-002-source-files-not-domain-tables.md)              | 四类来源表不是四张业务表       | accepted-business |
| [ADR-003](./ADR-003-import-and-flow-share-business-model.md)        | 导入与正常流程共用业务模型     | accepted-business |
| [ADR-004](./ADR-004-missing-sku-pending-completion.md)              | 无SKU允许建档并待补全          | accepted-business |
| [ADR-005](./ADR-005-material-sku-versioned-relationship.md)         | 物料与SKU分层并版本化关联      | accepted-business |
| [ADR-006](./ADR-006-separate-state-event-date-task.md)              | 状态、事件、日期与任务分离     | accepted-business |
| [ADR-007](./ADR-007-external-source-evidence-first.md)              | 外部来源先形成证据候选         | accepted-business |
| [ADR-008](./ADR-008-plan-does-not-overwrite-actual.md)              | 海运和港口计划不覆盖实际事实   | accepted-business |
| [ADR-009](./ADR-009-dispatch-plan-versioning.md)                    | 排柜采用计划版本而非覆盖       | accepted-business |
| [ADR-010](./ADR-010-external-writeback-controls.md)                 | 外部回写必须授权、幂等和审计   | accepted-business |
| [ADR-011](./ADR-011-supplier-identity-and-qualification-scope.md)   | 供应商身份与资格细化到生产工厂 | accepted-business |
| [ADR-012](./ADR-012-replenishment-decisions-and-execution-plans.md) | 补货决策与执行计划分离         | accepted-business |
| [ADR-013](./ADR-013-shippable-supply-pool.md)                       | 建立可出运供给池               | accepted-business |
| [ADR-014](./ADR-014-plan-versioning-and-ai-authority.md)            | 计划版本管理并限制AI权限       | accepted-business |
| [ADR-015](./ADR-015-logistics-blueprint-governance-closure.md)      | 出运全生命周期业务治理收口     | accepted-business |

`accepted-business`表示业务方向已经确认，但不表示代码、数据库或公共契约已经实现。实施状态以技术任务、迁移和验证证据为准。
