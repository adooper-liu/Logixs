# 货柜工作台一期 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让"规范事件过站"自动完成对应节点任务（修掉"过站了任务还永远挂在池子里"的缺陷），并让货柜工作台首次铺满 14 站轨道，三轨（计划/预计/实际）预埋、无数据显式留空。

**Architecture:** 后端在既有跨模块端口模式上新增一个 `COMPLETE_NODE_TASK` 端口，由 `ApplyLifecycleEventService` 在 `transition.applied` 处调用；同时把"事实→节点"的判定依据从硬编码 4 条影子表改为 `ShipmentTimeFact.eventCode` → canonical-events 的权威映射（影子表降为兜底）。前端把 `MicroWorkbench` 重排为 L1 竖向堆叠，轨道改为画全 14 站的水平主轴，并新增一个**常驻**的三轨展开卡。

**Tech Stack:** NestJS + Prisma + Vitest（后端）· Vue 3 `<script setup>` + vue-router + Vitest/happy-dom（前端）· pnpm workspace + turbo

**Spec:** `docs/superpowers/specs/2026-09-21-container-workbench-task-driving-design.md`

## Global Constraints

- 提交信息用中文，动词开头，一句话说清改了什么（仓库既有风格）。
- **留空纪律**：无数据一律显式留空（`—` / `null`），**禁止**用 0、假日期或演示数据填充；空轨道**禁止**画进度条（`WORKSPACE_UI_INVENTORY §6`）。
- **不适用 ≠ 留空**：`applicability === "optional_not_applicable"` 的节点（中转 / 海铁）显示"不适用"，与"暂无数据"是两种呈现。
- **三轨槽位常驻**：`plannedAt` / `estimatedAt` / `actualAt` 三个字段始终存在于类型与模板中，无值时渲染 `—`，不因无数据而省略。
- **不改领域规则**："工单完成 ≠ 过站"保持不变。人工兜底路径是"人工补录事实"，不是"手工完成工单"。
- **不改现有表单**：六个岗位工作台的表单一行不改。
- 后端测试：`pnpm --filter @logix/api test -- <path>`；前端测试：`pnpm --filter @logix/web test <path>`。
- 契约包改动后必须跑 `pnpm contract:generate` 重新生成 `packages/contracts/generated/contracts.d.ts`。

---

## 文件结构

**后端 · work-execution**
| 文件 | 职责 |
| --- | --- |
| `complete-node-task.port.ts`（新建） | 对外端口：按 `nodeInstanceId` 完成任务 |
| `application/complete-node-task.service.ts`（新建） | 端口实现：幂等、找不到即无操作 |
| `application/complete-node-task.service.test.ts`（新建） | 服务单测 |
| `domain/work-execution.repository.ts`（改） | 端口加一个方法 `completeTaskByNodeInstanceId` |
| `infrastructure/prisma-work-execution.repository.ts`（改） | 事务实现：任务 + 其工单一并置完成 |
| `domain/task-condition-fact.ts`（改） | 加 `nodeCode` 字段 |
| `domain/task-conditions.ts`（改） | 优先按 `fact.nodeCode` 匹配，`FACT_TARGET_NODE` 降为兜底 |
| `work-execution.module.ts` / `index.ts`（改） | 注册并导出新端口 |

**后端 · shipment-registry**
| 文件 | 职责 |
| --- | --- |
| `domain/container-task-fact.ts`（改） | 加 `nodeCode` 字段 |
| `infrastructure/prisma-container.repository.ts`（改） | `listCurrentTaskFacts` 用 `eventCode` 解析出 `nodeCode` |

**后端 · lifecycle-control**
| 文件 | 职责 |
| --- | --- |
| `application/apply-lifecycle-event.service.ts`（改） | 过站成功后调用 `COMPLETE_NODE_TASK` |
| `domain/lifecycle-nodes.ts`（改） | 投影加三轨时间字段 |
| `application/list-lifecycle-nodes.service.ts`（改） | 取事实并传入投影 |
| `domain/lifecycle-date-fact.repository.ts`（改） | 端口加批量按容器列当前事实的能力 |
| `presentation/lifecycle-nodes.controller.ts`（改） | DTO 透出三轨时间 |
| `domain/node-completion-mode.ts`（新建） | 从节点目录读 `completionMode` |

**契约**
| 文件 | 职责 |
| --- | --- |
| `packages/contracts/catalogs/v1/lifecycle-nodes.json`（改） | 每个节点加 `completionMode`，初值全 `fact_driven` |
| `packages/contracts/generated/contracts.d.ts`（再生成） | — |

**前端**
| 文件 | 职责 |
| --- | --- |
| `api/lifecycleNodes.ts`（改） | `LifecycleNodeItem` 加三轨时间与 `blockedReasonRefs` |
| `data/liveNodeProjection.ts`（改） | `LiveNodeView` 加三轨时间与异常数 |
| `components/container/LiveNodeRail.vue`（重写） | 水平主轴：全 14 站、四态、每站摘要日期或 `—` |
| `components/container/NodeTimeTrackCard.vue`（新建） | **常驻**三轨展开卡 |
| `views/MicroWorkbench.vue`（改） | L1 竖向堆叠 + 标记 / 异常槽位 |

---

### Task 1: work-execution 提供"按节点实例完成任务"的端口

**Files:**
- Create: `apps/api/src/modules/work-execution/complete-node-task.port.ts`
- Create: `apps/api/src/modules/work-execution/application/complete-node-task.service.ts`
- Create: `apps/api/src/modules/work-execution/application/complete-node-task.service.test.ts`
- Modify: `apps/api/src/modules/work-execution/domain/work-execution.repository.ts`
- Modify: `apps/api/src/modules/work-execution/infrastructure/prisma-work-execution.repository.ts`
- Modify: `apps/api/src/modules/work-execution/work-execution.module.ts`
- Modify: `apps/api/src/modules/work-execution/index.ts`

**Interfaces:**
- Consumes: `WORK_EXECUTION_REPOSITORY`（已有）、`findTaskByNodeInstanceId`（已有）
- Produces: `COMPLETE_NODE_TASK` token、`CompleteNodeTaskPort.execute(input) => Promise<CompleteNodeTaskResult>`

- [ ] **Step 1: 写失败测试**

新建 `apps/api/src/modules/work-execution/application/complete-node-task.service.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest";
import { CompleteNodeTaskService } from "./complete-node-task.service";
import { WORK_EXECUTION_REPOSITORY } from "../domain/work-execution.repository";

function buildRepository() {
  return {
    findTaskByNodeInstanceId: vi.fn(),
    completeTaskByNodeInstanceId: vi.fn().mockResolvedValue(true),
  };
}

function buildService(repository: ReturnType<typeof buildRepository>) {
  return new CompleteNodeTaskService(repository as never);
}

const COMPLETED_AT = new Date("2026-09-21T08:00:00.000Z");

describe("CompleteNodeTaskService", () => {
  it("节点过站后把对应任务置为完成", async () => {
    const repository = buildRepository();
    repository.findTaskByNodeInstanceId.mockResolvedValue({
      task: { id: "task-1", state: "pending" },
      workOrders: [],
      outcome: null,
    });
    const service = buildService(repository);

    const result = await service.execute({
      nodeInstanceId: "node-1",
      completedAt: COMPLETED_AT,
    });

    expect(repository.completeTaskByNodeInstanceId).toHaveBeenCalledWith({
      nodeInstanceId: "node-1",
      completedAt: COMPLETED_AT,
    });
    expect(result).toEqual({ taskId: "task-1", completed: true });
  });

  it("找不到任务时不做任何写入", async () => {
    const repository = buildRepository();
    repository.findTaskByNodeInstanceId.mockResolvedValue(null);
    const service = buildService(repository);

    const result = await service.execute({
      nodeInstanceId: "node-missing",
      completedAt: COMPLETED_AT,
    });

    expect(repository.completeTaskByNodeInstanceId).not.toHaveBeenCalled();
    expect(result).toEqual({ taskId: null, completed: false });
  });

  it("任务已完成时保持幂等，不重复写入", async () => {
    const repository = buildRepository();
    repository.findTaskByNodeInstanceId.mockResolvedValue({
      task: { id: "task-1", state: "completed" },
      workOrders: [],
      outcome: null,
    });
    const service = buildService(repository);

    const result = await service.execute({
      nodeInstanceId: "node-1",
      completedAt: COMPLETED_AT,
    });

    expect(repository.completeTaskByNodeInstanceId).not.toHaveBeenCalled();
    expect(result).toEqual({ taskId: "task-1", completed: false });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution/application/complete-node-task.service.test.ts`
Expected: FAIL —— 找不到模块 `./complete-node-task.service`

- [ ] **Step 3: 建端口**

新建 `apps/api/src/modules/work-execution/complete-node-task.port.ts`：

```ts
export const COMPLETE_NODE_TASK = Symbol.for("logix.CompleteNodeTask");

export interface CompleteNodeTaskInput {
  nodeInstanceId: string;
  completedAt: Date;
}

export interface CompleteNodeTaskResult {
  taskId: string | null;
  completed: boolean;
}

export interface CompleteNodeTaskPort {
  execute(input: CompleteNodeTaskInput): Promise<CompleteNodeTaskResult>;
}
```

- [ ] **Step 4: 仓储端口加方法**

在 `apps/api/src/modules/work-execution/domain/work-execution.repository.ts` 的 `WorkExecutionRepository` 接口里，`applyWorkOrderCompletion` 之后加：

```ts
  completeTaskByNodeInstanceId(input: {
    nodeInstanceId: string;
    completedAt: Date;
  }): Promise<boolean>;
```

- [ ] **Step 5: 实现服务**

新建 `apps/api/src/modules/work-execution/application/complete-node-task.service.ts`：

```ts
import { Inject, Injectable } from "@nestjs/common";
import type {
  CompleteNodeTaskInput,
  CompleteNodeTaskPort,
  CompleteNodeTaskResult,
} from "../complete-node-task.port";
import {
  WORK_EXECUTION_REPOSITORY,
  type WorkExecutionRepository,
} from "../domain/work-execution.repository";

@Injectable()
export class CompleteNodeTaskService implements CompleteNodeTaskPort {
  constructor(
    @Inject(WORK_EXECUTION_REPOSITORY)
    private readonly repository: WorkExecutionRepository,
  ) {}

  async execute(
    input: CompleteNodeTaskInput,
  ): Promise<CompleteNodeTaskResult> {
    const task = await this.repository.findTaskByNodeInstanceId(
      input.nodeInstanceId,
    );
    if (!task) {
      return { taskId: null, completed: false };
    }
    if (task.task.state === "completed") {
      return { taskId: task.task.id, completed: false };
    }
    await this.repository.completeTaskByNodeInstanceId({
      nodeInstanceId: input.nodeInstanceId,
      completedAt: input.completedAt,
    });
    return { taskId: task.task.id, completed: true };
  }
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution/application/complete-node-task.service.test.ts`
Expected: PASS —— 3 passed

- [ ] **Step 7: 写仓储实现**

在 `apps/api/src/modules/work-execution/infrastructure/prisma-work-execution.repository.ts` 的 `applyWorkOrderCompletion` 方法之后加：

```ts
  async completeTaskByNodeInstanceId(input: {
    nodeInstanceId: string;
    completedAt: Date;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.nodeTask.findUnique({
        where: { nodeInstanceId: input.nodeInstanceId },
      });
      if (!task || task.state === "completed") return false;
      await tx.nodeTask.update({
        where: { id: task.id },
        data: { state: "completed" },
      });
      // 事实到齐时，任务与其工单一并完成：工单不再是完成的判定者，只留分派与时限。
      await tx.workOrder.updateMany({
        where: { nodeTaskId: task.id, state: { not: "completed" } },
        data: { state: "completed", completedAt: input.completedAt },
      });
      return true;
    });
  }
```

- [ ] **Step 8: 注册并导出端口**

在 `apps/api/src/modules/work-execution/work-execution.module.ts` 的 `providers` 数组里，紧跟 `CREATE_NODE_TASK` 那条之后加：

```ts
    { provide: COMPLETE_NODE_TASK, useExisting: CompleteNodeTaskService },
```

把 `CompleteNodeTaskService` 加进同一文件的 import 区（与 `CreateNodeTaskService` 同一行组），并在 `exports` 数组里加 `COMPLETE_NODE_TASK`。

在 `apps/api/src/modules/work-execution/index.ts`（barrel）末尾加：

```ts
export {
  COMPLETE_NODE_TASK,
  type CompleteNodeTaskInput,
  type CompleteNodeTaskPort,
  type CompleteNodeTaskResult,
} from "./complete-node-task.port";
```

- [ ] **Step 9: 全模块测试 + 提交**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution`
Expected: PASS（含既有测试，无回归）

```bash
git add apps/api/src/modules/work-execution
git commit -m "feat(work-execution): 新增按节点实例完成任务的端口"
```

---

### Task 2: 过站时自动完成任务

**Files:**
- Modify: `apps/api/src/modules/lifecycle-control/application/apply-lifecycle-event.service.ts`（构造函数 + 第 465 行处）
- Modify: `apps/api/src/modules/lifecycle-control/application/apply-lifecycle-event.service.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `COMPLETE_NODE_TASK` / `CompleteNodeTaskPort`
- Produces: 过站即完成任务的行为；`ApplyLifecycleEventResult` **不变**

- [ ] **Step 1: 写失败测试**

在 `apps/api/src/modules/lifecycle-control/application/apply-lifecycle-event.service.test.ts` 里，仿照既有 `it("stuffed 完成后为出运节点建任务", ...)` 的写法加一条。注意 `buildService` 有 13 个位置参数，新端口作为第 14 个参数追加在末尾，前面的照旧传 `undefined`：

```ts
  it("过站后把该节点的任务一并完成", async () => {
    const repository = buildRepository("not_shipped");
    useFlow(repository, flowAt("container_stuffing"));
    const completeNodeTask = {
      execute: vi.fn().mockResolvedValue({
        taskId: "task-stuffing",
        completed: true,
      }),
    };
    const { service } = await buildService(
      repository,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      completeNodeTask,
    );

    const result = await service.execute({
      ...baseInput(),
      eventCode: "stuffed",
    });

    expect(result.completedNodes).toEqual(["container_stuffing"]);
    expect(completeNodeTask.execute).toHaveBeenCalledWith({
      nodeInstanceId: "node-container_stuffing",
      completedAt: baseInput().occurredAt,
    });
  });
```

> 注：`nodeInstanceId` 的字面量取决于 `flowAt` 生成的 id 规则——先跑一次看失败信息里的实际值，再把它写死在断言里。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/application/apply-lifecycle-event.service.test.ts`
Expected: FAIL —— `completeNodeTask.execute` 未被调用（或 `buildService` 不接受第 14 个参数）

- [ ] **Step 3: 注入端口**

在 `apply-lifecycle-event.service.ts` 的 import 区（第 39-42 行那条 work-execution import）改为：

```ts
import {
  COMPLETE_NODE_TASK,
  CREATE_NODE_TASK,
  type CompleteNodeTaskPort,
  type CreateNodeTaskPort,
} from "../../work-execution";
```

在构造函数里，紧跟 `createNodeTask` 那条之后加：

```ts
    @Inject(COMPLETE_NODE_TASK)
    private readonly completeNodeTask: CompleteNodeTaskPort,
```

- [ ] **Step 4: 在过站成功处调用**

把第 465 行：

```ts
        if (transition.applied) completedNodes.push(targetNodeCode);
```

改为：

```ts
        if (transition.applied) {
          completedNodes.push(targetNodeCode);
          // 规范事件过站即代表本站工作已完成：任务与其工单一并置为完成。
          // 这是"事实驱动完成"的落点，工单不再是完成的判定者。
          await this.completeNodeTask.execute({
            nodeInstanceId: target.id,
            completedAt: input.occurredAt,
          });
        }
```

- [ ] **Step 5: 更新测试装配器**

在测试文件的 `buildService(...)` 里追加第 14 个参数 `completeNodeTask`（默认值 `{ execute: vi.fn().mockResolvedValue({ taskId: null, completed: false }) }`），并用 `{ provide: COMPLETE_NODE_TASK, useValue: completeNodeTask }` 注册；返回值对象里带上 `completeNodeTask`，供断言取用。**这一改动会让既有的 13 参数调用点仍然可用**，因为新参数有默认值。

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/application/apply-lifecycle-event.service.test.ts`
Expected: PASS（含全部既有用例）

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/modules/lifecycle-control
git commit -m "feat(lifecycle-control): 规范事件过站后自动完成对应节点任务"
```

---

### Task 3: 任务条件的"事实→节点"改用规范事件权威映射

**Files:**
- Modify: `apps/api/src/modules/work-execution/domain/task-condition-fact.ts`
- Modify: `apps/api/src/modules/work-execution/domain/task-conditions.ts`
- Modify: `apps/api/src/modules/work-execution/domain/task-conditions.test.ts`
- Modify: `apps/api/src/modules/shipment-registry/domain/container-task-fact.ts`
- Modify: `apps/api/src/modules/shipment-registry/infrastructure/prisma-container.repository.ts:74-103`

**Interfaces:**
- Consumes: `packages/contracts/catalogs/v1/canonical-events.json`（经 `@logix/contracts/canonical-events.json` 导入）、`ShipmentTimeFact.eventCode`
- Produces: `TaskConditionFact.nodeCode: LifecycleNodeCode | null`；`evaluateTaskConditions` 优先按 `nodeCode` 匹配

- [ ] **Step 1: 写失败测试**

在 `apps/api/src/modules/work-execution/domain/task-conditions.test.ts` 的 `facts` 数组里给两条 fixture 各加 `nodeCode`（`"customs_clearance"` 与 `"empty_return"`），并新增一条：

```ts
  it("事实自带节点时按节点匹配，无需影子表", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "container_unloading",
        isCurrent: false,
        facts: [
          {
            id: "fact-unload",
            factCode: "some_import_code",
            nodeCode: "container_unloading",
            timeKind: "actual" as const,
            captureSource: "controlled_import" as const,
            evidenceRef: "22222222-2222-4222-8222-222222222222",
          },
        ],
      }),
    ).toEqual({
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["fact-unload"],
    });
  });

  it("事实无节点时回退到既有影子表", () => {
    expect(
      evaluateTaskConditions({
        nodeCode: "customs_clearance",
        isCurrent: false,
        facts: [
          {
            id: "fact-legacy",
            factCode: "customs_clearance_completed",
            nodeCode: null,
            timeKind: "actual" as const,
            captureSource: "controlled_import" as const,
            evidenceRef: "33333333-3333-4333-8333-333333333333",
          },
        ],
      }),
    ).toEqual({
      readinessState: "ready",
      completionEligibility: "eligible",
      conditionFactRefs: ["fact-legacy"],
    });
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution/domain/task-conditions.test.ts`
Expected: FAIL —— `nodeCode` 不是已知属性 / 第一条断言拿到 `waiting_conditions`

- [ ] **Step 3: 给事实类型加字段**

`apps/api/src/modules/work-execution/domain/task-condition-fact.ts` 全文改为：

```ts
import type { LifecycleNodeCode } from "@logix/contracts";

export interface TaskConditionFact {
  id: string;
  factCode: string;
  nodeCode: LifecycleNodeCode | null;
  timeKind: "actual" | "estimated";
  captureSource: string;
  evidenceRef: string | null;
}
```

同样地，给 `apps/api/src/modules/shipment-registry/domain/container-task-fact.ts` 的 `ContainerTaskFact` 加 `nodeCode: LifecycleNodeCode | null;`（该文件当前 7 行，字段与上表一致）。

- [ ] **Step 4: 改判定逻辑**

`apps/api/src/modules/work-execution/domain/task-conditions.ts` 全文改为：

```ts
import type {
  LifecycleNodeCode,
  TaskCompletionEligibility,
  TaskReadinessState,
} from "@logix/contracts";
import type { TaskConditionFact } from "./task-condition-fact";

// 兜底映射：仅用于 ShipmentTimeFact.eventCode 为空的事实（如 system_derived）。
// 权威路径是 fact.nodeCode，由 ShipmentTimeFact.eventCode 经 canonical-events 解析而来。
const FACT_TARGET_NODE: Readonly<Record<string, LifecycleNodeCode>> = {
  customs_clearance_completed: "customs_clearance",
  container_unloading_completed: "container_unloading",
  container_empty_confirmed: "empty_return",
  container_empty_estimated: "empty_return",
};

export interface TaskConditionDecision {
  readinessState: TaskReadinessState;
  completionEligibility: TaskCompletionEligibility;
  conditionFactRefs: string[];
}

function targetsNode(
  fact: TaskConditionFact,
  nodeCode: LifecycleNodeCode,
): boolean {
  if (fact.nodeCode) return fact.nodeCode === nodeCode;
  return FACT_TARGET_NODE[fact.factCode] === nodeCode;
}

export function evaluateTaskConditions(input: {
  nodeCode: LifecycleNodeCode;
  isCurrent: boolean;
  facts: readonly TaskConditionFact[];
}): TaskConditionDecision {
  const matched = input.facts.filter((fact) =>
    targetsNode(fact, input.nodeCode),
  );
  const completionFact = matched.some(
    (fact) =>
      fact.timeKind === "actual" &&
      fact.captureSource !== "system_derived" &&
      Boolean(fact.evidenceRef),
  );
  return {
    readinessState:
      input.isCurrent || matched.length > 0 ? "ready" : "waiting_conditions",
    completionEligibility: completionFact ? "eligible" : "awaiting_evidence",
    conditionFactRefs: matched.map((fact) => fact.id),
  };
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution/domain/task-conditions.test.ts`
Expected: PASS（4 条既有 + 2 条新增）

- [ ] **Step 6: 查询侧填 nodeCode**

在 `apps/api/src/modules/shipment-registry/infrastructure/prisma-container.repository.ts` 的 `listCurrentTaskFacts` 里：

1. 文件顶部加 `import canonicalEvents from "@logix/contracts/canonical-events.json";` 与 `import type { LifecycleNodeCode } from "@logix/contracts";`
2. 模块作用域（`listCurrentTaskFacts` 之外）加一张查表：

```ts
const EVENT_DEFAULT_NODE = new Map<string, LifecycleNodeCode>(
  canonicalEvents
    .filter((event) => Boolean(event.defaultNodeCode))
    .map((event) => [
      event.eventCode,
      event.defaultNodeCode as LifecycleNodeCode,
    ]),
);
```

3. `select` 里补 `eventCode: true`，并把 `map` 改为：

```ts
      .map((row) => ({
        id: row.id,
        factCode: row.factCode,
        nodeCode: row.eventCode
          ? (EVENT_DEFAULT_NODE.get(row.eventCode) ?? null)
          : null,
        timeKind: row.timeKind as "actual" | "estimated",
        captureSource: row.captureSource,
        evidenceRef: row.evidenceRef,
      }));
```

- [ ] **Step 7: 全模块测试 + 提交**

Run: `pnpm --filter @logix/api test -- src/modules/work-execution src/modules/shipment-registry src/modules/lifecycle-control`
Expected: PASS

```bash
git add apps/api/src/modules/work-execution apps/api/src/modules/shipment-registry
git commit -m "feat(work-execution): 任务条件改用规范事件解析节点，影子表降为兜底"
```

---

### Task 4: 节点目录加 `completionMode`

**Files:**
- Modify: `packages/contracts/catalogs/v1/lifecycle-nodes.json`
- Modify: `packages/contracts/generated/contracts.d.ts`（由脚本生成）
- Create: `apps/api/src/modules/lifecycle-control/domain/node-completion-mode.ts`
- Create: `apps/api/src/modules/lifecycle-control/domain/node-completion-mode.test.ts`

**Interfaces:**
- Produces: `CompletionMode = "fact_driven" | "needs_manual_fact"`；`completionModeOf(nodeCode): CompletionMode`

- [ ] **Step 1: 改目录**

`packages/contracts/catalogs/v1/lifecycle-nodes.json` —— 给 **14 个**节点对象各加一个字段，值一律为 `"fact_driven"`。前两项示例（其余 12 项同样处理，保持既有键序 `sequence` / `nodeCode` / `applicability` / `completionMode`）：

```json
  {
    "sequence": 1,
    "nodeCode": "cargo_ready",
    "applicability": "required",
    "completionMode": "fact_driven"
  },
```

- [ ] **Step 2: 重新生成契约**

Run: `pnpm contract:generate`
Expected: 脚本成功；`packages/contracts/generated/contracts.d.ts` 出现改动

Run: `pnpm contract:drift`
Expected: 通过（无 drift）

- [ ] **Step 3: 写失败测试**

新建 `apps/api/src/modules/lifecycle-control/domain/node-completion-mode.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { LIFECYCLE_NODE_CODES } from "../../work-execution/domain/lifecycle-node-codes";
import { completionModeOf } from "./node-completion-mode";

describe("completionModeOf", () => {
  it("目录未标注时默认为事实驱动", () => {
    expect(completionModeOf("container_stuffing")).toBe("fact_driven");
  });

  it("14 站全部有明确取值", () => {
    for (const nodeCode of LIFECYCLE_NODE_CODES) {
      expect(["fact_driven", "needs_manual_fact"]).toContain(
        completionModeOf(nodeCode),
      );
    }
  });
});
```

> 若 `lifecycle-node-codes.ts` 未导出 `LIFECYCLE_NODE_CODES`，改为就地写死这 14 个 code 的数组。

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/node-completion-mode.test.ts`
Expected: FAIL —— 找不到模块 `./node-completion-mode`

- [ ] **Step 5: 实现读取**

新建 `apps/api/src/modules/lifecycle-control/domain/node-completion-mode.ts`：

```ts
import type { LifecycleNodeCode } from "@logix/contracts";
import lifecycleNodes from "@logix/contracts/lifecycle-nodes.json";

export type CompletionMode = "fact_driven" | "needs_manual_fact";

// 权威：packages/contracts/catalogs/v1/lifecycle-nodes.json 的 completionMode。
// 默认 fact_driven —— 事实优先；只有明确知道该站事实源不可用才标 needs_manual_fact。
const MODE_BY_NODE = new Map<string, CompletionMode>(
  lifecycleNodes
    .filter((node) => Boolean(node.completionMode))
    .map((node) => [node.nodeCode, node.completionMode as CompletionMode]),
);

export function completionModeOf(nodeCode: LifecycleNodeCode): CompletionMode {
  return MODE_BY_NODE.get(nodeCode) ?? "fact_driven";
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/node-completion-mode.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add packages/contracts apps/api/src/modules/lifecycle-control
git commit -m "feat(contracts): 节点目录新增 completionMode，默认事实驱动"
```

---

### Task 5: 时间事实聚合投影（三轨数据源）

**Files:**
- Modify: `apps/api/src/modules/lifecycle-control/domain/lifecycle-date-fact.repository.ts`
- Modify: `apps/api/src/modules/lifecycle-control/infrastructure/prisma-lifecycle-date-fact.repository.ts`
- Modify: `apps/api/src/modules/lifecycle-control/domain/lifecycle-nodes.ts`
- Modify: `apps/api/src/modules/lifecycle-control/domain/lifecycle-nodes.test.ts`（若无则新建）
- Modify: `apps/api/src/modules/lifecycle-control/application/list-lifecycle-nodes.service.ts`
- Modify: `apps/api/src/modules/lifecycle-control/presentation/lifecycle-nodes.controller.ts`
- Modify: `apps/api/src/modules/lifecycle-control/presentation/lifecycle.dto.ts`
- Modify: `apps/api/src/modules/lifecycle-control/presentation/lifecycle-nodes-batch.controller.ts`

**Interfaces:**
- Consumes: `LifecycleDateFactRecord[]`（已有类型，含 `nodeCode` / `timeKind` / `occurredAt` / `isCurrent`）
- Produces: `LifecycleNodeTimeTrack { plannedAt: Date | null; estimatedAt: Date | null; actualAt: Date | null }`；`LifecycleNodeProjection` 上新增 `times: LifecycleNodeTimeTrack`

- [ ] **Step 1: 写失败测试**

在 `apps/api/src/modules/lifecycle-control/domain/lifecycle-nodes.test.ts` 加（若文件不存在则新建，`FlowWithNodes` fixture 用现有测试里的写法造）：

```ts
  it("三轨槽位常驻，无事实时显式留空", () => {
    const view = projectLifecycleNodes(
      flowWith({ nodeCode: "cargo_ready", state: "active" }),
      {
        facts: [],
      },
    );
    expect(view.nodes[0]?.times).toEqual({
      plannedAt: null,
      estimatedAt: null,
      actualAt: null,
    });
  });

  it("同一节点的三种时间各归各轨", () => {
    const occurredAt = new Date("2026-09-21T00:00:00.000Z");
    const view = projectLifecycleNodes(
      flowWith({ nodeCode: "cargo_ready", state: "completed" }),
      {
        facts: [
          fact("cargo_ready", "planned", occurredAt),
          fact("cargo_ready", "estimated", occurredAt),
          fact("cargo_ready", "actual", occurredAt),
        ],
      },
    );
    expect(view.nodes[0]?.times).toEqual({
      plannedAt: occurredAt,
      estimatedAt: occurredAt,
      actualAt: occurredAt,
    });
  });

  it("不适用节点与留空是两种呈现", () => {
    const view = projectLifecycleNodes(
      flowWith({
        nodeCode: "transshipment",
        state: "pending",
        applicability: "optional_not_applicable",
      }),
      { facts: [] },
    );
    expect(view.nodes[0]?.applicability).toBe("optional_not_applicable");
    expect(view.nodes[0]?.times.actualAt).toBeNull();
  });
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/lifecycle-nodes.test.ts`
Expected: FAIL —— `projectLifecycleNodes` 只接受 1 个参数 / `times` 不存在

- [ ] **Step 3: 改投影为纯函数（新增第二参数）**

`apps/api/src/modules/lifecycle-control/domain/lifecycle-nodes.ts` —— 在 `LifecycleNodeProjection` 上加：

```ts
export interface LifecycleNodeTimeTrack {
  plannedAt: Date | null;
  estimatedAt: Date | null;
  actualAt: Date | null;
}
```

并在接口里加一行 `times: LifecycleNodeTimeTrack;`。把函数签名改为：

```ts
export interface LifecycleNodeFactsInput {
  facts: readonly {
    nodeCode: LifecycleNodeCode;
    timeKind: string;
    occurredAt: Date;
  }[];
}

export function projectLifecycleNodes(
  flow: FlowWithNodes | null,
  input: LifecycleNodeFactsInput = { facts: [] },
): LifecycleNodesView {
```

在 `map` 之前先按 `nodeCode` 归拢事实：

```ts
  const timesByNode = new Map<string, LifecycleNodeTimeTrack>();
  for (const fact of input.facts) {
    const current = timesByNode.get(fact.nodeCode) ?? {
      plannedAt: null,
      estimatedAt: null,
      actualAt: null,
    };
    // 同轨多条事实取最早一条；留空保持 null，不用 0 或假日期填充。
    if (fact.timeKind === "planned" && !current.plannedAt) {
      current.plannedAt = fact.occurredAt;
    } else if (fact.timeKind === "estimated" && !current.estimatedAt) {
      current.estimatedAt = fact.occurredAt;
    } else if (fact.timeKind === "actual" && !current.actualAt) {
      current.actualAt = fact.occurredAt;
    }
    timesByNode.set(fact.nodeCode, current);
  }
```

在 `map` 的返回对象里加：

```ts
      times: timesByNode.get(node.nodeCode) ?? {
        plannedAt: null,
        estimatedAt: null,
        actualAt: null,
      },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control/domain/lifecycle-nodes.test.ts`
Expected: PASS

- [ ] **Step 5: 仓储端口暴露"列当前事实"**

在 `apps/api/src/modules/lifecycle-control/domain/lifecycle-date-fact.repository.ts` 的接口里加：

```ts
  listCurrentByContainer(input: {
    tenantId: string;
    containerId: string;
  }): Promise<
    Array<{
      nodeCode: LifecycleNodeCode;
      timeKind: string;
      occurredAt: Date;
    }>
  >;
```

在 `prisma-lifecycle-date-fact.repository.ts` 里实现（复用既有 `listCurrent` 的 where，但只取三列，并**把 `take` 提到 500**，避免 14 站 × 3 轨被 100 的硬上限截断）：

```ts
  async listCurrentByContainer(input: {
    tenantId: string;
    containerId: string;
  }): Promise<
    Array<{
      nodeCode: LifecycleNodeCode;
      timeKind: string;
      occurredAt: Date;
    }>
  > {
    return this.prisma.lifecycleDateFact.findMany({
      where: {
        tenantId: input.tenantId,
        containerId: input.containerId,
        isCurrent: true,
      },
      select: { nodeCode: true, timeKind: true, occurredAt: true },
      orderBy: [{ projectionVersion: "asc" }, { id: "asc" }],
      take: 500,
    }) as Promise<
      Array<{
        nodeCode: LifecycleNodeCode;
        timeKind: string;
        occurredAt: Date;
      }>
    >;
  }
```

> 实施时若 `LifecycleDateFactRepository` 的实现类没有直接持有 `prisma`，按该文件既有方法的取用方式调整。

- [ ] **Step 6: 服务接线**

`apps/api/src/modules/lifecycle-control/application/list-lifecycle-nodes.service.ts`：构造函数加

```ts
    @Inject(LIFECYCLE_DATE_FACT_REPOSITORY)
    private readonly dateFacts: LifecycleDateFactRepository,
```

`execute` 里 `projectLifecycleNodes` 调用改为：

```ts
    const facts = await this.dateFacts.listCurrentByContainer({
      tenantId,
      containerId,
    });
    const view = projectLifecycleNodes(flow, { facts });
```

- [ ] **Step 7: DTO 透出**

`lifecycle.dto.ts` 的 `LifecycleNodeItemDto` 加：

```ts
  @ApiProperty({
    description: "三轨时间；无数据时为 null，不得用假值填充",
  })
  times!: {
    plannedAt: string | null;
    estimatedAt: string | null;
    actualAt: string | null;
  };
```

`lifecycle-nodes.controller.ts` 与 `lifecycle-nodes-batch.controller.ts` 的映射里各加：

```ts
        times: {
          plannedAt: node.times.plannedAt?.toISOString() ?? null,
          estimatedAt: node.times.estimatedAt?.toISOString() ?? null,
          actualAt: node.times.actualAt?.toISOString() ?? null,
        },
```

- [ ] **Step 8: 全模块测试 + 提交**

Run: `pnpm --filter @logix/api test -- src/modules/lifecycle-control`
Expected: PASS

```bash
git add apps/api/src/modules/lifecycle-control
git commit -m "feat(lifecycle): 节点投影补三轨时间，无数据显式留空"
```

---

### Task 6: 前端类型与视图模型带上三轨与异常

**Files:**
- Modify: `apps/web/src/api/lifecycleNodes.ts`
- Modify: `apps/web/src/data/liveNodeProjection.ts`
- Modify: `apps/web/src/data/liveNodeProjection.test.ts`（若无则新建）

**Interfaces:**
- Consumes: Task 5 的 DTO 形状
- Produces: `LiveNodeView.times` / `LiveNodeView.blockedCount` / `LiveNodeView.isNotApplicable`

- [ ] **Step 1: 写失败测试**

新建或追加 `apps/web/src/data/liveNodeProjection.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { toLiveNode } from "./liveNodeProjection";

const base = {
  nodeInstanceId: "n1",
  nodeCode: "cargo_ready",
  sequence: 1,
  state: "active",
  applicability: "required",
  completedAt: null,
  blockedReasonRefs: [],
  isCurrent: true,
  times: { plannedAt: null, estimatedAt: null, actualAt: null },
};

describe("toLiveNode", () => {
  it("三轨无数据时保持 null，不用占位值", () => {
    const view = toLiveNode(base);
    expect(view.times).toEqual({
      plannedAt: null,
      estimatedAt: null,
      actualAt: null,
    });
  });

  it("未关闭阻塞计数来自 blockedReasonRefs", () => {
    expect(
      toLiveNode({ ...base, blockedReasonRefs: ["b1", "b2"] }).blockedCount,
    ).toBe(2);
  });

  it("optional_not_applicable 标为不适用，与留空区分", () => {
    const view = toLiveNode({
      ...base,
      applicability: "optional_not_applicable",
    });
    expect(view.isNotApplicable).toBe(true);
    expect(view.times.actualAt).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/web test src/data/liveNodeProjection.test.ts`
Expected: FAIL —— `blockedReasonRefs` / `times` 不在 `LifecycleNodeItem` 上

- [ ] **Step 3: 扩前端 DTO**

`apps/web/src/api/lifecycleNodes.ts` 的 `LifecycleNodeItem` 改为：

```ts
export interface LifecycleNodeTimes {
  plannedAt: string | null;
  estimatedAt: string | null;
  actualAt: string | null;
}

export interface LifecycleNodeItem {
  nodeInstanceId: string;
  nodeCode: string;
  sequence: number;
  state: string;
  applicability: string;
  completedAt: string | null;
  blockedReasonRefs: string[];
  isCurrent: boolean;
  times: LifecycleNodeTimes;
}
```

- [ ] **Step 4: 扩视图模型**

`apps/web/src/data/liveNodeProjection.ts` 改为：

```ts
import type { LifecycleNodeItem, LifecycleNodeTimes } from "../api/lifecycleNodes";
import { nodeScreenName } from "./uiCopyCatalog";

export interface LiveNodeView {
  nodeInstanceId: string;
  nodeCode: string;
  sequence: number;
  name: string;
  stateLabel: string;
  completedAt: string | null;
  isCurrent: boolean;
  isNotApplicable: boolean;
  blockedCount: number;
  times: LifecycleNodeTimes;
}

const EMPTY_TIMES: LifecycleNodeTimes = {
  plannedAt: null,
  estimatedAt: null,
  actualAt: null,
};

const NODE_STATE_LABELS: Record<string, string> = {
  pending: "未开始",
  active: "进行中",
  completed: "已完成",
};

export function toLiveNode(item: LifecycleNodeItem): LiveNodeView {
  const notApplicable = item.applicability === "optional_not_applicable";
  return {
    nodeInstanceId: item.nodeInstanceId,
    nodeCode: item.nodeCode,
    sequence: item.sequence,
    name: nodeScreenName(item.nodeCode),
    stateLabel: notApplicable
      ? "不适用"
      : (NODE_STATE_LABELS[item.state] ?? item.state),
    completedAt: item.completedAt,
    isCurrent: item.isCurrent,
    isNotApplicable: notApplicable,
    blockedCount: item.blockedReasonRefs?.length ?? 0,
    times: item.times ?? EMPTY_TIMES,
  };
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @logix/web test src/data/liveNodeProjection.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/api/lifecycleNodes.ts apps/web/src/data/liveNodeProjection.ts apps/web/src/data/liveNodeProjection.test.ts
git commit -m "feat(web): 节点视图模型补三轨时间与未关闭阻塞计数"
```

---

### Task 7: 轨道改成水平主轴，铺满 14 站

**Files:**
- Rewrite: `apps/web/src/components/container/LiveNodeRail.vue`
- Create: `apps/web/src/components/container/LiveNodeRail.test.ts`

**Interfaces:**
- Consumes: `LiveNodeView`（Task 6）
- Produces: `LiveNodeRail` 组件；`emits: select: [nodeInstanceId: string]`

- [ ] **Step 1: 写失败测试**

新建 `apps/web/src/components/container/LiveNodeRail.test.ts`：

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LiveNodeRail from "./LiveNodeRail.vue";
import type { LiveNodeView } from "../../data/liveNodeProjection";

function node(overrides: Partial<LiveNodeView>): LiveNodeView {
  return {
    nodeInstanceId: "n",
    nodeCode: "cargo_ready",
    sequence: 1,
    name: "备货",
    stateLabel: "未开始",
    completedAt: null,
    isCurrent: false,
    isNotApplicable: false,
    blockedCount: 0,
    times: { plannedAt: null, estimatedAt: null, actualAt: null },
    ...overrides,
  };
}

describe("LiveNodeRail", () => {
  it("每站显示摘要日期，无数据写 —", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        nodes: [
          node({
            nodeInstanceId: "n1",
            completedAt: "2026-09-19T00:00:00.000Z",
          }),
          node({ nodeInstanceId: "n2", nodeCode: "container_stuffing", sequence: 2, name: "装箱" }),
        ],
      },
    });
    const cells = wrapper.findAll('[data-testid="rail-node"]');
    expect(cells).toHaveLength(2);
    expect(cells[0]?.text()).toContain("09-19");
    expect(cells[1]?.text()).toContain("—");
  });

  it("不适用节点写不适用，不写成留空", () => {
    const wrapper = mount(LiveNodeRail, {
      props: {
        nodes: [
          node({
            nodeInstanceId: "n1",
            name: "中转",
            isNotApplicable: true,
            stateLabel: "不适用",
          }),
        ],
      },
    });
    expect(wrapper.text()).toContain("不适用");
  });

  it("点击节点抛出选择事件", async () => {
    const wrapper = mount(LiveNodeRail, {
      props: { nodes: [node({ nodeInstanceId: "n7" })] },
    });
    await wrapper.get('[data-testid="rail-node"]').trigger("click");
    expect(wrapper.emitted("select")).toEqual([["n7"]]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/web test src/components/container/LiveNodeRail.test.ts`
Expected: FAIL —— 没有 `data-testid="rail-node"`，且无 `select` 事件

- [ ] **Step 3: 重写组件**

`apps/web/src/components/container/LiveNodeRail.vue`（script + template 部分）：

```vue
<script setup lang="ts">
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  nodes: readonly LiveNodeView[];
}>();

const emit = defineEmits<{
  select: [nodeInstanceId: string];
}>();

// 摘要层只显示一个日期：实际 > 预计 > 计划 > 完成时间；四者皆无则写 —（不得用假值）。
// completedAt 作为最后兜底：老数据的节点可能有完成时间却没有对应的 actual 事实。
function summaryDate(node: LiveNodeView): string {
  const value =
    node.times.actualAt ??
    node.times.estimatedAt ??
    node.times.plannedAt ??
    node.completedAt;
  if (!value) return "—";
  return value.slice(5, 10);
}

function tone(node: LiveNodeView): string {
  if (node.isNotApplicable) return "na";
  if (node.completedAt) return "done";
  if (node.isCurrent) return "cur";
  return "";
}
</script>

<template>
  <nav class="rail" aria-label="货柜节点">
    <ol class="rail-track">
      <li
        v-for="node in nodes"
        :key="node.nodeInstanceId"
        data-testid="rail-node"
        class="rail-node"
        :class="[tone(node), { blocked: node.blockedCount > 0 }]"
        @click="emit('select', node.nodeInstanceId)"
      >
        <span class="line" aria-hidden="true" />
        <span class="dot" aria-hidden="true" />
        <span class="copy">
          <b>{{ node.name }}</b>
          <span class="date">{{ node.isNotApplicable ? "不适用" : summaryDate(node) }}</span>
          <span v-if="node.blockedCount > 0" class="blocked-mark" aria-hidden="true">⚠</span>
        </span>
      </li>
    </ol>
  </nav>
</template>
```

样式（`<style scoped>` 部分，追加在 template 之后）：

```vue
<style scoped>
.rail {
  margin: 0 0 12px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--surface);
  overflow-x: auto;
}

.rail-track {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 840px;
}

.rail-node {
  flex: 1;
  min-width: 0;
  position: relative;
  text-align: center;
  cursor: pointer;
  background: none;
  border: 0;
}

/* 贯穿横线：首尾各收一半，避免线段溢出轨道两端 */
.line {
  position: absolute;
  top: 8px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--line);
}

.rail-node:first-child .line {
  left: 50%;
}

.rail-node:last-child .line {
  right: 50%;
}

.dot {
  position: relative;
  z-index: 1;
  display: block;
  width: 16px;
  height: 16px;
  margin: 0 auto;
  border: 2px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface);
}

/* 四态互不混同：已完成 / 当前 / 未发生 / 不适用 */
.rail-node.done .dot {
  border-color: var(--ok);
  background: var(--ok);
}

.rail-node.done .line {
  background: var(--ok);
}

.rail-node.cur .dot {
  width: 18px;
  height: 18px;
  border-width: 4px;
  border-color: var(--brand);
}

.rail-node.na .dot {
  border-style: dashed;
  background: transparent;
}

.rail-node.na .line {
  height: 0;
  border-top: 2px dashed var(--line);
  background: transparent;
}

.rail-node.blocked .dot {
  border-color: var(--risk);
}

.copy {
  display: block;
  margin-top: 7px;
  color: var(--muted);
  font-size: 10px;
  white-space: nowrap;
}

.copy b {
  display: block;
  color: var(--ink);
  font-size: 10.5px;
  font-weight: 600;
}

.rail-node.na .copy b,
.rail-node.na .date {
  color: var(--muted);
}

.date {
  font-variant-numeric: tabular-nums;
}

.blocked-mark {
  color: var(--risk);
  margin-left: 3px;
}
</style>
```

> 若 `--ok` 变量不存在，用仓库既有的语义色变量替代（`UI_SYSTEM §7.1` 的 `brand / ok / warn / risk / info` 五色）。**不要**在这里新造颜色。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @logix/web test src/components/container/LiveNodeRail.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/container/LiveNodeRail.vue apps/web/src/components/container/LiveNodeRail.test.ts
git commit -m "feat(web): 轨道改为水平主轴，铺满 14 站并显式留空"
```

---

### Task 8: 常驻的三轨展开卡

**Files:**
- Create: `apps/web/src/components/container/NodeTimeTrackCard.vue`
- Create: `apps/web/src/components/container/NodeTimeTrackCard.test.ts`

**Interfaces:**
- Consumes: `LiveNodeView`（Task 6）
- Produces: `NodeTimeTrackCard` 组件；props `{ node: LiveNodeView | null }`

- [ ] **Step 1: 写失败测试**

新建 `apps/web/src/components/container/NodeTimeTrackCard.test.ts`：

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import NodeTimeTrackCard from "./NodeTimeTrackCard.vue";
import type { LiveNodeView } from "../../data/liveNodeProjection";

const node: LiveNodeView = {
  nodeInstanceId: "n3",
  nodeCode: "shipment_dispatch",
  sequence: 3,
  name: "出运",
  stateLabel: "进行中",
  completedAt: null,
  isCurrent: true,
  isNotApplicable: false,
  blockedCount: 1,
  times: {
    plannedAt: "2026-09-22T00:00:00.000Z",
    estimatedAt: "2026-09-22T00:00:00.000Z",
    actualAt: null,
  },
};

describe("NodeTimeTrackCard", () => {
  it("三轨槽位常驻，实际为空时写 —", () => {
    const wrapper = mount(NodeTimeTrackCard, { props: { node } });
    expect(wrapper.text()).toContain("计划");
    expect(wrapper.text()).toContain("预计");
    expect(wrapper.text()).toContain("实际");
    expect(wrapper.text()).toContain("2026-09-22");
    expect(wrapper.text()).toContain("—");
  });

  it("三轨全空时仍然渲染三行，不是不渲染", () => {
    const wrapper = mount(NodeTimeTrackCard, {
      props: {
        node: {
          ...node,
          times: { plannedAt: null, estimatedAt: null, actualAt: null },
        },
      },
    });
    expect(wrapper.text()).toContain("计划");
    expect(wrapper.text()).toContain("预计");
    expect(wrapper.text()).toContain("实际");
  });

  it("无选中节点时给出人话空态", () => {
    const wrapper = mount(NodeTimeTrackCard, { props: { node: null } });
    expect(wrapper.text()).toContain("选择上方任一站点");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/web test src/components/container/NodeTimeTrackCard.test.ts`
Expected: FAIL —— 找不到模块

- [ ] **Step 3: 实现组件**

新建 `apps/web/src/components/container/NodeTimeTrackCard.vue`：

```vue
<script setup lang="ts">
import type { LiveNodeView } from "../../data/liveNodeProjection";

defineProps<{
  node: LiveNodeView | null;
}>();

// 留空一律显示 —，不得用 0 或假日期冒充分已接通。
function show(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}
</script>

<template>
  <section class="track-card" aria-label="节点三轨时间">
    <p v-if="!node" class="empty">选择上方任一站点，查看它的计划 / 预计 / 实际时间。</p>
    <template v-else>
      <header>
        <b>{{ node.sequence.toString().padStart(2, "0") }} {{ node.name }}</b>
        <span>{{ node.stateLabel }}</span>
      </header>
      <dl class="tracks">
        <div><dt>计划</dt><dd :class="{ blank: !node.times.plannedAt }">{{ node.isNotApplicable ? "不适用" : show(node.times.plannedAt) }}</dd></div>
        <div><dt>预计</dt><dd :class="{ blank: !node.times.estimatedAt }">{{ node.isNotApplicable ? "不适用" : show(node.times.estimatedAt) }}</dd></div>
        <div><dt>实际</dt><dd :class="{ blank: !node.times.actualAt }">{{ node.isNotApplicable ? "不适用" : show(node.times.actualAt) }}</dd></div>
      </dl>
      <p v-if="node.blockedCount > 0" class="blocked" role="alert">
        有 {{ node.blockedCount }} 项未关闭的阻塞
      </p>
    </template>
  </section>
</template>
```

样式用 `--surface` / `--line` / `--muted` / `--risk` 变量，`.blank` 用 `color: var(--muted)`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @logix/web test src/components/container/NodeTimeTrackCard.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/container/NodeTimeTrackCard.vue apps/web/src/components/container/NodeTimeTrackCard.test.ts
git commit -m "feat(web): 新增常驻的节点三轨展开卡"
```

---

### Task 9: 一柜一档改成 L1 竖向堆叠

**Files:**
- Modify: `apps/web/src/views/MicroWorkbench.vue`
- Modify: `apps/web/src/views/MicroWorkbench.test.ts`

**Interfaces:**
- Consumes: `LiveNodeRail`（Task 7）、`NodeTimeTrackCard`（Task 8）
- Produces: 页面结构 = 柜头（含标记 / 异常槽位）→ 轨道 + 展开卡 → 下一步

- [ ] **Step 1: 写失败测试**

在 `apps/web/src/views/MicroWorkbench.test.ts` 加两条：

```ts
  it("标记槽位常驻，无数据写 —", async () => {
    getContainer.mockResolvedValue({
      id: "c1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus: "in_transit",
      updatedAt: "2026-09-13T03:00:00.000Z",
    });
    const wrapper = await mountPage("c1");
    expect(wrapper.text()).toContain("标记");
    expect(wrapper.text()).toContain("—");
  });

  it("有未关闭阻塞时异常槽位露出数量", async () => {
    getContainer.mockResolvedValue({
      id: "c1",
      orderNumber: "SO-1",
      containerNumber: "MSKU1",
      currentStatus: "in_transit",
      updatedAt: "2026-09-13T03:00:00.000Z",
    });
    listLifecycleNodes.mockResolvedValue({
      flow: { id: "f1", state: "active", currentNodeCode: "cargo_ready", version: 0 },
      nodes: [
        {
          nodeInstanceId: "n1",
          nodeCode: "cargo_ready",
          sequence: 1,
          state: "active",
          applicability: "required",
          completedAt: null,
          blockedReasonRefs: ["b1"],
          isCurrent: true,
          times: { plannedAt: null, estimatedAt: null, actualAt: null },
        },
      ],
      asOf: "2026-09-13T03:00:00.000Z",
      projectionVersion: 0,
    });
    const wrapper = await mountPage("c1");
    expect(wrapper.text()).toContain("异常");
    expect(wrapper.text()).toContain("1");
  });
```

同时，`mountPage` 里既有的 `LiveNodeRail` stub 需要改成暴露 `nodes` 的写法（保持既有断言可过）；并给 `NodeTimeTrackCard` 加一个 stub：

```ts
        NodeTimeTrackCard: {
          props: ["node"],
          template: '<section aria-label="节点三轨时间" />',
        },
```

另外，既有 fixture `listLifecycleNodes.mockResolvedValue` 里的每个 node 都要补 `blockedReasonRefs: []` 与 `times: { plannedAt: null, estimatedAt: null, actualAt: null }`，否则类型不过。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @logix/web test src/views/MicroWorkbench.test.ts`
Expected: FAIL —— 页面里没有"标记"槽位

- [ ] **Step 3: 改页面**

`apps/web/src/views/MicroWorkbench.vue` 的 `<template>` 里，`<PageHeader>` 之后改为：

```vue
      <PageHeader title="一柜一档" />

      <ObjectContextBar :record="record" />

      <section class="slot-band" aria-label="标记与异常">
        <span><small>标记</small><b>—</b></span>
        <span>
          <small>异常</small>
          <b :class="{ risk: blockedTotal > 0 }">{{ blockedTotal > 0 ? blockedTotal : "—" }}</b>
        </span>
      </section>

      <LiveNodeRail
        v-if="nodes.length"
        :nodes="nodes"
        @select="selectedNodeId = $event"
      />
      <p v-else class="hint">{{ uiCopy.chrome.emptyFlow }}</p>

      <NodeTimeTrackCard :node="selectedNode" />
```

`<script setup>` 里加：

```ts
import NodeTimeTrackCard from "../components/container/NodeTimeTrackCard.vue";

const selectedNodeId = ref("");
const blockedTotal = computed(() =>
  nodes.value.reduce((sum, node) => sum + node.blockedCount, 0),
);
// 默认展开当前站；当前站不存在时退回第一个。
const selectedNode = computed(
  () =>
    nodes.value.find((node) => node.nodeInstanceId === selectedNodeId.value) ??
    nodes.value.find((node) => node.isCurrent) ??
    nodes.value[0] ??
    null,
);
```

`load()` 里在 `nodes.value = ...` 之后加一行 `selectedNodeId.value = "";` 以重置选择。

**注意**：`标记槽位` 当前恒为 `—`，这是**有意的**——标记模型尚不存在（spec §7.1），槽位先立、数据后填。实施时不要为了"看起来有内容"而塞演示数据。

原有 `<section class="next-step">` 保留在最后；其中 `v-if="!nodes.length"` 那条空态提示已上移到轨道处，去重后只留事件为空与"去做这柜的任务"链接。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @logix/web test src/views/MicroWorkbench.test.ts`
Expected: PASS（含全部既有用例）

- [ ] **Step 5: 全量校验 + 提交**

Run: `pnpm --filter @logix/web validate`
Expected: lint / format / typecheck / test / e2e / build 全通过

```bash
git add apps/web/src/views/MicroWorkbench.vue apps/web/src/views/MicroWorkbench.test.ts
git commit -m "feat(web): 一柜一档改为竖向堆叠，补齐标记与异常槽位"
```

---

## 收尾校验

- [ ] `pnpm contract:drift` —— 契约无漂移
- [ ] `pnpm --filter @logix/api test` —— 后端全绿
- [ ] `pnpm --filter @logix/web validate` —— 前端全绿
- [ ] `pnpm validate`（仓库根，高风险切片门禁）—— 全绿
- [ ] 手工确认：找一个已过站的柜，打开 `/container/:id`，确认那一站的任务不再出现在 `/tasks`
- [ ] 手工确认：找一个刚建柜的柜，确认轨道**铺满 14 站**、三轨槽位全部在位且写作 `—`、中转/海铁显示"不适用"

## 已知不做（本计划范围外）

- **`标记` 的真实数据**：模型不存在（spec §7.1），槽位先立、留空。
- **缺口清单与"下一步"块**：二期。
- **`completionMode` 的判据**：字段已立于节点目录（Task 4），但一期没有生产者，`needs_manual_fact` 不会被写入（spec §7.3 已记录为预期）。
- **计划轨的数据**：全系统无 `planned` 事实生产者，该轨将长期留空（spec §7.2 已记录为预期）。
- **侧栏按组织分组**：D5 已决策，排在三期。
