import { RequestMethod } from "@nestjs/common";
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { describe, expect, it } from "vitest";
import { SERVICE_ENDPOINT_KEY } from "../../security/route-access.decorator";
import { EnsureOutboxPublishSystemScheduleService } from "./application/ensure-outbox-publish-system-schedule.service";
import { WORKFLOW_SCHEDULE } from "./domain/workflow-schedule.port";
import { TemporalScheduleAdapter } from "./infrastructure/temporal-schedule.adapter";
import { OutboxPublishSystemScheduleController } from "./presentation/outbox-publish-system-schedule.controller";
import { WorkflowModule } from "./workflow.module";

describe("WorkflowModule HTTP surface", () => {
  it("只注册 service-only 系统 Schedule，不再注册 Echo 与租户 Schedule 入口", () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      WorkflowModule,
    ) as Array<unknown>;
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      WorkflowModule,
    ) as Array<unknown> | undefined;

    expect(controllers).toEqual([OutboxPublishSystemScheduleController]);
    expect(exports ?? []).toEqual([]);
  });

  it("保留系统 Schedule 服务与 Temporal Schedule adapter", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      WorkflowModule,
    ) as Array<unknown>;

    expect(providers).toContain(EnsureOutboxPublishSystemScheduleService);
    expect(providers).toContainEqual({
      provide: WORKFLOW_SCHEDULE,
      useClass: TemporalScheduleAdapter,
    });
  });

  it("系统 Schedule 入口仍是 service-only 且路径不变", () => {
    expect(
      Reflect.getMetadata(
        SERVICE_ENDPOINT_KEY,
        OutboxPublishSystemScheduleController,
      ),
    ).toBe(true);
    expect(
      Reflect.getMetadata(PATH_METADATA, OutboxPublishSystemScheduleController),
    ).toBe("workflows/outbox-system");
    const ensure = OutboxPublishSystemScheduleController.prototype.ensure;
    expect(Reflect.getMetadata(METHOD_METADATA, ensure)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, ensure)).toBe("schedule");
  });
});
