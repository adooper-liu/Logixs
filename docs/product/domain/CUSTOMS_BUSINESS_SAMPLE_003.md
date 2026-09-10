# 海关业务样本 003：CBP Entry Summary 三票结构参考

> 状态：真实脱敏批量样本 · 待业务确认 · 2026-09-08
>
> 边界：本样本包含三票相互独立的 CBP Form 7501，其中一票曾作为单票结构样本登记。它用于确认 Entry Summary 的稳定字段、商品行和税费结构，不证明货物已放行、已缴税、已清算或可提柜。

## 1. 证据登记

| 证据 ID | 文档类别                      | 结构             | 允许证明                                                                     | 不允许证明                                |
| ------- | ----------------------------- | ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| EVD-301 | CBP Form 7501 Entry Summary A | 多页、多商品行   | Entry Summary 文档已形成；包含 Entry、提单、进口主体、申报行、税费和日期字段 | CBP Release、货物可提、最终清算或付款完成 |
| EVD-302 | CBP Form 7501 Entry Summary B | 多页、多商品行   | 同上；可用于跨票核对字段稳定性                                               | 同上                                      |
| EVD-303 | CBP Form 7501 Entry Summary C | 2 页、6 个商品行 | 同上；曾作为本样本的初始单票证据                                             | 同上                                      |

原始 PDF 保留在仓库之外。真实 Entry Number、提单号、进口商编号、主体、地址、金额和商品信息不进入本样本文档。

## 2. 已观察结构

| 分组       | 字段                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| Entry 标识 | Filer/Entry Number、Entry Type、Summary Date、Entry Date、Import Date                      |
| 运输       | Importing Carrier、Mode of Transport、B/L or AWB、Foreign Port、U.S. Port、Location/Voyage |
| 主体       | Manufacturer ID、Consignee Number、Importer Number、Ultimate Consignee、Importer of Record |
| 申报行     | Invoice、SKU/商品描述、HTSUS、附加税则、毛重、数量、Entered Value、关系代码                |
| 税费       | Duty、Tax、Other、MPF、HMF、Total                                                          |
| 声明       | Declarant、Broker/Filer、签署日期                                                          |
| 表单元数据 | CBP Form 7501 版本及 OMB 信息                                                              |

## 3. 领域判定

| 项目           | 判定                                                           |
| -------------- | -------------------------------------------------------------- |
| 业务对象       | 三个独立案卷候选，不与 CASE-002 合并，也不得因模板相同互相合并 |
| 证据类型       | CustomsEntrySummaryEvidence                                    |
| 权威主体候选   | CBP 文档；传输来源和真实性仍需登记                             |
| 可生成候选事实 | Entry Summary 已形成                                           |
| 不可生成事件   | 海关已放行、Hold 已解除、税款已支付、可提柜                    |
| 当前节点       | 缺少关联货柜和流程，不能判定                                   |
| 下一节点       | 不推进                                                         |

Entry Summary 是申报与估价结果载体，不是 Release 状态。系统必须把 Entry、Release、Cargo/Manifest、Hold、Payment 和 Liquidation 分开建模。

## 4. 预检规则候选

| 规则 ID  | 规则                                                        | 失败处理                         |
| -------- | ----------------------------------------------------------- | -------------------------------- |
| S003-P01 | Entry Summary 必须关联 typed Entry Number、管辖区和表单版本 | 缺失时进入复核                   |
| S003-P02 | Invoice、提单、货柜和 Entry 的适用范围必须显式确认          | 不允许按相似号码合并案卷         |
| S003-P03 | 基础 HTSUS 与附加税则分别保存                               | 禁止拼成不可解析字符串           |
| S003-P04 | Duty、Tax、Other、MPF、HMF 和 Total 分开保存                | 对账不平时阻止确认               |
| S003-P05 | 日期按 Summary、Entry、Import、Export、签署分别建模         | 禁止用最新日期覆盖               |
| S003-P06 | 文档存在不等于 Release                                      | 不生成生命周期转移               |
| S003-P07 | 原始 PDF、字段抽取结果和人工确认分层审计                    | 低置信字段进入人工复核           |
| S003-P08 | 原产国必须来自各票案卷或申报行                              | 禁止从租户、模板或上一票静默继承 |

## 5. 待补齐

1. 与各 Entry 对应的商业发票、装箱单、提单和货柜。
2. 各文件的传输来源、获取时间和内容哈希。
3. 各票 Entry 接收/受理状态与 CBP Release、Hold 数据。
4. 税费支付和 Liquidation 证据。
5. 申报行金额、HTS 和税费的独立重算记录。
6. 每个 Entry 到货柜范围的业务确认。

## 6. 对契约的贡献

本样本可用于设计 CustomsEntrySummary、CustomsEntryLine、CustomsCharge 和 CustomsPartyReference 的字段草案，以及 7501 文档抽取预检。

本样本不能锁定放行状态码、放行证据等级、提柜守卫或主链状态。
