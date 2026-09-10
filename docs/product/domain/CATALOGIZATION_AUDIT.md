# 清单化盘点：哪些"只有理论叙述"，还缺可落库的完整清单

> 状态：**盘点（2026-09-05）** · 用途：保证每个要点都可 评审/修正/理解/落成数据库表或库表值（Seed/字典/规则）。
> 判定标准：能否对应到「表 / 字段 / 枚举值 / 规则行 / Seed / 契约码」之一；只有"应该…必须…"而无取值清单的视为未清单化。
> 状态：`已清单化`(可落库/已有取值) · `部分`(有骨架缺全量) · `待产出`(纯叙述，须补清单)。

## 1. 已有清单（可直接落库/转 Seed/契约）

| 主题                     | 文档                          | 形态                    |
| ------------------------ | ----------------------------- | ----------------------- |
| 状态码                   | CONTAINER_STATUS_MODEL        | 枚举 8 值（DB enum 值） |
| 内部事件语义码           | EVENT_CODES                   | 清单 v0.1（A–E ~29）    |
| 动作码                   | ACTION_CATALOG                | 清单（组 A–E）          |
| 标记码                   | MARKER_CATALOG                | 清单初值                |
| 来源枚举                 | INTEGRATION §3.2              | 枚举初值                |
| 生命周期节点 L           | LIFECYCLE_CONSISTENCY §2      | 14 节点 + 可选 + 状态   |
| 柜型/港口/船司/仓库 字典 | 现网 seed + LEGACY_DB_CATALOG | 数据（含漂移待清）      |
| 字段级迁移映射           | FIELD_MIGRATION_MAP           | 表（列→落点→口径）      |
| 箱-单关系约束            | DATA_CLEANUP_ORDER_CONTAINER  | 约束+检测 SQL           |
| 标准字段目录             | TARGET_FIELD_CATALOG          | 表 v0.1                 |

## 2. 只有叙述/部分、需要产出"完整清单"的（本盘点结论）

| #   | 主题                                    | 现状                         | 需要产出的清单（形态）                                                     | 状态                         |
| --- | --------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- | ---------------------------- |
| C1  | 错误码                                  | 历史草案仅列族               | [PUBLIC_ERROR_CONTRACT_V1](./PUBLIC_ERROR_CONTRACT_V1.md) 完整码/HTTP/说明 | 已完成                       |
| C2  | 每 L 节点 计划/实际时间字段             | 叙述散落                     | **NODE_TIME_FIELDS 清单**（节点→planned/actual 字段/类型/来源）            | 待产出→本次                  |
| C3  | 预检/校验规则                           | IMPORT 叙述                  | **PRECHECK_RULES 规则清单**（ruleCode/级别/判断/落点→可落规则表）          | 待产出→本次                  |
| C4  | 五主体 放行/扣留/查验                   | STATUS §5 叙述               | **FIVE_PARTY_CODES 清单**（主体×扣留/放行/事件码）                         | 待产出→本次                  |
| C5  | 合法转换+卫式完整表                     | STATUS §3 有主链，缺卫式全集 | **TRANSITIONS 全表**（from×event×to×guard×证据）                           | 部分（并入状态文档补卫式列） |
| C6  | 标记→动作绑定矩阵                       | MARKER/ACTION 分列           | **绑定矩阵**（marker×action×卫式×去标规则）                                | 部分（并入 MARKER 或矩阵表） |
| C7  | 预警规则码/阈值                         | NODE_PDCA 叙述               | **预警规则清单**（code/类别/触发/阈值）                                    | 部分（外部枚举未全→待对拍）  |
| C8  | 港口/船司能力矩阵                       | 概念                         | 能力矩阵 **数据**（Seed 来源=现网/规范清单）                               | 数据抽取（非本文）           |
| C9  | 角色/权限                               | 无                           | 角色/权限清单                                                              | 待 P5 产出                   |
| C10 | 各节点 planned/actual→契约字段命名      | 部分                         | 契约字段表（并入 CONTRACTS）                                               | 部分                         |
| C11 | 库表值 Seed 全集（ports/carrier/type…） | 现网有                       | 迁移 Seed 脚本                                                             | P3/P2-04                     |

## 3. 产出物（本批新增，见各文件）

| 清单         | 文件                | 形态                                      |
| ------------ | ------------------- | ----------------------------------------- |
| 错误码       | ERROR_CODES_CATALOG | 码+HTTP+说明（Seed/契约）                 |
| 节点时间字段 | NODE_TIME_FIELDS    | 表（14 行×planned/actual/type/source）    |
| 预检规则     | PRECHECK_RULES      | 规则行（ruleCode/级别/判断/落点）         |
| 五主体码     | FIVE_PARTY_CODES    | 主体×扣留/放行/查验码（映射 legacy/规范） |

## 4. 约定（写所有清单文档时遵守）

- 每个条目给出：稳定码 / 中文名 / 定义或判断 / 角色或级别 / 归属（表·字段·节点）/ 证实度(S·R·O·C)。
- 值可直接映射为 表行、枚举、规则配置、或契约码；叙述只作该条的"用途注释"，不作主体。
- 未证实/未对拍条目一律 C 级并随 P2-12 转 S/R。

## 5. 关联

- 盘点随各清单产出回填"状态"；文档唯一入口在 docs/INDEX.md，不另设索引文件。

## 6. 人话重构队列（负责人 2026-09-05；最初示范=EVENT_CODES v0.2 / NODE_PDCA v0.2）

- 验收标准：每份文档做到"**可落库清单/表为主 + 一句话白话**"；叙述只作注释；能转 Seed/字段/规则行/契约码的不允许空谈（ENGINEERING §12）。
- 重构进度（完成时版本，现行版本见 INDEX）：✅ ① NODE_PDCA(v0.2，现 v0.8) ✅② CONTAINER_STATUS_MODEL(v0.4) ✅③ IMPORT_DOMAIN_MODEL(v0.3) ✅④ SHIPMENT_FLOW_OVERVIEW(v0.3) ✅⑤ CONTEXT_MAP(v0.4) ✅⑥ CONTAINER_LIFECYCLE(v0.4) ✅⑦ INTEGRATION_BOUNDARIES(v0.2) ✅⑧ LIFECYCLE_CONSISTENCY(v0.3) ✅⑨ DATA_MODEL_P2-06(v0.2) ✅⑩ FIELD_MIGRATION(已表化,补白话) ✅⑪ LEGACY_DB_CATALOG(已表化,补白话) ✅⑫ UX(已含白话)。本批人话重构完成。
- 每份完成后：在 docs/INDEX.md 更新其状态标注；本队列项打勾。
