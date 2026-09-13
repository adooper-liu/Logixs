const MAX_CONTAINER_IDS = 200;

export function parseContainerIds(raw: string | undefined): string[] {
  const ids = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    throw new Error("VALIDATION_REQUIRED: containerIds 必填");
  }
  if (unique.length > MAX_CONTAINER_IDS) {
    throw new Error("VALIDATION_RANGE: containerIds 最多 200 个");
  }
  return unique;
}
