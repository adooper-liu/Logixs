import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * keyset 分页的游标：记录上一页最后一条的位置（时间 + id）。
 *
 * 带上 tenantId 并在这里校验，是为了让一个租户拿到的游标在另一个租户手里
 * 直接失效 —— 否则换个租户 id 就能接着翻别人的页。
 *
 * 本模块的列表接口共用这一份实现，不各写一套。
 */
export function encodeKeysetCursor(
  tenantId: string,
  at: Date,
  id: string,
): string {
  return Buffer.from(
    JSON.stringify({ tenantId, at: at.toISOString(), id }),
  ).toString("base64url");
}

export function decodeKeysetCursor(
  value: string,
  tenantId: string,
): { at: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      tenantId?: unknown;
      at?: unknown;
      id?: unknown;
    };
    if (
      parsed.tenantId !== tenantId ||
      typeof parsed.at !== "string" ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      invalid();
    }
    const at = new Date(parsed.at as string);
    if (Number.isNaN(at.getTime())) invalid();
    return { at, id: parsed.id as string };
  } catch (error) {
    if (error instanceof HttpException) throw error;
    invalid();
  }
}

function invalid(): never {
  throw new HttpException("VALIDATION_FORMAT: cursor", HttpStatus.BAD_REQUEST);
}
