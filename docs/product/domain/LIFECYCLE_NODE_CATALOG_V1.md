# 货柜生命周期节点目录 V1

> 状态：**正式 V1（负责人批准）**  
> 契约 ID：`GC-001`  
> 版本：`1.0.0`  
> 最后更新：2026-09-09  
> 所有者：生命周期域负责人（刘志高）

## 1. 权威边界

本文件是 14 节点代码、固定顺序、可选性和事实模块归属的唯一业务权威。状态机负责节点实例状态和转换守卫，事件目录负责事件线值与完成资格，时间线负责事实时间和来源；三者不得重新定义 `LifecycleNodeCode`。

箱号尚未产生时只管理备货单及备货状态，不创建货柜生命周期流程。箱号产生并完成货柜建档后，才可创建 `FlowInstance` 并挂接已有备货完成事实。

## 2. `LifecycleNodeCode` V1

`definitionVersion = 1` 的节点集合和顺序固定如下：

| sequence | `nodeCode` | 名称 | 可选性 | 所有者 / 事实模块 | 可完成该节点的规范事件 | 完成后的货柜状态投影 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `cargo_ready` | 备货 | required | `booking-origin` | `cargo_ready` | `not_shipped` |
| 2 | `container_stuffing` | 装箱 | required | `booking-origin` | `stuffed` | `not_shipped` |
| 3 | `shipment_dispatch` | 出运 | required | `booking-origin` | `loaded` | `shipped` |
| 4 | `origin_departure` | 离港 | required | `ocean-port-visibility` | `departed` | `shipped` |
| 5 | `ocean_transit` | 海运 | required | `ocean-port-visibility` | `transit_arrived` 或 `arrived` | `in_transit` |
| 6 | `transshipment` | 中转港 | optional | `ocean-port-visibility` | `transit_departed` | `in_transit` |
| 7 | `customs_clearance` | 清关 | required，可按已批准业务适用性规则标记 N/A | `customs-compliance` | `container_customs_completed` | 不单独推导提柜状态 |
| 8 | `destination_arrival` | 到港 | required | `ocean-port-visibility` | `arrived` | `at_port` |
| 9 | `rail_transfer` | 海铁 | optional | `ocean-port-visibility` 与 `inland-fulfillment` 的公开端口 | `rail_handover` | 保持 `at_port` |
| 10 | `container_pickup` | 拖卡提柜 | required | `inland-fulfillment` | `gate_out` | `picked_up` |
| 11 | `warehouse_delivery` | 送仓 | required | `inland-fulfillment` | `delivered` 或 `warehouse_arrival` | 保持 `picked_up` |
| 12 | `container_unloading` | 卸柜 | required | `inland-fulfillment` | `unloaded` | `unloaded` |
| 13 | `container_unstuffing` | 卸空 | required | `inland-fulfillment` | `unstuffed` | 保持 `unloaded` |
| 14 | `empty_return` | 还箱 | required | `inland-fulfillment` | `returned_empty` | `returned_empty` |

表中的事件只表示完成资格，不表示事件到达后必然完成节点；最终仍必须通过状态机的实际时间、来源、证据、前序、阻断、适用性和并发守卫。

## 3. 已批准完成口径

- `sailing` 只记录海运已经开始或正在进行，`completionEligibleNodeCodes = []`，不得完成 `ocean_transit`。
- 直达航线以匹配目的港航段的实际 `arrived` 完成 `ocean_transit`；中转航线以匹配当前航段中转港的实际 `transit_arrived` 完成该海运阶段。
- `arrived` 可依次申请完成 `ocean_transit` 和 `destination_arrival`，每个节点应用独立执行守卫并按 `(eventId,nodeInstanceId)` 幂等。
- `delivered` 只有携带有效 POD、门岗或仓库签收证据时，才可完成 `warehouse_delivery`。
- `warehouse_arrival` 只有来自仓库、WMS 或门岗权威来源且证明指定货柜实际到场时，才可完成 `warehouse_delivery`。
- 司机单方点击、GPS 围栏、订单受理、预约、计划、预计时间和同步成功都不能完成节点。
- `rail_handover` 表示铁路主体或铁路场站实际接收指定货柜，不表示铁路接单或预约。
- 单案卷或单主体 `release` 不完成清关；只有货柜级聚合事实 `container_customs_completed` 可申请完成 `customs_clearance`。

## 4. 顺序、可选与适用性

1. `sequence` 是流程定义顺序，不是货柜粗粒度状态枚举。
2. required 节点不得由客户端跳过。optional 节点只有经 `SetNodeApplicability` 命令、权限与证据确认不适用后才能跳过。
3. 清关节点默认 required；业务明确无需清关时，使用受控 N/A 适用性规则，不得删除节点或伪造完成事件。
4. 未来节点事实可先保存为待应用事实；前序完成后逐节点重放，不允许一次跳到最远节点。
5. 异常、扣留、查验、延误、甩柜和取消与节点目录正交，不得新增为主链节点。
6. WMS 收货、上架与库存属于仓储专业流程；其中权威到场事实可以作为送仓证据，但不新增货柜主链节点。

## 5. 标识、版本与兼容性

- 公共线值为 `nodeCode`，使用 `snake_case`，一经发布不得改义或复用。
- 流程实例必须保存 `definitionVersion = 1`；节点实例保存 `nodeCode` 和 `activationNo`。
- V1 默认不允许主链节点重入。未来批准重入时，同一流程以 `(nodeCode,activationNo)` 唯一。
- 新增、删除、重排、改变可选性或改变所有者均为破坏性变更，必须发布新的流程定义版本并提供在途实例迁移策略。
- 中文名称、说明文字可兼容修订，但不得改变代码语义或完成口径。

## 6. 消费者

| 消费者 | 允许消费 | 禁止行为 |
| --- | --- | --- |
| 状态机 | 节点集合、顺序、可选性、所有者 | 复制或扩展节点枚举 |
| 规范事件目录 | `completionEligibleNodeCodes` 的目标集合 | 指向未登记节点 |
| 时间线 | `nodeCode` 归属与节点时间投影 | 用预计时间完成节点 |
| 任务与工单 | 节点实例关联与完成事实目标 | 让工单状态直接改节点 |
| API / 前端 | 稳定代码及本地化名称 | 从显示文案反推代码 |
| 数据库 | 通过显式映射持久化代码和版本 | 依赖偶然同名或 ORM 自动同步 |

## 7. 反向一致性校验

| 校验项 | 状态机 V1 | 时间线 V1 | 事件目录 V1 | 结论 |
| --- | --- | --- | --- | --- |
| 14 个代码、顺序与 2 个可选节点 | 一致 | 14 行矩阵一致 | 资格目标均属于目录 | 通过 |
| 海运完成口径 | `sailing` 不完成，到下一港实际抵达完成 | 同口径 | `sailing=[]`，抵达事件有资格 | 通过 |
| 送仓双事件口径 | 证据与来源差异守卫 | 同口径 | 两事件均只对 `warehouse_delivery` 有资格 | 通过 |
| 备货生命周期边界 | 建柜后挂接 | 无箱号不进入时间线 | `cargo_ready` 只完成节点 #1 | 通过 |
| 海铁实际交接 | 铁路实际接收 | 取实际接收时间 | `rail_handover=[rail_transfer]` | 通过 |
| 清关聚合事实 | 货柜级案卷聚合 | 专业事实挂接 | 单 `release=[]`，聚合事件完成 | 通过 |

## 8. 后续实例化

P6 将本目录实例化为 JSON Schema 单一源；在此之前不存在已批准的 TypeScript、Python、OpenAPI 或数据库枚举实现。任何演示 `railDefinitions` 只是消费者投影，不能成为反向权威。

