import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "../../../../generated/prisma";
import { config } from "../config/env";
import { createPostgresAdapter } from "./postgres-adapter";

// Prisma 7：连接通过 driver adapter（@prisma/adapter-pg）注入，URL 只来自运行环境。
// schema 必须经 createPostgresAdapter 一并落到"Prisma 查询"和"裸 SQL"两条路径上，
// 只设一半会静默查错 schema —— 原因见该模块的文件头。
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: createPostgresAdapter(config.databaseUrl, config.databaseSchema),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
