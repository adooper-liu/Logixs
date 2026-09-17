# 数据库迁移入口

此目录是 Logix 唯一迁移入口。后续迁移必须追加、版本化，并附空库升级、旧版本升级、约束验证和恢复说明。

禁止把生产数据修复或临时 SQL 散落到其他目录。已进入共享环境的迁移不可修改。

## 本地命令

- `pnpm db:migrate`：`prisma migrate deploy`，只把尚未登记的迁移应用到当前库。
- `pnpm db:migrate:status`：对照本地文件与 `_prisma_migrations`。
- `pnpm db:setup`：generate + migrate + 幂等 seed。

不要用 `prisma migrate dev` 作为日常对齐。`20260913011044_inbox` 在时间序上早于 `outbox_replay_request` 建表，空库和影子库重放会在其第二条语句失败（P3018）。该文件已提交，不能改 SQL。

`pnpm db:migrate` 通过 `scripts/migrate-deploy.mjs` 执行。包装脚本只在迁移名、PostgreSQL 错误码 `42P01` 和缺失表名三者均匹配上述已知故障时，将该迁移标记为已应用并继续；任何其他迁移错误原样失败。第一条 `canonical_event.evidence_refs DROP DEFAULT` 在 PostgreSQL 中已先行生效，后置迁移 `20260913050000_add_outbox_replay` 创建目标表，`20260913060000_add_outbox_replay_request_hash` 创建对应列，追加迁移 `20260916110000_drop_outbox_replay_request_hash_default` 再移除临时默认值，使数据库与 Prisma schema 一致。

若数据库已在旧脚本下留下 P3009 失败记录，先核对 `_prisma_migrations.logs` 为 `42P01 / outbox_replay_request does not exist`，并确认 `canonical_event.evidence_refs` 无默认值，再执行：

```text
pnpm exec prisma migrate resolve --applied 20260913011044_inbox --schema database/schema.prisma
pnpm db:migrate
```

新增迁移时：以当前已对齐的开发库为基准，用 `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel database/schema.prisma --script` 写出 SQL，放入新的时间戳目录，再 `pnpm db:migrate`。不要对这份历史跑 `migrate dev`。

空库从零重放会由上述包装脚本恢复这一个已知历史故障；不得把该机制扩展为忽略其他迁移失败。
