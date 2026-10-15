import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "@logix/full-chain-sample-contracts";
import { S3LandingReceiptStore } from "./s3-landing-receipt.store";

type StoredObject = { body: string };

type TestCommand = {
  constructor: { name: string };
  input: { Key?: string; Body?: unknown };
};

function memorySender(options: { timeoutAfterFirstPut?: boolean } = {}) {
  const objects = new Map<string, StoredObject>();
  let putCount = 0;
  const send = vi.fn(async (command: TestCommand) => {
    const name = command.constructor.name;
    const key = String(command.input.Key ?? "");
    if (name === "PutObjectCommand") {
      putCount += 1;
      if (objects.has(key)) {
        const error = new Error("precondition");
        Object.assign(error, { $metadata: { httpStatusCode: 412 } });
        throw error;
      }
      objects.set(key, { body: String(command.input.Body) });
      if (options.timeoutAfterFirstPut && putCount === 1)
        throw new Error("NETWORK_TIMEOUT_AFTER_PUT");
      return {};
    }
    if (name === "GetObjectCommand") {
      const item = objects.get(key);
      if (!item) {
        const error = new Error("missing");
        Object.assign(error, { $metadata: { httpStatusCode: 404 } });
        throw error;
      }
      return { Body: Readable.from([item.body]) };
    }
    if (name === "DeleteObjectCommand") {
      objects.delete(key);
      return {};
    }
    throw new Error(`UNEXPECTED_COMMAND:${name}`);
  });
  return {
    send,
    objects,
    get putCount() {
      return putCount;
    },
  };
}

const TENANT = "rehearsal-tenant";
const RUN = "00000000-0000-4000-8000-000000000001";
const BODY = '{"receiptVersion":"full-chain-rehearsal-receipt.v1"}\n';
const DIGEST = sha256Hex(BODY);

function store(sender: ReturnType<typeof memorySender>) {
  return new S3LandingReceiptStore({ send: sender.send } as never, "receipts", {
    rehearsalTenantId: TENANT,
    oldDemoTenantId: "demo-real-sample-20260921",
    prefixRoot: "rehearsal",
  });
}

describe("S3LandingReceiptStore", () => {
  it.each([
    "demo-real-sample-20260921",
    "another-tenant",
    "../escape",
    "rehearsal\\escape",
    "/absolute",
  ])("rejects tenant or prefix escape %s before S3 I/O", async (tenantId) => {
    const sender = memorySender();
    await expect(
      store(sender).putIfAbsent({
        tenantId,
        runId: RUN,
        body: BODY,
        digest: DIGEST,
      }),
    ).rejects.toThrow(/FULL_CHAIN_RECEIPT_SCOPE_INVALID/);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("allows the old demo tenant only in explicit demo-switch scope", async () => {
    const sender = memorySender();
    const receiptStore = new S3LandingReceiptStore(
      { send: sender.send } as never,
      "receipts",
      {
        rehearsalTenantId: "demo-real-sample-20260921",
        oldDemoTenantId: "demo-real-sample-20260921",
        prefixRoot: "demo-switch",
        mode: "demo_switch",
      },
    );

    await expect(
      receiptStore.putIfAbsent({
        tenantId: "demo-real-sample-20260921",
        runId: RUN,
        body: BODY,
        digest: DIGEST,
      }),
    ).resolves.toMatchObject({ replayed: false });
    expect([...sender.objects.keys()]).toEqual([
      `demo-switch/demo-real-sample-20260921/${RUN}/receipt.json`,
    ]);
  });

  it("stores once and replays only the same digest", async () => {
    const sender = memorySender();
    const receiptStore = store(sender);
    expect(
      await receiptStore.putIfAbsent({
        tenantId: TENANT,
        runId: RUN,
        body: BODY,
        digest: DIGEST,
      }),
    ).toMatchObject({ digest: DIGEST, replayed: false });
    expect(
      await receiptStore.putIfAbsent({
        tenantId: TENANT,
        runId: RUN,
        body: BODY,
        digest: DIGEST,
      }),
    ).toMatchObject({ digest: DIGEST, replayed: true });
    await expect(
      receiptStore.putIfAbsent({
        tenantId: TENANT,
        runId: RUN,
        body: "different",
        digest: sha256Hex("different"),
      }),
    ).rejects.toThrow(/FULL_CHAIN_RECEIPT_CONFLICT/);
    expect(sender.objects.size).toBe(1);
  });

  it("recovers when the first put stores the object but returns a timeout", async () => {
    const sender = memorySender({ timeoutAfterFirstPut: true });
    const receiptStore = store(sender);
    await expect(
      receiptStore.putIfAbsent({
        tenantId: TENANT,
        runId: RUN,
        body: BODY,
        digest: DIGEST,
      }),
    ).rejects.toThrow(/NETWORK_TIMEOUT_AFTER_PUT/);
    expect(
      await receiptStore.putIfAbsent({
        tenantId: TENANT,
        runId: RUN,
        body: BODY,
        digest: DIGEST,
      }),
    ).toMatchObject({ digest: DIGEST, replayed: true });
    expect(sender.objects.size).toBe(1);
    expect(sender.putCount).toBe(2);
  });
});
