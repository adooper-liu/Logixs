---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：workers/ai-worker 下 uv run --with pytest pytest 4 项通过。重启 dev:all 后 client.py 新起 echo-ai-1789267239885 完成，结果 `hello from ai-worker (via ai-worker)`；此前卡死的 echo-ai-14377468 也 COMPLETED，同一结果。终端未再出现 Failed decoding arguments。
---

# 任务：EchoAiWorkflow 入参与业务 echo 对齐

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

`EchoAiWorkflow` 入参改为 `{ message: string }`，与 HTTP DTO / TypeScript `echoWorkflow` 一致。Temporal 不再把对象当成 `str` 解码失败。

## 边界 / 不做

- 不改业务 Outbox 工作流、不引入真实模型调用。
- 不把密钥写入 Workflow args。

## 验收

- [x] 对象 `{ message }` 能解析；缺字段或非对象明确失败。
- [x] 启动辅助 `client.py` 传入对象而不是裸字符串。
- [x] `uv run --with pytest pytest` 在 `workers/ai-worker` 通过。

## 方案

抽出纯函数解析入参；工作流 type hint 不再是 `str`。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                         |
| ---------- | ------ | ---- | ------ | ---------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：EchoAi 入参对象对齐    |
| 2026-09-13 | done   | —    | —      | 入参改为 { message }         |
| 2026-09-13 | done   | —    | —      | 重启后新/旧 echo 均 COMPLETED |
