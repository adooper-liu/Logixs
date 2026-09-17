---
status: done
branch:
verification: scripts/verify-import-product-lines.mts + pnpm validate + uv run pytest tests/test_capabilities.py (2026-09-16)
---

# 任务：导入时间事实与来源追溯

## 目标

把已确认的实际时间证据规则落到智能导入运行时：清关完成、卸柜完成、空箱确认和推导空箱时间分别建模，保留原值、来源 UTC 偏移、标准化 UTC、来源系统、证据或推导规则，并随备货单聚合在同一事务中落库。

## 边界 / 不做

- 权威业务规则见 `../../product/domain/TARGET_FIELD_CATALOG.md` §0.5/§D、`../../product/domain/LIFECYCLE_CONSISTENCY.md` R10-R12、正式 `../../product/domain/CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md` 与 `../../product/domain/CONTAINER_LIFECYCLE_STATE_MACHINE_CONTRACT_V1.md`。
- 时间事实独立建表，不继续膨胀 `container_record`，不把来源字段直接写成生命周期投影。
- 本切片不自动生成规范生命周期事件，不推进 `currentStatus`；证据核验、来源权威和状态机守卫仍须由正式事件晋升端口执行。
- 本切片只接受明确 UTC 偏移或 UTC；IANA 时区与夏令时歧义处理留待来源系统时区配置切片，不猜测服务器或用户时区。
- 不把导入时间、当前时间、入库时间或来源状态补成实际时间；不把遗留“卸空日期”当作实际卸柜/卸空时间。

## 验收

- [x] 共享字段目录以单一 JSON 权威新增时间事实、状态语义和来源字段，TS/Python 生成物无漂移。
- [x] 实际时间缺完成语义、来源系统、UTC 偏移或证据引用时预检阻断；状态完成但缺实际时间同样阻断。
- [x] 推导空箱时间固定为 `estimated + system_derived`，缺推导规则版本时阻断，且不能生成 actual。
- [x] 原始值、来源偏移、UTC、来源系统、证据/规则版本和导入来源行可审计保存。
- [x] 同一备货单重复表头冲突会阻断；时间事实与表头、产品明细在同一事务中同成同败并保留历史版本。
- [x] 旧六字段导入保持兼容，不映射时间字段时不新增要求。
- [x] 追加迁移通过空库/现有库验证，相关单元、真实数据库、契约及 `pnpm validate` 全绿。

## 方案

1. 扩展导入字段目录，数据化声明时间事实、配套完成状态和来源要求，由生成器派生 TS/Python 类型。
2. 先补时间解析、状态成对、来源完整性、表头一致性和旧流程兼容的回归测试。
3. 在 shipment-registry 新增版本化 `shipment_time_fact`，通过现有备货单导入公开端口事务写入。
4. 导入预检只接受带明确偏移的可确定时间；执行阶段只消费人工确认后的映射。
5. 前端沿用字段映射编辑器展示新增字段，不在 UI 复制领域校验规则；阻断原因由服务端返回。

## Review notes

（review 阶段填写）

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                    |
| ---------- | ------ | ----- | ------ | --------------------------------------- |
| 2026-09-16 | coding | Codex | —      | 开始实现时间事实与来源追溯纵向切片。    |
| 2026-09-16 | review | Codex | —      | 完成领域、契约、迁移与事务边界复核。    |
| 2026-09-16 | done   | Codex | —      | 完整门禁、AI 映射及真实数据库验证通过。 |
