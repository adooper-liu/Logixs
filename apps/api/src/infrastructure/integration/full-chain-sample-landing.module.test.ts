import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { FullChainSampleLandingModule } from "../../modules/full-chain-sample-landing/full-chain-sample-landing.module";

describe("FullChainSampleLandingModule", () => {
  it("resolves the landing repository without requiring a test-hook provider", async () => {
    const testing = await Test.createTestingModule({
      imports: [PrismaModule, FullChainSampleLandingModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(testing).toBeDefined();
    await testing.close();
  });
});
