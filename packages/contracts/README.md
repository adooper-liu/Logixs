# @logix/contracts

公共契约运行时载体。GC-001～GC-011 的 JSON Schema Draft 2020-12、目录、验证 fixtures 和 TypeScript 生成类型已实例化；字段、事件和生命周期目录通过显式包导出供运行时消费者读取。

权威入口：

- `schemas/v1/index.json`
- `catalogs/v1/post-departure-fields.json`（四张已出运维护表的 146 字段注册表）
- `fixtures/v1/post-departure-container-operational-source.json`（十张真实详情的只读 97 列对账输入）
- 包级验证命令：`pnpm --filter @logix/contracts contract:check`

包级 `lint`、`typecheck`、`test` 和 `build` 当前未配置；G7 生成对应技术载体并建立真实检查前，不使用 Schema 校验器冒充这些能力。根级 `pnpm validate` 会通过独立的 `pnpm contract:check` 执行当前 Schema 校验。

`pnpm contract:generate` 生成 TypeScript 契约、目录声明和现有 Python 导入字段目录；`pnpm contract:drift` 阻断生成物漂移。OpenAPI 和全部数据库显式映射仍未形成统一生成链，不能由现有门禁推定已经完成。

当前包为私有 `0.x` 预发布基线。`pre-release-breaking-changes.json` 只登记本轮对错误局部初稿的破坏性线格式纠正；校验器仅在包保持 `private` 且版本为 `0.x` 时接受这些例外。首次公开发布前必须清空例外并以发布基线开始兼容性比较。

`contract:check` 使用 Ajv 编译全部 Schema，校验 UUID/date-time 等格式、跨文件引用、11 项契约覆盖、目录属性、兼容性、8 类行为场景及正负向 Schema fixtures；同时验证出运后字段注册表恰好覆盖证据清单中的 146 个不同表头和 176 个来源位置。通过只证明已登记契约内部一致，不代表迁移已部署、OpenAPI 已生成或所有运行时消费者均已完成。
