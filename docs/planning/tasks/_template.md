---
status: design # design | coding | review | fix | blocked | done（机器可校验）
branch: # git 初始化后填：feat/<任务名>
verification: # 仅 status: done 时必填：CI/测试运行 URL 或受版本控制的验证记录路径
---

# 任务：<简短标题>

> 复制本文件为 `docs/planning/tasks/<任务名>.md`，作为执行、评审与交接的**唯一载体**。
> 状态以文件顶部 frontmatter 的 `status` / `branch` 为准，改状态就改 frontmatter，不要在正文另写自由文本状态。
>
> 约定（ENGINEERING_RULES §10）：同一时刻只允许一个任务处于进行中（串行化）；`done` 必须在 frontmatter 的 `verification` 填写验证证据地址（测试/构建/运行记录），未验证不得标 `done`。聊天只传任务文件名、分支名与起点命令，不互贴长状态。

## 目标

（要达成的行为，1–3 句）

## 边界 / 不做

（引用权威来源：`ENGINEERING_RULES` / `AGENTS` / 架构文档 / 数据模型；明确不越界的范围）

## 验收

- [ ] 相关质量门禁全绿（写出实际命令：`pnpm validate` / `pytest` / `npm run validate` 等）
- [ ] 任务特有验收项

## 方案（design 阶段填写）

（决策、涉及文件清单、步骤；必要时先改文档再改代码）

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先，每条对应文件/行号或 commit）

## 进度 log（谁改谁 append，一行一条）

| 日期       | 阶段   | 负责 | commit | 说明 |
| ---------- | ------ | ---- | ------ | ---- |
| YYYY-MM-DD | design | —    | —      | 初稿 |
