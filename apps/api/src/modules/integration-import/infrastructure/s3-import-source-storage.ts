import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ObjectStorageConfig } from "../../../config/env";
import type {
  ImportSourceStorage,
  StoreImportSourceInput,
} from "../domain/import-source-storage";

type ImportSourceS3Command =
  | CreateBucketCommand
  | DeleteObjectCommand
  | HeadBucketCommand
  | PutObjectCommand;

interface S3Sender {
  send(
    command: ImportSourceS3Command,
    options?: { abortSignal?: AbortSignal },
  ): Promise<unknown>;
}

export class S3ImportSourceStorage implements ImportSourceStorage {
  private bucketReady: Promise<void> | null = null;

  constructor(
    private readonly storageConfig: ObjectStorageConfig,
    private readonly client: S3Sender = createClient(storageConfig),
  ) {
    assertConfig(storageConfig);
  }

  async put(input: StoreImportSourceInput): Promise<void> {
    await this.ensureBucket();
    await this.send(
      new PutObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        ChecksumSHA256: Buffer.from(input.sha256, "hex").toString("base64"),
        Metadata: { sha256: input.sha256 },
      }),
    );
  }

  async delete(objectKey: string): Promise<void> {
    await this.send(
      new DeleteObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: objectKey,
      }),
    );
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = this.checkOrCreateBucket().catch((error) => {
        this.bucketReady = null;
        throw error;
      });
    }
    await this.bucketReady;
  }

  private async checkOrCreateBucket(): Promise<void> {
    try {
      await this.send(
        new HeadBucketCommand({ Bucket: this.storageConfig.bucket }),
      );
    } catch (error) {
      if (!isMissingBucket(error) || !this.storageConfig.allowBucketCreation) {
        throw error;
      }
      await this.send(
        new CreateBucketCommand({ Bucket: this.storageConfig.bucket }),
      );
    }
  }

  private async send(command: ImportSourceS3Command): Promise<void> {
    await this.client.send(command, {
      abortSignal: AbortSignal.timeout(this.storageConfig.timeoutMs),
    });
  }
}

function createClient(storageConfig: ObjectStorageConfig): S3Sender {
  return new S3Client({
    endpoint: storageConfig.endpoint,
    region: storageConfig.region,
    forcePathStyle: storageConfig.forcePathStyle,
    maxAttempts: 3,
    credentials: {
      accessKeyId: storageConfig.accessKey,
      secretAccessKey: storageConfig.secretKey,
    },
  }) as S3Sender;
}

function assertConfig(storageConfig: ObjectStorageConfig): void {
  if (
    !storageConfig.endpoint ||
    !storageConfig.region ||
    !storageConfig.bucket ||
    !storageConfig.accessKey ||
    !storageConfig.secretKey ||
    !Number.isFinite(storageConfig.timeoutMs) ||
    storageConfig.timeoutMs <= 0
  ) {
    throw new Error("OBJECT_STORAGE_CONFIG_INVALID");
  }
}

function isMissingBucket(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NoSuchBucket" ||
    candidate.name === "NotFound" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
