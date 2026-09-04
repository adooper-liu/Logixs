# 标记字典初值 v0.1（MARKER_CATALOG，候选）

> 状态：**候选（初稿，待 P2 评审）** · v0.1 · 2026-09-04 · 负责人：刘志高。
> 定位：ContainerRecord 受控标记的**初值清单**（单一权威）；SKU 特征聚合打标规则与标记→动作见
> [CONTAINER_MARKERS](./CONTAINER_MARKERS.md)。定稿后实例化为 `dictionary` 标记字典（P2-04）。
> 每标记：内部固定码 + 聚合规则（来源）+ 关联动作（[ACTION_CATALOG](./ACTION_CATALOG.md)）+ 卫式/提示 + 撤销。

| markerKey | 中文 | SKU/货物特征聚合规则（触发） | 关联动作 | 卫式 / 提示 | 撤销（退出） |
| --- | --- | --- | --- | --- | --- |
| `dangerous_goods` | 危险品 | 任一装载 SKU 有危险品等级/属性 | `issue_dg_declaration` | 出运/装船前需 DG 声明完成（卫式）；预检提示 | 全部危险品 SKU 退出 + 人工复核 |
| `phytosanitary` | 需植检 | 任一 SKU 需植检 | `request_phytosanitary` | 提柜/清关放行前植检要求提示 | 同（SKU 退出 + 复核） |
| `refrigerant` | 含致冷剂 | 任一 SKU 含致冷剂/温控属性 | `apply_temp_requirement` | 装箱选柜/温控校验提示 | 同 |
| `over_limit` | 超限（超长/超高） | SKU/货物尺寸超限 | `notify_over_limit` | 装卸/承运确认提示 | 人工 |
| `requires_pallet` | 需打托 | 任一 SKU 含打托产品 | `forward_document`（装箱单含打托说明） | 装箱备注提示 | 同 |
| `requires_assembly` | 需装配件 | SKU 含装配件 | — | 装箱/仓库作业提示 | 同 |
| `inspection_required` | 需查验 | 备货单/货物查验要求 | 候选（验货预约） | 预检提示 | 人工 |

## 规则

- 打标/撤标沿生命周期可发生，来源权威 D7（SKU 聚合=系统推导 source=system/import；人工打标=手工锁）。
- 标记是**正交属性**，可作状态转换卫式与预检条件，不改变主链状态（CONTAINER_MARKERS §5）。
- 新增标记默认路径 = 本表加行 + 可选新增 actionCode/卫式配置；无独立字段（ENGINEERING_RULES §3.3）。

## 关联与维护

- 关联 [CONTAINER_MARKERS](./CONTAINER_MARKERS.md)、[ACTION_CATALOG](./ACTION_CATALOG.md)、[TARGET_FIELD_CATALOG](./TARGET_FIELD_CATALOG.md)（相关柜况字段如危险品等级）、P2-04 字典。
- 派生：P2-04 字典 seed、P6 预检/卫式、P2-09 契约。
- 评审定稿后转字典数据；本目录保留为指针。
