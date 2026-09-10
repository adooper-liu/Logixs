# @logix/contracts

公共契约运行时载体。当前任务阶段 G6 仅包含 JSON Schema Draft 2020-12、目录实例和验证 fixtures。

权威入口：

- `schemas/v1/index.json`
- 验证命令：`pnpm contract:check`

TypeScript、OpenAPI、Python 和数据库显式映射属于任务阶段 G7，当前目录不存在生成产物。

当前包为私有 `0.x` 预发布基线。`pre-release-breaking-changes.json` 只登记本轮对错误初稿的线值修正；校验器仅在包保持 `private` 且版本为 `0.x` 时接受这些例外。首次公开发布前必须清空例外并以发布基线开始兼容性比较。

当前覆盖边界：GC-001、GC-003、GC-011 已完整实例化；GC-002、GC-004 至 GC-010 只有局部 Schema，仍处 D3。`contract:check` 只验证现有产物内部一致性，不代表这些局部契约已完成逐字段 parity。
