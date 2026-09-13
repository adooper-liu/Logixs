# 数据库迁移入口

此目录是 Logix 唯一迁移入口。后续迁移必须追加、版本化，并附空库升级、旧版本升级、约束验证和恢复说明。

禁止把生产数据修复或临时 SQL 散落到其他目录。已进入共享环境的迁移不可修改。

## 本地命令

- `pnpm db:migrate`：`prisma migrate deploy`，只把尚未登记的迁移应用到当前库。
- `pnpm db:migrate:status`：对照本地文件与 `_prisma_migrations`。
- `pnpm db:setup`：generate + migrate + 幂等 seed。

不要用 `prisma migrate dev` 作为日常对齐。`20260913011044_inbox` 在时间序上早于 `outbox_replay_request` 建表，影子库重放会失败（P3018）。该文件已提交，不能改 SQL。

新增迁移时：以当前已对齐的开发库为基准，用 `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel database/schema.prisma --script` 写出 SQL，放入新的时间戳目录，再 `pnpm db:migrate`。不要对这份历史跑 `migrate dev`。

空库从零重放整条历史仍会在 `20260913011044_inbox` 失败；这是已知债，不能靠改旧文件修复。
