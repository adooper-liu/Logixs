# 滞港费（Demurrage/Storage）清单与口径 · v0.1 候选

> 状态：**候选 v0.1** · 2026-09-05 · 负责人：刘志高。
> 事实来源：`D:/Github/logix`（`ext_demurrage_standards`/`ext_demurrage_records`/`ext_container_charges`/`sys_configs`，两版 schema + seed；锚点 acfb50a8）。
> 计算实现现状：legacy 该功能标"待开发 0%"（PROJECT_STATUS），故 **公式与"预计/实际"语义为口径建议（C）**，现网仅有数据结构与种子示例。
> 🗣️ 白话：滞港费=柜子在码头/场站白占超了免费期，按天收钱。本文把"收什么费、标准长啥样、怎么算、预计怎么提醒、实际怎么对账"讲成能落库的清单。

## ① 费用类型字典（值）
| charge_type_code | 中文 | 含义 | is_chargeable | 备注 |
| --- | --- | --- | --- | --- |
| DEMU001 | Demurrage（滞期费） | 重箱超期占码头/堆场，按到港起算示例 | N(种子) | 另见 DETENTION 状态码(滞留标识,非费用) |
| STOR001 | Storage（仓储费） | 货物/堆存超期，按卸船起算示例 | N(种子) | 免费期另见 |
| default | — | 系统缺省：免费 7 天 · 币种 USD | — | sys_configs: demurrage.default_free_days / default_currency |

## ② 标准表结构（ext_demurrage_standards：合并两版为权威列口径）
| 键/字段 | 含义 |
| --- | --- |
| 匹配键 | destination_port(港) · shipping_company(船司) · transport_mode(运输,如 FCL) · terminal(码头) · charge_type(费用类型) · effective/expiry(生效区间) · foreign/forwarder(海外公司/货代) |
| 免费期 | `free_days`(天数) + `free_days_basis`(基准, 现网值=自然日；工作日未用→C) |
| 起算 | `calculation_basis`：`按到港` / `按卸船`（现网种子两值均出现） |
| 费率 | `rate_per_day` + `currency`（金额定点+币种） |
| 其它 | `port_condition`(港口状况档,如好/中)、`sequence_number`、`is_chargeable`、`process_status(ACTIVE)` |
> ⚠️ schema 漂移：`init-database.sql`(含 rate/currency) vs `init-database-complete.sql`(含 expiry/terminal/forwarder 缺 rate/currency) → 需并成一张权威表（rate+currency 必须有）。

## ③ 记录表（ext_demurrage_records＝实际结算）
`container_number(FK)` · `charge_type/name` · `free_days/basis` · `calculation_basis` · `charge_start_date/charge_end_date` · `charge_days` · `charge_amount` · `currency(默认USD)` · `charge_status` · `invoice_number/date` · `payment_date` · `remarks`。
> 语义：这是**实际费用/账单落点**（含发票与付款），预计不走此表。

## ④ 计算口径（C，待定稿）
- **公式**（建议）：`计费天数 = max(0, 计费结束日 − 计费起算日 − 免费天数)`；`费用 = 计费天数 × 日费率`（currency）。
- **起算基准区别**：`按到港`＝以到港(ATA/抵港)为起点（含靠泊前等待风险）；`按卸船`＝以卸船(完成)为起点（更晚、更宽）。二者影响免费窗口起点与应计天数，须在标准里选一。
- **免费基准区别**：`自然日`＝含周末/节假日逐日计；`工作日`＝仅计工作日（需排除周末/假日日历）——现网只用自然日；若接入工作日需日历源与节假表。
- **预计 vs 实际（关系）**：同一引擎、两种输入——
  - **预计滞港费**：用 计划时点(ETA/计划提柜/最晚) + 费率标准 前瞻计算 → 用于"事前预警/干预"(油门刹车)，目标是让预计归零；
  - **实际滞港费**：用 实际时点(ATA/卸船/实际提柜) + 结算账单 计算 → 对账/复盘归因（哪个环节导致这笔钱）。
  - 关系：预计应随事件推进不断校准，接近实际；实际以账单为准。
- **三种聚合**（同一底层）：按柜（单柜明细）/ 按柜·天（天级计费日）/ 按月（月度汇总）——仅投影不同，不重复存。

## ⑤ 其它口径/注意
- 依赖③组时间数据（到港/提柜等）与费率标准；到港→提柜为主参考区间，另可按 卸船/可提/还箱 扩展。
- 正常费用(清关拖卡汇总) + 滞港费 = 单柜总成本；滞港费是"预计可归零"的杠杆类费用（PRINCIPLES P4）。
- 五主体中 `运费 SRSD/SRSE` 是"运费未结放行"状态，与本费不同（FIVE_PARTY 保留）。

## ⑥ 落库/字段映射（建议）
| 概念 | 落点 |
| --- | --- |
| 费率标准 | demurrage_standard(港+船司+类型+区间+免费/基准+费率+币种+状态) |
| 预计 | 计算层(计划时点×标准) → 不落库或落 forecast 记录 |
| 实际 | demurrage_record(柜+起止+天数+金额+发票/付款) |
| 默认 | sys_configs(demurrage.*) |
| 单据 | 对账/报表（按月/柜/柜·天） |

## ⑦ 白话注解（🗣️）
🗣️ 一句话：**先有"各港各船司各费项"的费率标准（含免费几天、从到港还是卸船算、自然日还是工作日）；柜子超了免费期就按天算钱——事前用计划时间算"预计"来提醒别再拖，事后用实际时间和账单算"实际"来对账复盘**；同一笔底数按月/柜/柜·天三种看法看账。

## ⑧ 待定/关联
- 待定：计费日算法(整数天/含起算日)、免费期起算事件（到港/卸船/可提）、是否区分工作日。
- 关联：PRINCIPLES(P4)、CUSTOMS_OPERATION_CHAINS §⑤、FIELD_MIGRATION_MAP(§2.4/费用)、DATA_MODEL_P2-06、FIVE_PARTY_CODES、NODE_TIME_FIELDS(#10 提柜时间)。
