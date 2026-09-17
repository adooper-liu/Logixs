export const IMPORT_SOURCE_STORAGE = Symbol("ImportSourceStorage");

export interface StoreImportSourceInput {
  objectKey: string;
  contentType: string;
  contentLength: number;
  sha256: string;
  body: Buffer;
}

export interface ImportSourceStorage {
  put(input: StoreImportSourceInput): Promise<void>;
  delete(objectKey: string): Promise<void>;
}
