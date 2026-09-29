# Logix业务资料

> 定位：面向管理层、业务负责人、产品经理和岗位用户的长期业务资料入口。

## 与 docs/ 的分工

| 目录  | 主要读者                 | 回答的问题                             | 表达方式                         |
| ----- | ------------------------ | -------------------------------------- | -------------------------------- |
| doc/  | 管理层、业务、产品、运营 | 为什么做、谁来做、如何协作、什么算完成 | 业务语言、流程、岗位、规则和案例 |
| docs/ | 架构、研发、测试、运维   | 如何实现、如何约束、如何验证           | 架构、领域契约、接口、迁移和测试 |

业务规则先在 doc/ 说明目的、责任和业务结果；实施时由 docs/ 中的正式契约承接。状态码、事件码、DTO和数据库结构不在两处重复维护。

岗位工作台的业务范围、目标、操作流程、共同人性化要求和完成标准只在
[`cross-border-supply-chain/03-sourcing-and-replenishment-workbenches.md`](./cross-border-supply-chain/03-sourcing-and-replenishment-workbenches.md)
与 [`cross-border-supply-chain/08-role-workbenches.md`](./cross-border-supply-chain/08-role-workbenches.md)
维护。`docs/` 中的 UI 规则、task brief、契约和测试只能引用并实现这些业务决定，不得另写一套业务规格；实施发现业务规则不成立时，先回到 `doc/` 或业务 ADR 修订，再改技术映射。

其中，`08-role-workbenches.md` 维护全部工作台清单、共同规则、复审顺序和已确认的岗位规格；`03-sourcing-and-replenishment-workbenches.md` 维护寻源与补货的专题规格。总表中的一句岗位结果只确认范围，不等于该工作台已经完成逐台复审或业务验收。

## 当前权威资料集

- [跨境电商端到端供应链业务蓝图](./cross-border-supply-chain/README.md)
- [统一业务资料索引](./cross-border-supply-chain/INDEX.md)
- [业务决策记录](./adr/README.md)

原备货前与出运后资料不再作为两个独立权威入口；它们已经在统一业务蓝图中按一条连续业务链重组。

早期原始讨论已移出业务规格目录，完整保存在
[`docs/archive/设计出运全生命周期数据模型-原始对话.txt`](../docs/archive/设计出运全生命周期数据模型-原始对话.txt)。
它包含已过期的阶段性结论、工具记录和失效路径，只作追溯证据，不属于当前业务规格，也不得作为实现或验收依据。
