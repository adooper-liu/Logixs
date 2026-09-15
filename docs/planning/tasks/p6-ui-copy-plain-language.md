---
status: blocked # design | coding | review | fix | blocked | done（机器可校验）
branch: feat/inland-plan-first-slice
verification:
---

# 任务：作业壳人话与任务五问第一刀

> 唯一交接载体。同一时刻仅一个进行中任务。

## 目标

按 [UI_COPY_PLAIN_LANGUAGE](../../product/UI_COPY_PLAIN_LANGUAGE.md) 定稿，把作业壳屏幕字收到显示字典，再给界面引用。任务标题回答目的，站名单独一行；固定动词链：待领取 → 领取 → 已领取 → 进行中 → 完成工单 → 已入账。

## 权威入口

- [UI_SYSTEM](../../product/UI_SYSTEM.md) UI-D09、§9.2、§9.3
- [LIFECYCLE_NODE_CATALOG_V1](../../product/domain/LIFECYCLE_NODE_CATALOG_V1.md)
- [UI_COPY_PLAIN_LANGUAGE](../../product/UI_COPY_PLAIN_LANGUAGE.md)
- 显示字典：`apps/web/src/data/uiCopyCatalog.ts`

## 边界 / 不做

- 不编截止时间和风险；没有数就写「暂无截止」或整栏不出现。
- 不把装箱拆成三件子任务；不把 NODE_PDCA 候选升格为正式定义。
- 不重画视觉令牌，不改 API 码和契约枚举。
- 不接超期截止日/金额端口填时间。
- 不上 vue-i18n；只做 `zh-CN` 显示字典，预留 locale 入口。

## 验收

- [ ] 作业壳重复用词只来自 `uiCopyCatalog`，组件不再手写「领取 / 完成工单 / 已入账」第二套说法。
- [ ] 站名「装箱」；任务标题「装箱完成」。
- [ ] 主按钮「领取 / 完成工单」；回执三步「已接收 / 已确认 / 已入账」。
- [ ] `pnpm --filter @logix/web test` 与 web typecheck 通过。

## 方案

先立显示字典，再让语言目录、回执、任务台、看提交引用同一本词条。

## Review notes（review 阶段填写，只读不改代码）

（缺陷优先）

## 进度 log

| 日期       | 阶段    | 负责 | commit | 说明                                |
| ---------- | ------- | ---- | ------ | ----------------------------------- |
| 2026-09-15 | coding  | —    | —      | 按对照稿建议列落作业壳              |
| 2026-09-15 | coding  | —    | —      | 改按定稿动词链；显示字典落地        |
| 2026-09-15 | blocked | —    | —      | 暂停：先立 14流程节点填空表权威入口 |
