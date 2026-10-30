# 供应商 profile 与稀疏映射操作

内部 canonical 不随供应商变化。当前只支持承运人、柜型、局部港口；不接网络、不建设码头全量字典。入口在仓库根目录运行：

```text
pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/reference-data/provider-profile.mts <command>
```

## 船公司初始目录与柜型依据

内部基准 `Logix/ocean_internal_baseline/1.1.0` 取 SMDG LCL **20261028** 为初始船司目录，快照日期为2026-10-30；原工作簿和逐行JSON保存在 `database/seeds/reference-data/smdg-liner-codes-20261028.*`。373条来源记录中362条代码在快照日可选、10条已到期、1条TFP的源日期非法而待核。该状态仅表示代码/日期有效，不代表营业资格、授权、信用或项目供应商已批准；有效期和VOCC/NVOCC空值保留，空分类不推断false。新公司不编造中文译名。

项目本次以SMDG代码建立内部初始目录，已有MSC/HMM代码保留；SMDG、SCAC、飞驼API参数不是同一命名空间（例如SMDG为COS/HLC/OOL，供应商写法可能不同）。原1.0.0仍可由旧profile绑定；本次不强行迁移这些映射。后续官方更新须项目另行确认基准版本，不自动刷新/覆盖。

12个柜型继续使用项目商用组合码，`standard_basis`记录BIC公开ISO 6346尺寸/类型指南：`https://www.bic-code.org/size-and-type-code/`、`https://www.bic-code.org/type-code-designation/`。`40HC`等不能唯一决定四位ISO尺寸类型码（还需高度/宽度/具体结构），不预填唯一ISO码，也不推导皮重/载荷。未复制ISO付费标准正文；SMDG网页未声明许可，保留`public-download; license-not-stated`而非伪造开放许可证。

```text
# 从保留的官方工作簿重建JSON；只检查用 --check
pnpm exec tsx scripts/reference-data/compile-smdg-liners.mts --check
# 只读回查；本地首次安装才加 --apply
pnpm exec tsx scripts/reference-data/internal-ocean-directory.mts
```

标准`pnpm db:seed`会补齐1.0.0和1.1.0；首次创建1.1.0在事务内切active，重复seed不重新选择当前版本、不更改旧行。同版本异内容拒绝。当前读取入口仍是`REFERENCE_INTERNAL_OCEAN_BASELINE.readBaseline()`，返回当前active版的可选船司和柜型及标准依据；不新增HTTP或字典管理平台。

## 新增供应商

1. 复制 `database/seeds/provider-profiles/freightower-reference-v2.json` 为新的 JSON，修改 `provider`、`version`、来源和数据集。
2. 每个数据集指定已有 `canonicalReleaseId`，声明输入命名空间。`logix`（承运人/柜型）与 `unlocode`（港口）直接校验已有基准，不写同值映射；供应商自有码或 SCAC 才按需加 mapping。
3. mapping 需要 namespace、sourceCode、canonicalCode、reason、evidence。尚不明确目标的候选允许 `canonicalCode: null`；不会参与正式解析。配置不接受审批字段或 confirmed。
4. 默认 audit，无写入：

```text
pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/reference-data/provider-profile.mts import database/seeds/provider-profiles/freightower-reference-v2.json
```

5. 本地确认差异后显式导入候选：同命令追加 `--apply`。目前 CLI 仅允许本地 `logix.public`，不打印连接凭据，不是生产发布工具。
6. 相同 provider/version 的内容不可变；同内容再次导入零新增，改内容必须新增 version。消费者明确传入版本，可切回仍可用的旧配置，不按最新版本猜测。已停用的错误版本不可回退使用。

## 查阅与解析不同

```text
pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/reference-data/provider-profile.mts inspect freightower reference-2026-10-29-v2
pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/reference-data/provider-profile.mts resolve freightower reference-2026-10-29-v2 container_type logix 40HC
pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/reference-data/provider-profile.mts resolve freightower reference-2026-10-29-v2 carrier scac MEDU
```

`inspect` 返回指定版本的候选及理由；`resolve` 只返回 `resolved`、`pending_review`、`unknown`、`unavailable`、`unsupported_namespace` 或 `rejected`。候选不向业务返回 canonical 目标。正式映射要求已复核记录、证据、配置一致及目标存在；本片不提供审批命令，也不建议直接 SQL 修改 confirmed。普通标准码只做字典校验，不依赖人工确认或全量同值映射。

模块消费者从 `master-data/index` 导入 `REFERENCE_EXTERNAL_OCEAN_MAPPING` / `ExternalOceanMappingDirectoryPort`，调用 `inspectProfile(provider, version)` 或 `resolve(query)`，不得导入 infrastructure。

## 已纠正的来源

- 原 `container-api-reference-2026-10-29` 三个 Freightower profile 保留历史但停用。
- `40HQ` 归 `logix_legacy/container-type-2026-10-30-v1`，不是本次飞驼官网采集结果。
- `CNFOC` 是供应商港区码；现有 UN/LOCODE 无同码，目标仍为空候选，不猜选 `CNFZG/CNFZH/CNFZX`。`USSAV` 可直接在现有标准库校验。
- 新增 JSON 只解决代码翻译配置，不代表该供应商的 HTTP 认证、签名、拉取或推送连接器已经实现。
