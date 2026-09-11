# @logix/contracts

公共契约运行时载体。任务阶段 G6 已完成 GC-001～GC-011 的 JSON Schema Draft 2020-12、目录和验证 fixtures 实例化。

权威入口：

- `schemas/v1/index.json`
- 包级验证命令：`pnpm --filter @logix/contracts contract:check`

包级 `lint`、`typecheck`、`test` 和 `build` 当前未配置；G7 生成对应技术载体并建立真实检查前，不使用 Schema 校验器冒充这些能力。根级 `pnpm validate` 会通过独立的 `pnpm contract:check` 执行当前 Schema 校验。

TypeScript、OpenAPI、Python 和数据库显式映射属于任务阶段 G7，当前目录不存在生成产物。

当前包为私有 `0.x` 预发布基线。`pre-release-breaking-changes.json` 只登记本轮对错误局部初稿的破坏性线格式纠正；校验器仅在包保持 `private` 且版本为 `0.x` 时接受这些例外。首次公开发布前必须清空例外并以发布基线开始兼容性比较。

`contract:check` 使用 Ajv 编译全部 Schema，校验 UUID/date-time 等格式、跨文件引用、11 项契约覆盖、目录属性、兼容性、8 类行为场景及正负向 Schema fixtures。当前 11 项契约均达到 D4；这只证明 JSON Schema 层完整且内部一致，不代表 G7 的生成类型、OpenAPI、数据库映射或运行时消费者已经实现。
