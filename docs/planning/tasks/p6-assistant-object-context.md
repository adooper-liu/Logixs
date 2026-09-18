---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/assistant-object-context
verification: 2026-09-18 本地 `pnpm validate` 全绿（API 109 文件/495 项、Web 58 文件/188 项、E2E 50 通过/7 按条件跳过、生产构建通过）；AI Service 8 项通过；现有库升级与 43 条迁移临时空库回放通过，临时库已删除；真实 HTTP 验证货柜会话、追问回退、跨租户/不存在对象统一 404；浏览器运行时无可用实例，入口与交互由组件测试和仓库 Playwright 覆盖。
---

# 任务：只读助手对象上下文深化

> 采纳条目：`0.3`，见
> [`INCREMENTAL_MODULE_PLAYBOOK`](../../architecture/INCREMENTAL_MODULE_PLAYBOOK.md) §3、§5。

## 目标

用户可从问题通知或货柜档案打开只读运营助手。服务端把货柜摘要、当前可执行的下一动作及权限说明作为结构化上下文返回并交给 AI Gateway；助手只解释，不改变业务状态，也不能代替用户领取或完成工单。

## 边界 / 不做

- 挂靠 `notification` 与 `ai-governance`，由薄的 `ops-assistant` 增量组合模块经公开 Port 读取 `shipment-registry` / `work-execution` 投影，避免基础模块之间形成循环依赖。
- 允许动作只复用 `work-execution` 的 `LIST_OBJECT_TASK_ACTIVITY` 投影；不在助手、前端或 AI Service 复制任务状态判断。
- 通知入口先校验角色可见性；对象入口和后续消息均以会话保存的 `containerId` 重做租户范围校验。不存在、跨租户、孤儿引用统一按不可见处理。
- AI 输入中的对象摘要和动作由 Application 层结构化组装；模型文本不是业务事实或授权结果。AI 不可写状态、claim、complete、replay。
- 本刀不做条目 `1.1` 自动化，不做通用聊天、工具调用、RAG、邮件/短信通道。

## 验收

- [x] 从可见通知打开会话时返回服务端确认的通知上下文、货柜摘要、下一动作和只读策略。
- [x] 从货柜档案可直接打开同一助手；会话稳定保存货柜引用，后续追问重新读取最新摘要和动作投影。
- [x] 无权限通知、跨租户货柜、孤儿通知引用明确拒绝且不泄露对象；无下一动作时返回空数组和清楚说明。
- [x] AI Gateway 收到结构化上下文；AI 服务失败时的确定性回退仍包含摘要、动作和“助手不能执行”说明。
- [x] Web 的通知页和货柜档案均有入口，展示摘要、允许动作、负责人/截止时间与只读边界，不在前端推导动作合法性。
- [x] 公共 DTO 由 JSON Schema 派生，API/Web/AI 消费者和契约漂移检查同步更新。
- [x] 追加迁移通过空库与现有库验证；相关 API/Web/AI 测试、lint、typecheck、build 及高风险完整门禁按实际结果记录。

## 方案

1. `notification` 提供会话存取公共 Port，并为会话追加可空 `container_id`；旧通知会话保持兼容。
2. `shipment-registry` 公开货柜摘要读取 Port；`ops-assistant` 组合该 Port、可见通知 Port 与既有任务活动 Port。
3. 新增 V1 助手上下文 Schema，响应包含 `objectSummary`、`allowedActions`、`readOnlyPolicy` 和消息；变更为追加兼容。
4. 助手打开和追问都由服务端按会话引用重建上下文；AI Gateway 只把结构化只读事实交给 AI Service，失败走确定性回退。
5. Web 抽出聚焦的助手面板组件；通知页和货柜档案只负责编排打开/发送事件。

## Review notes

- `allowedActions` 是既有工单投影，不是第二套状态机；`actorCanExecute` 只表达当前身份是否具备执行能力，助手自身始终为 false。
- 对象时间沿用摘要和工单投影的 UTC/ISO 8601 值，不把计划、预计或系统收录时间伪装成实际发生。

## 进度 log

| 日期       | 阶段   | 负责  | commit | 说明                                                         |
| ---------- | ------ | ----- | ------ | ------------------------------------------------------------ |
| 2026-09-18 | coding | Codex | —      | 从 `d112e80` 开分支；按 playbook 条目 `0.3` 建立独立 brief。 |
| 2026-09-18 | done   | Codex | 本提交 | 完成对象上下文、只读动作说明、双入口、迁移与高风险验证。     |
