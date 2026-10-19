import {
  MODULE_METADATA,
  SELF_DECLARED_DEPS_METADATA,
} from "@nestjs/common/constants";
import type { Provider, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { TASK_COLLABORATION_EVIDENCE } from "../document-records";
import { TASK_COLLABORATION_CONTEXT } from "../work-execution";
import { ListTaskCollaborationService } from "./application/list-task-collaboration.service";
import { PostTaskCollaborationService } from "./application/post-task-collaboration.service";
import { TASK_COLLABORATION_REPOSITORY } from "./domain/task-collaboration.repository";
import { TaskCollaborationModule } from "./task-collaboration.module";

const taskCollaborationClock = Symbol.for("logix.TaskCollaborationClock");

describe("TaskCollaborationModule", () => {
  it("resolves both collaboration application services", async () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      TaskCollaborationModule,
    ) as Provider[];

    expectClockInjection(ListTaskCollaborationService);
    expectClockInjection(PostTaskCollaborationService);
    expect(providers).toContainEqual({
      provide: taskCollaborationClock,
      useValue: expect.any(Function),
    });

    const module = await Test.createTestingModule({
      providers: [
        ...providers,
        { provide: TASK_COLLABORATION_CONTEXT, useValue: {} },
        { provide: TASK_COLLABORATION_EVIDENCE, useValue: {} },
      ],
    })
      .overrideProvider(TASK_COLLABORATION_REPOSITORY)
      .useValue({})
      .compile();

    expect(module.get(ListTaskCollaborationService)).toBeInstanceOf(
      ListTaskCollaborationService,
    );
    expect(module.get(PostTaskCollaborationService)).toBeInstanceOf(
      PostTaskCollaborationService,
    );
    await module.close();
  });
});

function expectClockInjection(target: Type<unknown>): void {
  const dependencies = Reflect.getMetadata(
    SELF_DECLARED_DEPS_METADATA,
    target,
  ) as Array<{ index: number; param: unknown }> | undefined;

  expect(dependencies).toContainEqual({
    index: 3,
    param: taskCollaborationClock,
  });
}
