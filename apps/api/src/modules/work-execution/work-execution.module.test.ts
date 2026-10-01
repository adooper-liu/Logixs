import { MODULE_METADATA } from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { CreateNodeTaskService } from "./application/create-node-task.service";
import { CREATE_NODE_TASK } from "./create-node-task.port";
import * as publicEntry from "./index";
import { moduleManifest } from "./module.manifest";
import { RECONCILE_APPLIED_LIFECYCLE_FACT } from "./reconcile-applied-lifecycle-fact.port";
import { WorkExecutionModule } from "./work-execution.module";

describe("WorkExecutionModule node task creation port", () => {
  it("只经内部 Port 对外提供任务创建，不导出具体 Service", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      WorkExecutionModule,
    ) as Array<unknown>;
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      WorkExecutionModule,
    ) as Array<unknown>;

    expect(providers).toContain(CreateNodeTaskService);
    expect(providers).toContainEqual({
      provide: CREATE_NODE_TASK,
      useExisting: CreateNodeTaskService,
    });
    expect(exports).toContain(CREATE_NODE_TASK);
    expect(exports).not.toContain(CreateNodeTaskService);
    expect(moduleManifest.publicPorts).toContain("CREATE_NODE_TASK");
    expect(publicEntry).toHaveProperty("CREATE_NODE_TASK", CREATE_NODE_TASK);
    expect(publicEntry).not.toHaveProperty("CreateNodeTaskService");
  });
});

describe("WorkExecutionModule public reconciliation port", () => {
  it("registers and exports the public port token", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      WorkExecutionModule,
    ) as Array<unknown>;
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      WorkExecutionModule,
    ) as Array<unknown>;

    expect(providers).toContainEqual(
      expect.objectContaining({ provide: RECONCILE_APPLIED_LIFECYCLE_FACT }),
    );
    expect(exports).toContain(RECONCILE_APPLIED_LIFECYCLE_FACT);
    expect(moduleManifest.publicPorts).toContain(
      "RECONCILE_APPLIED_LIFECYCLE_FACT",
    );
    expect(moduleManifest.depends).not.toContain("lifecycle-control");
  });
});
