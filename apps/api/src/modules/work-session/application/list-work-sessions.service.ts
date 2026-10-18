import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { WorkSessionPageV1 } from "@logix/contracts";
import {
  WORK_SESSION_REPOSITORY,
  type WorkSessionRepository,
} from "../domain/work-session.repository";
import { toWorkSessionV1 } from "./open-work-session.service";

@Injectable()
export class ListWorkSessionsService {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly repository: WorkSessionRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    actorId: string;
    pageSize?: string;
    cursor?: string;
    includeClosed?: string;
  }): Promise<WorkSessionPageV1> {
    const pageSize = parsePageSize(input.pageSize);
    const includeClosed = parseIncludeClosed(input.includeClosed);
    const after = input.cursor
      ? decodeCursor(input.cursor, input.tenantId, input.actorId)
      : undefined;
    const rows = await this.repository.list({
      tenantId: input.tenantId,
      actorId: input.actorId,
      after,
      take: pageSize + 1,
      includeClosed,
    });
    const visible = rows.slice(0, pageSize);
    const last = visible.at(-1);
    return {
      contractVersion: "work-session-page.v1",
      items: visible.map(toWorkSessionV1),
      pageSize,
      nextCursor:
        rows.length > pageSize && last
          ? encodeCursor(
              input.tenantId,
              input.actorId,
              last.lastOpenedAt,
              last.sessionId,
            )
          : null,
    };
  }
}

function parseIncludeClosed(value: string | undefined): boolean {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new BadRequestException("VALIDATION_FORMAT: includeClosed");
}

function parsePageSize(value: string | undefined): number {
  if (value === undefined) return 50;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("VALIDATION_FORMAT: pageSize");
  }
  return parsed;
}

function encodeCursor(
  tenantId: string,
  actorId: string,
  at: Date,
  id: string,
): string {
  return Buffer.from(
    JSON.stringify({ tenantId, actorId, at: at.toISOString(), id }),
  ).toString("base64url");
}

function decodeCursor(value: string, tenantId: string, actorId: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      tenantId?: unknown;
      actorId?: unknown;
      at?: unknown;
      id?: unknown;
    };
    if (
      parsed.tenantId !== tenantId ||
      parsed.actorId !== actorId ||
      typeof parsed.at !== "string" ||
      typeof parsed.id !== "string" ||
      !parsed.id
    ) {
      throw new Error();
    }
    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime())) throw new Error();
    return { lastOpenedAt: at, id: parsed.id };
  } catch {
    throw new Error("VALIDATION_FORMAT: cursor");
  }
}
