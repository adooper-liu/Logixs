import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { sha256Hex } from "@logix/full-chain-sample-contracts";
import {
  digestObjectBody,
  buildRehearsalObjectKey,
} from "../../../tools/full-chain-demo/external-adapters";
import type { LandingReceiptStore } from "../domain/landing-receipt-store.port";

export type LandingReceiptStorePolicy = {
  rehearsalTenantId: string;
  oldDemoTenantId: string;
  prefixRoot: "rehearsal" | "demo-switch";
  mode?: "rehearsal" | "demo_switch";
};

export class S3LandingReceiptStore implements LandingReceiptStore {
  constructor(
    private readonly client: Pick<S3Client, "send">,
    private readonly bucket: string,
    private readonly policy: LandingReceiptStorePolicy,
  ) {}

  async putIfAbsent(input: {
    tenantId: string;
    runId: string;
    body: string;
    digest: string;
  }): Promise<{ keyHash: string; digest: string; replayed: boolean }> {
    const key = this.key(input.tenantId, input.runId);
    if (sha256Hex(input.body) !== input.digest)
      throw new Error("FULL_CHAIN_RECEIPT_DIGEST_INVALID");
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.body,
          ContentType: "application/json",
          IfNoneMatch: "*",
          Metadata: { digest: input.digest.slice(0, 16) },
        }),
      );
      return {
        keyHash: sha256Hex(key),
        digest: input.digest,
        replayed: false,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (status !== 409 && status !== 412) throw error;
      const existing = await this.readDigest({
        tenantId: input.tenantId,
        runId: input.runId,
      });
      if (existing !== input.digest)
        throw new Error("FULL_CHAIN_RECEIPT_CONFLICT", { cause: error });
      return {
        keyHash: sha256Hex(key),
        digest: input.digest,
        replayed: true,
      };
    }
  }

  async readDigest(input: {
    tenantId: string;
    runId: string;
  }): Promise<string | null> {
    const key = this.key(input.tenantId, input.runId);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return (await digestObjectBody(response.Body)).sha256;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (status === 404 || (error as { name?: string }).name === "NoSuchKey")
        return null;
      throw error;
    }
  }

  async deleteOwnedKey(input: {
    tenantId: string;
    runId: string;
    digest: string;
  }): Promise<void> {
    const key = this.key(input.tenantId, input.runId);
    if ((await this.readDigest(input)) !== input.digest)
      throw new Error("FULL_CHAIN_RECEIPT_OWNERSHIP_INVALID");
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  private key(tenantId: string, runId: string): string {
    const demoSwitch = this.policy.mode === "demo_switch";
    if (
      tenantId !== this.policy.rehearsalTenantId ||
      (!demoSwitch && tenantId === this.policy.oldDemoTenantId) ||
      tenantId.includes("..") ||
      tenantId.includes("\\") ||
      tenantId.startsWith("/") ||
      this.policy.prefixRoot !== (demoSwitch ? "demo-switch" : "rehearsal")
    )
      throw new Error("FULL_CHAIN_RECEIPT_SCOPE_INVALID");
    try {
      if (demoSwitch) {
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
            runId,
          )
        )
          throw new Error("FULL_CHAIN_RECEIPT_SCOPE_INVALID");
        return `${this.policy.prefixRoot}/${tenantId}/${runId}/receipt.json`;
      }
      return buildRehearsalObjectKey(
        `${this.policy.prefixRoot}/${tenantId}/${runId}`,
        "receipt.json",
      );
    } catch {
      throw new Error("FULL_CHAIN_RECEIPT_SCOPE_INVALID");
    }
  }
}
