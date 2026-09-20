-- Versioned authoritative ocean routes used by arrival lifecycle guards.
CREATE TABLE "ocean_route_plan" (
  "id" TEXT NOT NULL,
  "container_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "supersedes_route_id" TEXT,
  "activated_at" TIMESTAMPTZ NOT NULL,
  "superseded_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ocean_route_plan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ocean_route_plan_version_check" CHECK ("version" > 0),
  CONSTRAINT "ocean_route_plan_status_check" CHECK ("status" IN ('active', 'superseded')),
  CONSTRAINT "ocean_route_plan_activation_check" CHECK (
    ("status" = 'active' AND "superseded_at" IS NULL)
    OR ("status" = 'superseded' AND "superseded_at" IS NOT NULL)
  ),
  CONSTRAINT "ocean_route_plan_container_id_fkey"
    FOREIGN KEY ("container_id") REFERENCES "container_record"("id") ON DELETE RESTRICT,
  CONSTRAINT "ocean_route_plan_supersedes_route_id_fkey"
    FOREIGN KEY ("supersedes_route_id") REFERENCES "ocean_route_plan"("id") ON DELETE RESTRICT
);

CREATE TABLE "ocean_route_segment" (
  "id" TEXT NOT NULL,
  "route_plan_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "transport_mode" TEXT NOT NULL,
  "origin_unlocode" TEXT NOT NULL,
  "origin_timezone" TEXT NOT NULL,
  "destination_location_type" TEXT NOT NULL,
  "destination_unlocode" TEXT NOT NULL,
  "destination_location_id" TEXT,
  "destination_port_call_id" TEXT,
  "destination_timezone" TEXT NOT NULL,
  "is_final" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ocean_route_segment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ocean_route_segment_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "ocean_route_segment_mode_check" CHECK (
    "transport_mode" IN ('vessel', 'feeder', 'barge')
  ),
  CONSTRAINT "ocean_route_segment_location_check" CHECK (
    "destination_location_type" IN ('port', 'terminal')
    AND (
      "destination_location_type" = 'port'
      OR "destination_location_id" IS NOT NULL
    )
    AND "origin_unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$'
    AND "destination_unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$'
    AND length("origin_timezone") BETWEEN 1 AND 100
    AND length("destination_timezone") BETWEEN 1 AND 100
    AND (
      "destination_location_id" IS NULL
      OR "destination_location_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    AND ("destination_port_call_id" IS NULL OR length("destination_port_call_id") BETWEEN 1 AND 200)
  ),
  CONSTRAINT "ocean_route_segment_route_plan_id_fkey"
    FOREIGN KEY ("route_plan_id") REFERENCES "ocean_route_plan"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "ocean_route_plan_container_version_key"
ON "ocean_route_plan"("container_id", "version");

CREATE UNIQUE INDEX "ocean_route_plan_supersedes_key"
ON "ocean_route_plan"("supersedes_route_id");

CREATE UNIQUE INDEX "ocean_route_plan_one_active_key"
ON "ocean_route_plan"("container_id") WHERE "status" = 'active';

CREATE INDEX "ocean_route_plan_container_status_idx"
ON "ocean_route_plan"("container_id", "status");

CREATE UNIQUE INDEX "ocean_route_segment_sequence_key"
ON "ocean_route_segment"("route_plan_id", "sequence");

CREATE UNIQUE INDEX "ocean_route_segment_one_final_key"
ON "ocean_route_segment"("route_plan_id") WHERE "is_final";

CREATE INDEX "ocean_route_segment_final_idx"
ON "ocean_route_segment"("route_plan_id", "is_final");

-- Recovery: application rollback may leave these additive tables unread. Dropping
-- them loses route-version audit context and must only follow a verified backup.
