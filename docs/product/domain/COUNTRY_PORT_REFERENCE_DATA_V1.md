---
status: approved-implementation-baseline
version: 1.0
date: 2026-09-23
owners: master-data + shipment-registry
---

# 国家与港口权威参考数据 V1

## 1. 结论

国家码以 ISO 3166-1 正式分配代码为权威；港口码以 UNECE UN/LOCODE 正式发布为权威。飞驼、云当及其他商业物流平台只可提供中文名称候选和交叉核验，不得创建、覆盖或纠正权威代码。

正式数据按发布版本不可变入库。Shipment 只接受已存在于 active 参考发布中的规范码；只有名称、旧 route code 或公司名的数据必须停在预检/人工映射，不得猜测：

- `AOSOM LLC` 是内部货主/美国分公司，不是国家码；它通过已确认的独立货主目录映射销售国家 `US`，不能写入航线目的国家字段；
- 原始中文港名不是 UN/LOCODE；
- 单候选也只是 `candidate`，没有业务复核不能自动变成 `confirmed`；
- 同一码可以有多条 UNECE 官方名称/变更记录，不能静默丢弃其中一条。

## 2. 本版来源与证据

| 数据集     | 权威来源                                                                | 版本/时间                        | 原始 SHA-256                                                       | 规范记录 SHA-256                                                   | 入库规模                                                     |
| ---------- | ----------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| ISO 3166-1 | ISO Online Browsing Platform `https://www.iso.org/obp/ui/#search/code/` | 2026-09-23 抓取                  | `22bd11973e2c5e6f3ac44be2c77cd4acefd0aa93d7c466933352f62028fb6ecb` | `387d85bff1b60b58324811b571d6c0534676d1ecb4a3231aa02bc0212f9a2199` | 249 个正式分配国家/地区代码                                  |
| UN/LOCODE  | UNECE 官方 2025-1 发布包                                                | 2026-01-15 发布，2026-09-23 获取 | `ad409fc7149b10f98d61190c34d9daf78b78bb8b31464cc66de1a89d09b01b5d` | `945289fe486046c4891c76035014fb9830447270195df828fc3344f350be6adb` | 116,533 源行；249 area；17,524 个港口身份；17,600 条港口源行 |

UN/LOCODE 港口筛选规则固定为：至少一条官方记录的 8 位 `Function` 第 1 位为 `1`。机场、铁路、道路、邮政等非港口地点不会仅因存在 UN/LOCODE 而进入港口目录。许可证按 UNECE 页面声明为 CC BY 4.0；ISO 数据使用须遵守 ISO Online Browsing Platform 条款。

## 3. 数据分层

```text
reference_data_release
  ├─ country_code_reference          ISO 正式代码
  └─ unlocode_area_reference         UNECE 国家/地区段，可选关联 ISO
       └─ port_code_reference        唯一 UN/LOCODE 港口身份
            ├─ port_code_entry       一码多条官方源行
            └─ port_name_alias       中文/外部名称候选与人工确认
```

`XZ` 表示 UNECE 的国际水域设施范围，不是 ISO 3166-1 正式国家，因此 `iso_country_id` 必须为空。未来发布使用新 release 和新记录追加，激活新版本时把旧版本标记为 `superseded`，不得覆盖旧记录。

## 4. 真实样本别名结果

| 原始名称              | 来源字段 | UNECE 候选                | 当前状态             |
| --------------------- | -------- | ------------------------- | -------------------- |
| 福州                  | 起运港   | `CNFZG`, `CNFZH`, `CNFZX` | 多候选，待人工确认   |
| 宁波                  | 起运港   | `CNNBG`, `CNNBO`          | 多候选，待人工确认   |
| 上海                  | 起运港   | `CNPDG`, `CNSGH`, `CNSHG` | 多候选，待人工确认   |
| 盐田                  | 起运港   | `CNYTN`                   | 单候选，仍待人工确认 |
| 洛杉矶                | 目的港   | `USLAX`                   | 单候选，仍待人工确认 |
| 纽约                  | 目的港   | `USNYC`                   | 单候选，仍待人工确认 |
| 萨凡纳                | 目的港   | `USSAV`                   | 单候选，仍待人工确认 |
| 长滩                  | 目的港   | `USLGB`                   | 单候选，仍待人工确认 |
| 乍浦港,平湖,嘉兴,浙江 | 途经港   | `CNZPU`                   | 单候选，仍待人工确认 |

候选证据来自真实详情 fixture，文件 SHA-256 为 `ced6ce06b1d2250cb637a0cc5388ac71e609bbab84985fbbbf8f9226e1b1a15c`。飞驼公开码头计划页显示上海、宁波、盐田等业务港口入口，云当提供港区/码头查询入口；两者均未提供可替代 UNECE 发布的授权代码全集，因此不进入 `reference_data_release`，也不据此确认具体 UN/LOCODE。

## 5. 运行与演进

- 结构迁移：`20260923170000_add_authoritative_location_reference_data`。
- 权威快照：`database/seeds/reference-data/`；标准 `pnpm db:seed` 幂等写入。
- 中文候选：`database/seeds/fixtures/post-departure-port-alias-candidates-20260923.json`。
- 专项验证：`pnpm db:verify:location-reference-data`，覆盖空库、旧版本升级、重复 seed、行数、歧义、非法代码、未复核确认和单 active 发布约束。
- 重新生成：运行 `scripts/generate-reference-data-snapshots.mjs` 并显式传入 ISO 浏览结果、UNECE 原始包、解压 CSV 目录和抓取时间；生成器会校验固定源规模和内容 hash。

新增发布时必须追加新快照和发布记录，重新执行差异评审。删除代码、合并地点、把 candidate 改为 confirmed 或让 Shipment 自动采用映射均属于独立业务变更，需要证据、审核人和回归测试。
