# 全链路样本 v0.5 分层编译与演示环境重建设计

> 状态：负责人已批准对话设计，待书面规格审核 · 2026-10-06
>
> 适用范围：仓外别名 `full-chain-workbench-sample-v0.5` 的只读盘点、分层编译、隔离演练，以及后续本地 demo 租户切换。
>
> 不构成：对原始样本真实性的采信、生产数据迁移授权、任何数据库删除授权、整包 Excel 导入许可、工作台成熟度或 WB-B10 验收结论。

## 1. 目的

项目需要用一套来源可追溯、跨工作台关系完整、可重复重建的数据替换当前本地 demo 租户的旧演示数据。目标不是把 Excel 单元格搬进数据库，而是建立一条失败关闭、可审计、可回退的样本发布流水线：

```text
仓外工作簿
→ 只读扫描与事实分级
→ 脱敏 canonical sample package
→ 隔离租户领域适配
→ 关键路径真实 API/E2E 验收
→ 经单独授权后切换本地 demo 租户
```

当前目标租户为 `demo-real-sample-20260921`。Schema、迁移、全局权威参考数据和其他租户不属于替换范围。

## 2. 已批准决定

### 2.1 重建范围

负责人选择“仅重建 demo 租户”：

- 替换 `demo-real-sample-20260921` 的演示业务数据；
- 同步处理该租户关联的领域记录、事件、任务、证据、幂等状态、Outbox/Inbox、导入批次和 MinIO 对象；
- 保留 Schema、迁移历史、ISO 国家/港口/币种、货主参考、全局来源权威政策和其他租户；
- 不重置 Temporal 自身数据库；只对与 demo 相关的 schedule/workflow 做清单、暂停、恢复和陈旧执行核对；
- 任何真实删除须在精确 manifest 审核后另行获得负责人授权。

### 2.2 数据等级

负责人选择分层导入：

| 等级 | 含义                           | 允许用途                 | 落库纪律                                                |
| ---- | ------------------------------ | ------------------------ | ------------------------------------------------------- |
| `R`  | 生成材料声明从真实源表直接取得 | 来源事实候选、字段对拍   | 保留来源引用与原值哈希；`R` 本身不替代数据责任方采信    |
| `D`  | 由真实来源按规则推导           | 可复算派生事实           | 必须携带来源、算法/规则版本和输入引用；不可改名为源事实 |
| `S`  | 为完整机制或异常路径构造的情景 | 本地演练、UI、自动化路径 | 必须明确标记 rehearsal/scenario；不得冒充实际发生       |
| `P`  | 待确认、缺失或无权威支撑       | 暴露缺口                 | 不进入 records，不填静默默认值，只进入 gaps             |

### 2.3 导入架构

负责人选择“样本编译器 + 领域适配器，关键路径 API 验收”：

- 编译器只读工作簿，生成稳定的 canonical package；
- 编译器不连接 PostgreSQL、MinIO 或 Temporal；
- adapter 按领域/Application 规则幂等写入，不直接把 Excel 行映射成数据库行；
- 真实用户主路径另用现有 HTTP API/E2E 验证；
- 不建设万能多 Sheet importer。

### 2.4 交付拆分

负责人选择四个薄 brief，当前只启动 Brief 1：

1. v0.5 样本清单与编译门禁；
2. 参考数据与 demo 清理准备；
3. 隔离租户领域适配器；
4. demo 租户切换。

### 2.5 负责人确认的执行顺序（2026-10-10）

负责人确认固定顺序如下，后续 brief 不得重排：

1. 先完成只读编译器，把工作簿编译为 canonical sample package，不修改数据库；
2. 再由领域 adapter 消费 package 写入演示库，禁止 Excel 直接导入数据库；
3. 写入或清理前先备份并验证恢复入口；
4. 只删除 demo 租户的旧业务数据，保留国家、港口、币种、Schema、迁移、全局参考数据和其他租户；
5. 最后通过真实页面核对新样本业务单据可见、旧演示单据不再出现。

当前只授权第 1 步。第 2 步写入、第 3 步备份执行、第 4 步删除和第 5 步页面切换验收均未开始，仍需各自 brief 与相应门禁。Brief 1 package 只包含六类中段 pilot records；市场、选品和产品开发/NPI 在后续写入阶段从同一工作簿经分级、编译和领域 adapter 承接，仍不得由 Excel 直接写库，也不得把 D/S/P 冒充来源事实。

## 3. 输入事实与证据边界

### 3.1 固定输入

仓外输入在仓内仅使用稳定别名：

```text
full-chain-workbench-sample-v0.5
```

绝对路径、精确 SHA-256、文件大小和修改时间属于仓外受控 manifest，不写入 Git、日志或模型输出。当前只在本机受控环境核验：

- 输入文件存在，且已在仓外记录精确 fingerprint；
- 33 个工作表；
- 无 VBA、无 Excel Table、无公式、无 defined names；
- 工作簿自述为“仓库外评审稿，非项目权威”；
- 包含 22 台样本、外部字段示例、费率/计算、异常、交接、对账、待确认、历史实绩、推导依据和 890 行样本构建清单。

固定 hash 只标识本次输入版本，不证明内容真实。换文件、换 hash 或 Sheet/表头漂移时，编译必须失败关闭，不能自动接受“更新版”。

### 3.2 仓库既有结论

本设计继承 [`2026-10-03-gc12.md`](./2026-10-03-gc12.md) §2.4：

- 样本包可用于目录/对象关系核对、字段与异常 fixture 候选及中后段 Adapter 对拍；
- 不得用于证明 G2/G3 真实业务路径、GC-012 稳定 V1、市场 KPI、WB-B10、生产验收或经营损失改善；
- 市场、选品、NPI 的核心结果主要为推导或构造；
- 最强真实连续链段是出运计划、备货、订舱、装箱、出口报关和出运；
- 商业敏感原件、完整原始行和未批准派生物不得进入 Git、普通 Seed、测试快照、日志或对外材料。

### 3.3 当前系统能力

当前仓库没有：

- demo tenant purge 命令；
- reference-only seed 命令；
- v0.5 全链路 importer；
- PostgreSQL、MinIO、Temporal 三域统一备份/恢复命令。

现有能力仅包括：

- `database/seed.ts` 混合写入权威参考数据、货主参考和旧 demo 补货样本；
- 通用 import batch 只读取第一个 Sheet，落旧补货/货柜兼容链；
- `post_departure_standard_v1` 只接管 Shipment + 柜及可选 SKU；
- 当前开发身份 `operations_dispatcher` 只有 `import.read`，没有 `import.operate` / `import.execute`。

因此当前不能安全执行“清库后导入 v0.5”。

## 4. 总体架构

### 4.1 四阶段流水线

#### 阶段 1：扫描与分级

输入工作簿以只读模式打开，禁止执行宏、公式、外部链接或数据连接。扫描器输出：

- 文件 fingerprint；
- Sheet 清单、尺寸、表头指纹和有效记录范围；
- 每个 Sheet 的工作台归属与允许用途；
- 主键、业务键和跨 Sheet 引用候选；
- 字段类型、日期精度、时区、金额和币种候选；
- 敏感字段和处理策略；
- R/D/S/P 分级；
- 待负责人确认与未获权威写回的规则。

扫描阶段不产生可发布 records。

#### 阶段 2：编译

编译器将已分级输入转换为脱敏 canonical package。转换是确定性的：相同输入 hash、编译器版本、mapping 版本和政策版本必须得到相同 package hash。

编译器负责：

- 规范化日期、时区、定点金额、币种和稳定业务键；
- 保存 lineage，不复制不必要的敏感原文；
- 重新计算 D 值并与表内值对账；
- 将 S 值标记为 rehearsal；
- 将 P、未授权规则和系统无承载能力字段送入 gaps；
- 检查重复键、断链、数量/金额/时间和交接一致性；
- 给出 `publishable` 结论。

编译器不决定业务状态，不创建数据库 ID，不写数据库。

#### 阶段 3：隔离演练

使用独立 rehearsal tenant 和独立 MinIO prefix。adapter 按业务依赖顺序消费 package，并通过领域/Application 服务写入。

首批只覆盖真实度最强且系统承载已存在的链段：

```text
出运计划 → 备货 → 订舱 → 装箱 → 出口报关 → 出运
```

没有正式领域承载的 Sheet 保留在 gaps，不为完成演示临时加表或绕过状态机。

演练要求：

- 每个 adapter 幂等；
- 分批写入有明确事务边界；
- 任一批失败不发布 package；
- 关键业务路径通过真实 API/E2E；
- package 重放不产生重复业务记录、事件或对象；
- 数据库、对象存储和事件投影可对账。

#### 阶段 4：demo 切换

这是唯一允许删除旧 demo 数据的阶段。执行前必须：

1. 停止 API/worker 或进入维护模式；
2. 暂停 demo 相关 Temporal schedule/workflow 消费；
3. 生成并审核 PostgreSQL/MinIO/Temporal 精确 manifest；
4. 完成并验证备份恢复演练；
5. 验证 rehearsal package 全绿；
6. 向负责人展示精确删除范围并取得当次明确授权。

切换顺序：

```text
备份旧 demo
→ 按 manifest 清理 demo 业务域
→ 从已批准 package 幂等重建
→ DB / MinIO / Outbox / 页面联合对账
→ 恢复 worker 与 schedule
```

失败时恢复旧 demo，不在失败环境上叠加修复性数据。

## 5. Canonical sample package

### 5.1 目录

默认输出到仓外受控目录；不自动提交 Git：

```text
full-chain-v0.5/
├─ manifest.json
├─ records/
│  ├─ shipment_planning.json
│  ├─ cargo_ready.json
│  ├─ booking.json
│  ├─ stuffing.json
│  ├─ export_customs.json
│  └─ dispatch.json
├─ lineage.jsonl
├─ gaps.json
├─ checks.json
└─ report.html
```

`records/` 只出现已有批准 mapping 且通过所有门禁的工作台。目录不以 33 个 Sheet 全量占位制造完成感。

### 5.2 Manifest

`manifest.json` 至少包含：

- `sourceFileAlias`，不得包含私人绝对路径；
- `sourceSha256`、字节数、最后修改时间；
- workbook 版本、Sheet 数；
- compiler/mapping/policy 版本与 Git commit；
- package hash；
- 编译时间和运行者；
- records/gaps/checks 的数量与 hash；
- `publishable`；
- 允许证明与禁止证明；
- 敏感数据处理声明。

### 5.3 Record envelope

每条 canonical record 统一包含：

```json
{
  "recordType": "shipment_plan",
  "recordVersion": "v1",
  "businessKey": "...",
  "sampleLine": "A_CA",
  "evidenceClass": "R",
  "source": {
    "sheet": "09_出运计划",
    "row": 5,
    "sourceRef": "...",
    "originalValueHash": "..."
  },
  "derivation": null,
  "scenario": null,
  "payload": {}
}
```

规则：

- D 的 `derivation` 必填，包含算法 code/version 和输入引用；
- S 的 `scenario` 必填，包含 rehearsal 标签和不允许证明；
- P 不得出现在 records；
- payload 只能包含该 recordType schema 允许的字段；
- 不保存 Excel 绝对路径、人员姓名或无当前消费者的敏感原文；
- businessKey 来自业务身份，不使用数据库 UUID 或行号代替。

### 5.4 Gaps 与 checks

`gaps.json` 记录：

- P 单元格；
- 无权威写回规则；
- 无系统承载能力的 Sheet/字段；
- 无法解析的日期、时区、金额、币种；
- 缺失键和断裂引用；
- 敏感处理未批准项。

`checks.json` 记录可重复的机器对账：

- Sheet 行数和唯一键；
- 跨 Sheet 引用完整性；
- 合同数量、装载数量、箱数、重量、体积和金额；
- 日期顺序和精度；
- 交接链上下游对象范围；
- 工作簿 `22_对账` 的重新计算结果，而不是直接采信其“结论”。

## 6. Brief 1：样本清单与编译门禁

### 6.1 目标

以零数据库写入完成 v0.5 的确定性扫描、分级、编译和失败关闭。它只证明 package 可重复生成、来源与缺口可追溯，不证明任何工作台完成。

### 6.2 产物

仓库内允许提交：

- 编译器源代码与测试；
- canonical schemas；
- workbook 结构指纹的脱敏 fixture；
- 不含原始业务值的 mapping/policy；
- 文档化的允许证明/禁止证明；
- 对当前固定 hash 的检查配置。

仓库外保留：

- 原始 workbook；
- 完整 manifest；
- records、lineage、gaps、checks 和 report；
- 可能反推出商业信息的 hash 清单或映射材料。

是否把任一脱敏 records fixture 提交 Git，必须在 Brief 1 产出后按实际字段重新审核，当前不预授权。

### 6.3 安全门禁

- 只接受 `.xlsx`，拒绝加密、宏、外链、未知压缩成员；
- 限制文件字节、解压比、Sheet 数、行列数、单元格文本长度；
- 不执行公式；公式单元格一律失败或进入 gap，不能读取缓存值冒充计算；
- 不把绝对路径、原始单元格、人员/供应商/合同/运输标识写日志；
- 输出采用安全目录和原子替换，不覆盖未声明路径；
- package 消费者必须拒绝 `publishable=false`、未知版本或 hash 不一致；
- 编译器进程无数据库、对象存储和 Temporal 凭据。

### 6.4 失败关闭

以下任一条件令 `publishable=false` 且命令非零退出：

- source hash、Sheet 数、Sheet 名或表头指纹漂移；
- R/D/S/P 未分类或 P 泄漏 records；
- D 缺 derivation，S 缺 scenario；
- 重复业务键、断裂引用或类型非法；
- 日期缺精度/时区，金额缺币种；
- 敏感字段无处理策略；
- 未写回 doc/ADR 的对话规则进入 records；
- 重新对账与工作簿声明不一致；
- 输出不确定或重复编译 hash 不一致。

诊断产物必须标明不可发布，下游 adapter 拒绝消费。

### 6.5 验收

- 同一输入跨两次运行 package hash 完全一致；
- Windows/Linux 路径与换行不影响输出；
- 表头漂移、断链、重复键、P 泄漏、未授权规则、敏感字段、异常 Excel 均失败关闭；
- 报告列出 33 Sheet 的处置：records / evidence-only / gap / unsupported；
- 原件和完整业务值不进入 Git、日志、测试快照或模型输出；
- 运行期间 PostgreSQL、MinIO、Temporal 的连接数和数据不变；
- 独立复审确认不允许证明边界没有被弱化。

## 7. 后续 Brief

### Brief 2：参考数据与 demo 清理准备

只交付：

- `reference-only seed`；
- 旧 demo seed 独立命令；
- demo tenant purge dry-run；
- PostgreSQL/MinIO/Temporal manifest；
- 备份恢复 runbook 和隔离恢复演练。

默认零删除。purge 工具没有显式 `--execute` + 精确 manifest hash + 当次授权时必须拒绝运行。

### Brief 3：隔离租户领域适配器

- 独立 rehearsal tenant；
- 独立 MinIO prefix；
- 首批中段真实链路 adapters；
- 领域/Application 校验、幂等、事件和快照；
- 关键 API/E2E；
- unsupported gaps 保持可见。

不在该 brief 删除旧 demo。

### Brief 4：demo 租户切换

- 冻结写入和异步消费；
- 备份、恢复演练证据；
- 精确删除 manifest；
- 负责人当次删除授权；
- 清理、重建、对账、恢复；
- 失败回滚。

该 brief 的 `done` 必须以真实切换证据为准，代码和 CI 通过不能代替。

## 8. 数据存储边界

### PostgreSQL

只清 demo tenant 业务域。参考表、迁移、全局政策和其他租户不得进入 purge manifest。Outbox/Inbox、事件、任务、证据和导入批次必须按所属对象一致处理，不能当普通日志保留或全表清空。

### MinIO

先从 import batch 和领域对象建立对象 key manifest。备份并校验后才能删除 demo 对象。数据库提交与对象删除无法同事务完成，因此要有可重试清理状态和 orphan 报告。

### Temporal

Temporal 数据库不是业务库，不执行全库 reset。切换前记录并暂停 demo 相关 schedule/workflow，处理或终止策略须逐类说明；切换后验证不存在旧事件继续写入新 demo。

## 9. 权限与审计

- 扫描/编译不需要生产 capability，但需要受控读取原件；
- adapter 执行沿用各领域服务端 capability，不由编译器绕过；
- purge dry-run 与 execute 应使用独立、窄权限 capability，不能复用普通 `import.execute`；
- 当前 development `operations_dispatcher` 无 import 写权限，不能通过 UI 角色切换绕过；
- 每次编译、演练、删除和发布记录 operator、package hash、manifest hash、时间、结果和追踪 ID；
- 日志不含原始敏感值。

## 10. 可观测性与恢复

每一阶段产出独立回执：

- scan receipt：输入 fingerprint 与扫描统计；
- compile receipt：package hash、publishable、错误与 gap 数；
- rehearsal receipt：各 adapter 输入/落账/失败数量；
- purge receipt：manifest hash、删除数量、对象清理状态；
- publish receipt：重建数量、对账、页面验收和恢复点。

恢复原则：

- Brief 1 无外部写入，删除仓外输出即可；
- Brief 2 默认 dry-run，无删除；
- Brief 3 删除 rehearsal tenant/prefix 即可，不影响旧 demo；
- Brief 4 失败时恢复旧 demo 备份，不在半成品上人工补 SQL。

## 11. 明确不做

- 不把原始 workbook、完整 manifest 或敏感数据提交 Git；
- 不把整包做成生产 Seed；
- 不建立通用 Excel → 任意表引擎；
- 不从样本反推业务权威、状态机、时限、费用口径或 KPI；
- 不自动采信 `R`，不把 `D` 改名为真实事实，不把 `S` 冒充实际发生，不填补 `P`；
- 不因页面显示完整而宣称工作台闭环；
- 不在本设计或 Brief 1 执行任何清库。

## 12. 风险与退出条件

| 风险               | 控制                               | 退出条件                                |
| ------------------ | ---------------------------------- | --------------------------------------- |
| 样本含敏感商业信息 | 仓外原件、最小脱敏、日志禁止原值   | 发现无法安全脱敏的字段，停止该 Sheet    |
| 样本规则未写回权威 | 未授权规则进入 gap                 | 数据责任方/负责人正式写回后才可重新编译 |
| 系统承载不足       | unsupported gap，不临时建表        | 对应工作台另有批准 brief 后新增 adapter |
| package 不确定     | 固定版本、排序、规范化、跨平台测试 | 两次 hash 不一致即失败                  |
| 删除误伤           | 租户 manifest、备份、独立授权      | manifest 包含参考/其他租户立即停止      |
| 异步旧任务回写     | 暂停并核对 Temporal/Outbox         | 无法识别 demo 关联执行时不切换          |

## 13. 完成定义

本设计本身完成只表示负责人批准了样本重建架构。只有四个 brief 依次完成，且 Brief 4 取得真实删除授权、恢复演练和切换后对账证据，才能声明 demo 环境已由 v0.5 派生数据替换。
