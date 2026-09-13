---
status: done # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/work-execution-first-slice
verification: 本地验证（2026-09-13）：pnpm --filter @logix/web test 30 文件 / 79 项通过；typecheck / repo:check 通过。重启后探测：http://127.0.0.1:5173 与 http://localhost:5173 均为 200 且含 data-ui-theme=logix；API :3000/health 双回环 200。官方 Chromium v1243 已装到本机 ms-playwright；`playwright test e2e/task-workflow.spec.ts --project=desktop-chromium` 2 项通过。未执行：完整视觉 E2E。
---

# 任务：E2E 开发服务器同时可达 IPv4/IPv6 回环

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

本机 Vite 默认只绑 `localhost`（Windows 上常为 `::1`），Playwright 却访问 `127.0.0.1:5173`，探测失败。开发服务器同时听 IPv4/IPv6，探测与 baseURL 对齐。

## 边界 / 不做

- 不改视觉快照、不装官方 Chromium、不改业务页。
- 不跑完整 `pnpm test:e2e`（本机仍缺 Playwright Chromium）。

## 验收

- [x] Vite `server.host` 对所有本地接口监听。
- [x] E2E 探测同时试 `127.0.0.1` 与 `localhost`；自起服务也听全部接口。
- [x] Playwright `baseURL` 与探测共用同一地址常量。
- [x] `pnpm --filter @logix/web test` 与 `pnpm repo:check` 通过。

## 方案

抽出 `src/e2eDevServer.ts`。不改已入共享环境的迁移。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段   | 负责 | commit | 说明                        |
| ---------- | ------ | ---- | ------ | --------------------------- |
| 2026-09-13 | coding | —    | —      | 开工：回环地址对齐          |
| 2026-09-13 | done   | —    | —      | Vite host:true + 双回环探测 |
