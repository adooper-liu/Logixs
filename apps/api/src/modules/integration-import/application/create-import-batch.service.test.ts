import { HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { AiGatewayService } from "../../ai-governance";
import { IMPORT_REPOSITORY } from "../domain/import.repository";
import { CreateImportBatchService } from "./create-import-batch.service";

const BUFFER = Buffer.from("备货单号,箱号\nSO-1,MSKU1\n", "utf8");
const FILE_HASH = createHash("sha256").update(BUFFER).digest("hex");

async function buildService(repository: {
  findByIdempotencyKey: ReturnType<typeof vi.fn>;
}) {
  const aiGateway = { suggestImportMapping: vi.fn().mockResolvedValue([]) };
  const module = await Test.createTestingModule({
    providers: [
      CreateImportBatchService,
      { provide: IMPORT_REPOSITORY, useValue: repository },
      { provide: AiGatewayService, useValue: aiGateway },
    ],
  }).compile();
  return module.get(CreateImportBatchService);
}

function baseInput() {
  return {
    fileName: "import.csv",
    buffer: BUFFER,
    idempotencyKey: "key-1",
    tenantId: "t1",
    operatorId: "op1",
  };
}

describe("CreateImportBatchService", () => {
  it(".xls 格式 → 拒绝 VALIDATION_FORMAT", async () => {
    const repository = { findByIdempotencyKey: vi.fn() };
    const service = await buildService(repository);

    await expect(
      service.execute({ ...baseInput(), fileName: "import.xls" }),
    ).rejects.toThrow(HttpException);
    expect(repository.findByIdempotencyKey).not.toHaveBeenCalled();
  });

  it("同 key 同 hash → 幂等返回原批次（created=false）", async () => {
    const existing = { id: "b1", fileHash: FILE_HASH, status: "parsed" };
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(existing),
    };
    const service = await buildService(repository);

    const result = await service.execute(baseInput());

    expect(result.created).toBe(false);
    expect(result.batch.id).toBe("b1");
  });
});
