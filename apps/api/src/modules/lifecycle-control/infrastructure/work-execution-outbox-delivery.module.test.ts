import { MODULE_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import {
  RECONCILE_APPLIED_LIFECYCLE_FACT,
  WorkExecutionModule,
} from "../../work-execution";
import { ASSERT_CONTAINER_TENANT } from "../../shipment-registry";
import { PrismaService } from "../../../prisma/prisma.service";
import { OUTBOX_DELIVERY } from "../application/publish-outbox-batch.service";
import { LifecycleControlModule } from "../lifecycle-control.module";
import { StubOutboxDelivery } from "./stub-outbox-delivery";
import { WorkExecutionOutboxDelivery } from "./work-execution-outbox-delivery";

describe("LifecycleControlModule reconciliation delivery assembly", () => {
  it("resolves the composite delivery with the work-execution public token", async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: {} },
        {
          provide: RECONCILE_APPLIED_LIFECYCLE_FACT,
          useValue: { execute: async () => undefined },
        },
        {
          provide: ASSERT_CONTAINER_TENANT,
          useValue: { execute: async () => undefined },
        },
        StubOutboxDelivery,
        WorkExecutionOutboxDelivery,
        {
          provide: OUTBOX_DELIVERY,
          useExisting: WorkExecutionOutboxDelivery,
        },
      ],
    }).compile();

    expect(module.get(OUTBOX_DELIVERY)).toBeInstanceOf(
      WorkExecutionOutboxDelivery,
    );
    await module.close();
  });

  it("imports WorkExecutionModule and binds the composite delivery", () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      LifecycleControlModule,
    ) as Array<unknown>;
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      LifecycleControlModule,
    ) as Array<unknown>;

    expect(
      imports.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "forwardRef" in entry &&
          (entry as { forwardRef: () => unknown }).forwardRef() ===
            WorkExecutionModule,
      ),
    ).toBe(true);
    expect(providers).toContain(WorkExecutionOutboxDelivery);
    expect(providers).toContainEqual({
      provide: OUTBOX_DELIVERY,
      useExisting: WorkExecutionOutboxDelivery,
    });
  });
});
