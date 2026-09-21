# 时区与币种参考数据契约 V1

> 状态：**负责人确认的正式 V1** · 2026-09-20 · 负责人：刘志高。
> 适用范围：所有跨国业务事实、截止日、日期证据、金额、费率、汇率、导入和外部接口。
> 一句话：时间统一换算成 UTC 但保留原始当地语义，钱统一用 ISO 币种码和定点数；地点、国家或供应商都不能替系统猜时区和币种。

## 1. 时间标准

Logix 使用 IANA Time Zone Database 的区域标识（例如 `Asia/Shanghai`、`America/Los_Angeles`）表达业务地点时区，使用 UTC 持久化确定时刻，使用 RFC 3339 兼容的 ISO 8601 字符串交换确定时刻。

- 禁止把 `CST`、`EST`、`PST` 等缩写作为权威时区；它们存在歧义。
- 固定 UTC 偏移（例如 `+08:00`）只描述某次原始证据当时的偏移，不是地点的永久时区。
- 地点和设施引用稳定的 IANA `timeZoneId`；同时记录采用的 IANA 数据集版本和生效期。
- 实际日期事实至少保留 `rawValue`、`sourceTimeZoneId` 或 `sourceUtcOffset`、`occurredAtUtc`、偏移来源、来源系统和证据引用。
- 计划、预计、实际的语义继续分开；时区换算不得改变 `timeKind`。
- 只有日期、没有时刻的业务截止日必须携带司法辖区或地点时区；不得按服务器时区解释。
- 夏令时重复时刻必须携带明确偏移或进入复核；夏令时跳空的不存在当地时刻必须拒绝，不能自动平移。
- 无法确认时区时保存原文并进入复核，禁止回退为 UTC、部署时区或操作者时区。

推荐交换形态：

```text
occurredAt: 2026-09-20T08:30:00Z
rawValue: 2026-09-20 01:30:00
sourceTimeZoneId: America/Los_Angeles
sourceUtcOffset: -07:00
timeZoneDatasetVersion: <pinned-IANA-release>
timeZoneResolution: supplier_declared | location_configured | manual_confirmed
```

`timeZoneDatasetVersion` 的示例仅表示字段形态；生产 Seed 必须写实际采用的 IANA 发布版本，不得写模糊的 `latest`。

## 2. 币种与金额标准

Logix 使用 ISO 4217 三字母代码作为业务币种主码（例如 `USD`、`EUR`、`CNY`），同时管理 ISO 数字码、法定小数位和生效期。金额始终使用定点十进制并携带币种，禁止使用浮点数。

- `currencyCode` 必须是已发布且在业务发生日有效的 ISO 4217 大写代码；历史币种仍按其有效期解析，不能被现行币种静默替换。
- ISO 数字码是参考标识，不取代三字母业务码。
- `minorUnit` 来自有版本的数据集；现金最小找零单位、支付渠道精度和会计舍入规则是独立策略，不能混同 ISO 法定小数位。
- 国家、语言、仓库、租户默认值和银行账户都不能单独推断业务事实的币种。
- 外部名称、符号（如 `$`、`¥`）或供应商代码必须经显式映射；歧义值进入复核。
- 金额更正追加版本并保留原币种；跨币种汇总必须显式引用汇率事实。

汇率不是币种字典属性。每条汇率事实至少包含：

```text
baseCurrencyCode
quoteCurrencyCode
rate
rateType
provider
observedAtUtc
effectiveFrom / effectiveTo
precision / roundingPolicyRef
sourceEvidenceRef
```

禁止用“当天汇率”这类无来源、无时点的值重算历史金额。

## 3. 主数据边界

本契约落在既有四类主数据边界中，不建立万能字典表：

| 类别       | 对象                                                   | 责任                                      |
| ---------- | ------------------------------------------------------ | ----------------------------------------- |
| 参考数据   | `TimeZoneDefinition`、`CurrencyDefinition`、数据集版本 | 保存标准身份、版本、生效期和停用/替代关系 |
| 地点设施   | `Location`、`Facility` 的 `timeZoneId` 引用            | 表达某地点在相应时期采用哪个 IANA 时区    |
| 业务伙伴   | 合同、账户或报价上的币种关系                           | 表达业务约定，不改写币种定义              |
| 供应商映射 | 外部时区、偏移、币种名称/符号到规范 ID                 | 处理来源差异和歧义，不能直接发布标准数据  |

不在 TypeScript 枚举中手抄完整 IANA 或 ISO 4217 列表。标准数据通过有版本、可重复执行、可审计的 Seed/导入进入数据库；代码只维护稳定状态和错误码。

## 4. 入口和失败规则

API、Webhook、文件导入和人工界面共用同一个解析与校验能力：

1. 保留原始值和来源上下文。
2. 解析规范时区/币种身份及适用的数据集版本。
3. 校验业务发生时点是否落在有效期内。
4. 生成 UTC 时间或定点金额事实。
5. 未知、歧义、停用或时区跳空明确失败或进入复核，不静默默认。

稳定错误码应覆盖：`TIMEZONE_UNKNOWN`、`TIMEZONE_AMBIGUOUS`、`TIMEZONE_LOCAL_TIME_INVALID`、`CURRENCY_UNKNOWN`、`CURRENCY_INACTIVE`、`CURRENCY_AMBIGUOUS` 和 `MONEY_PRECISION_INVALID`。进入公共 API 前须登记到 GC-011 并同步契约消费者。

## 5. 实施边界

- 本契约立即约束新代码、迁移、导入映射和外部 Adapter。
- 第一批运行时参考数据随需要它的纵向业务切片交付，不先建设全量维护后台。
- `cargo_ready` 首刀只引用已明确提供的日期和币种；缺少目标市场、业务日期或币种时形成显式缺口，不作推断。
- 后续地点/设施切片实现 IANA 数据集与地点时区关系；费用/报价切片实现 ISO 4217 数据集和汇率事实。

## 6. 关联

- [参考字典与业务伙伴主数据](./MASTER_DATA_DICTIONARY.md)
- [货柜生命周期时间线契约 V1](./CONTAINER_LIFECYCLE_TIMELINE_CONTRACT_V1.md)
- [外部来源时间判定 ADR-012](../../architecture/decisions/ADR-012-external-timestamp-timezone.md)
- [证据来源权威契约 V1](./EVIDENCE_SOURCE_AUTHORITY_CONTRACT_V1.md)
- [业务纵向交付路线图](../../planning/DOMAIN_VERTICAL_DELIVERY_PLAN.md)
