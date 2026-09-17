import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type { NotificationRepository } from "../domain/notification.repository";
import type {
  CreateOpsNotificationInput,
  NotificationSeverity,
  OpsAssistantMessageRecord,
  OpsAssistantSessionRecord,
  OpsNotificationRecord,
} from "../domain/notification.types";

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    input: CreateOpsNotificationInput,
  ): Promise<OpsNotificationRecord> {
    const row = await this.prisma.opsNotification.create({
      data: {
        tenantId: input.tenantId,
        problemCode: input.problemCode,
        severity: input.severity,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
        recipientRoleCodes: [...input.recipientRoleCodes],
        conversationHint: input.conversationHint ?? null,
      },
    });
    return toNotification(row);
  }

  async listNotifications(query: {
    tenantId: string;
    actorRoles: readonly string[];
    limit: number;
  }): Promise<OpsNotificationRecord[]> {
    const rows = await this.prisma.opsNotification.findMany({
      where: {
        tenantId: query.tenantId,
        OR: [
          { recipientRoleCodes: { hasSome: [...query.actorRoles] } },
          { recipientRoleCodes: { equals: [] } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit,
    });
    return rows.map(toNotification);
  }

  async findNotification(query: {
    tenantId: string;
    id: string;
  }): Promise<OpsNotificationRecord | null> {
    const row = await this.prisma.opsNotification.findFirst({
      where: { tenantId: query.tenantId, id: query.id },
    });
    return row ? toNotification(row) : null;
  }

  async createSession(input: {
    tenantId: string;
    actorId: string;
    notificationId: string | null;
  }): Promise<OpsAssistantSessionRecord> {
    const row = await this.prisma.opsAssistantSession.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        notificationId: input.notificationId,
      },
    });
    return toSession(row);
  }

  async findSession(query: {
    tenantId: string;
    actorId: string;
    id: string;
  }): Promise<OpsAssistantSessionRecord | null> {
    const row = await this.prisma.opsAssistantSession.findFirst({
      where: {
        tenantId: query.tenantId,
        actorId: query.actorId,
        id: query.id,
      },
    });
    return row ? toSession(row) : null;
  }

  async addMessage(input: {
    sessionId: string;
    role: OpsAssistantMessageRecord["role"];
    body: string;
  }): Promise<OpsAssistantMessageRecord> {
    const row = await this.prisma.opsAssistantMessage.create({
      data: {
        sessionId: input.sessionId,
        role: input.role,
        body: input.body,
      },
    });
    return toMessage(row);
  }

  async listMessages(sessionId: string): Promise<OpsAssistantMessageRecord[]> {
    const rows = await this.prisma.opsAssistantMessage.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toMessage);
  }
}

function toNotification(row: {
  id: string;
  tenantId: string;
  problemCode: string;
  severity: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  recipientRoleCodes: string[];
  conversationHint: string | null;
  createdAt: Date;
}): OpsNotificationRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    problemCode: row.problemCode,
    severity: row.severity as NotificationSeverity,
    title: row.title,
    body: row.body,
    entityType: row.entityType,
    entityId: row.entityId,
    recipientRoleCodes: row.recipientRoleCodes,
    conversationHint: row.conversationHint,
    createdAt: row.createdAt,
  };
}

function toSession(row: {
  id: string;
  tenantId: string;
  actorId: string;
  notificationId: string | null;
  createdAt: Date;
}): OpsAssistantSessionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    actorId: row.actorId,
    notificationId: row.notificationId,
    createdAt: row.createdAt,
  };
}

function toMessage(row: {
  id: string;
  sessionId: string;
  role: string;
  body: string;
  createdAt: Date;
}): OpsAssistantMessageRecord {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as OpsAssistantMessageRecord["role"],
    body: row.body,
    createdAt: row.createdAt,
  };
}
