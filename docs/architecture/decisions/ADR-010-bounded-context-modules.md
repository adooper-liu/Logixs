# ADR-010：模块化单体内的限界上下文

> 状态：accepted · 2026-09-08 · 负责人：刘志高。

## 背景

系统以货柜流转为主流程，14个节点是顺序工序，22个运营环节是管理粒度。节点激活工序任务，工序任务产生一张或多张作业工单。全部放进 Shipment 会混淆状态机、数据所有权与事务边界；按节点建模块又会复制流程和工单规则。ADR-001 已确定采用模块化单体，本 ADR 补充限界上下文与协作规则。

## 决策

采用一个部署单元内的强边界模块，不按节点拆模块。系统划分为10个核心业务模块和8个支撑模块。

### 核心业务模块

| 模块                    | 拥有的数据与规则                                  | 不负责                 |
| ----------------------- | ------------------------------------------------- | ---------------------- |
| shipment-registry       | ContainerRecord、流转身份、订单/提单关联          | 流程转换、工单执行     |
| lifecycle-control       | FlowInstance、14节点、流程状态机、实际事件推进    | 人员工单、专业作业规则 |
| work-execution          | NodeTask、WorkOrder、动作授权、工单聚合与完成政策 | 直接改流程状态         |
| booking-origin          | 订舱、放箱、提空箱、装柜与起运前协同              | 海运跟踪、进口清关     |
| ocean-port-visibility   | 开船、在途、到港、靠泊、卸船、可提事实            | 清关决定、拖卡执行     |
| customs-compliance      | 出口申报、换单、进口清关、缴税与主体放行          | 费用结算、流程状态机   |
| inland-fulfillment      | 提柜、派送、卸柜、卸空、验箱、还箱                | 港口和海关事实         |
| charges-settlement      | Demurrage、Detention、Storage、修箱费、账单与对账 | 以费用状态推进主流程   |
| document-records        | 单证、附件、EIR、证据版本、归档和保留策略         | 决定业务状态           |
| performance-improvement | KPI、SLA、供应商绩效、复盘与改善措施              | 保存或改写业务底数     |

### 支撑模块

integration-import、exception-management、identity、master-data、notification、audit、workflow、ai-governance。

支撑模块提供接入、异常、权限、字典、通知、审计、持久化编排和AI治理，不拥有专业业务结论。

## 协作规则

```text
shipment-registry -> lifecycle-control -> work-execution
                                        -> 专业业务模块提供工单定义/规则
WorkOrder结果 -> NodeTask聚合 -> 规范事件 -> lifecycle-control
业务事实/事件 -> 费用/单证/异常/绩效投影或后续动作
```

- 模块只通过公开Application Port、共享契约或领域事件协作，禁止引用其他模块内部路径或Repository。
- 每个模块拥有自己的表和显式映射；可共享PostgreSQL实例，但禁止跨模块直接写表。
- 同步写链由Application层使用同库事务；跨事务传播使用Transactional Outbox，消费者必须幂等。
- work-execution不直接写FlowInstance，只提交规范结果事件，由lifecycle-control校验转换。
- 外部权威事件可先推进主流程，再由work-execution关闭、取消或创建补录/对账工单。
- Temporal编排等待、重试和补偿，不取代领域状态机或业务数据库事实。
- 当前保持模块化单体；只有独立部署、扩缩容、团队所有权或故障隔离证据成立时才另立ADR拆服务。

## 备选方案

- 单一Shipment大模块：拒绝，职责和数据所有权不可维护。
- 按14节点或22环节拆模块：拒绝，会复制任务、工单、事件和集成机制。
- 立即拆微服务：拒绝，当前没有隔离证据且会增加分布式事务成本。

## 后果与验收

- 新功能先选择限界上下文，再定义聚合、端口、事件和数据所有权。
- P3脚手架为上述模块创建公开入口并增加依赖方向检查。
- 现有shipment与logistics-status规划分别收敛到shipment-registry和lifecycle-control。
- 不存在同时拥有流程状态机和工单状态机的模块。
- 14节点只在生命周期定义一次，工单状态只在work-execution定义一次。
- 任一动作可追踪到WorkOrder、NodeTask、FlowInstance和ContainerRecord。
- 任一跨模块写入都有公共端口、事务边界、幂等策略和审计记录。
