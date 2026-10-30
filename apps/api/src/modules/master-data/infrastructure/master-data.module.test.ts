import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { PrismaModule } from "../../../prisma/prisma.module";
import { PrismaService } from "../../../prisma/prisma.service";
import { MasterDataModule } from "../master-data.module";
import {
  CARGO_OWNER_DIRECTORY,
  type CargoOwnerDirectoryPort,
} from "../cargo-owner-directory.port";
import { CARGO_OWNER_REPOSITORY } from "../domain/cargo-owner.repository";
import { REFERENCE_INTERNAL_OCEAN_BASELINE } from "../reference-internal-ocean-baseline.port";
import { REFERENCE_EXTERNAL_OCEAN_MAPPING } from "../reference-external-ocean-mapping.port";

describe("MasterDataModule startup", () => {
  it("initializes and exposes the cargo-owner and ocean reference ports together", async () => {
    const owners = [{ id: "owner-1", stableCode: "owner" }];
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, MasterDataModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(CARGO_OWNER_REPOSITORY)
      .useValue({ listActive: vi.fn().mockResolvedValue(owners) })
      .compile();
    try {
      await moduleRef.init();
      const directory = moduleRef.get<CargoOwnerDirectoryPort>(
        CARGO_OWNER_DIRECTORY,
      );
      await expect(directory.listActive()).resolves.toEqual(owners);
      expect(
        moduleRef.get(REFERENCE_INTERNAL_OCEAN_BASELINE).readBaseline,
      ).toBeTypeOf("function");
      expect(
        moduleRef.get(REFERENCE_EXTERNAL_OCEAN_MAPPING).resolve,
      ).toBeTypeOf("function");
    } finally {
      await moduleRef.close();
    }
  });
});
