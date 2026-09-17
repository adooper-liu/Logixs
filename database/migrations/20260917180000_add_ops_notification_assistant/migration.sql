-- CreateTable
CREATE TABLE "ops_notification" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "problem_code" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "recipient_role_codes" TEXT[],
    "conversation_hint" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_assistant_session" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "notification_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_assistant_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_assistant_message" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_assistant_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ops_notification_list_idx" ON "ops_notification"("tenant_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ops_assistant_session_actor_idx" ON "ops_assistant_session"("tenant_id", "actor_id", "created_at");

-- CreateIndex
CREATE INDEX "ops_assistant_message_session_idx" ON "ops_assistant_message"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "ops_assistant_session" ADD CONSTRAINT "ops_assistant_session_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "ops_notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_assistant_message" ADD CONSTRAINT "ops_assistant_message_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ops_assistant_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
