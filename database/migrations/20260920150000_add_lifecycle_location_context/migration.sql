-- Lifecycle date facts and their canonical events retain structured location/segment context.
-- Existing rows remain valid with no location; arrival guards keep such facts pending.
ALTER TABLE "lifecycle_date_fact"
ADD COLUMN "location_type" TEXT,
ADD COLUMN "unlocode" TEXT,
ADD COLUMN "location_id" TEXT,
ADD COLUMN "segment_id" TEXT,
ADD COLUMN "port_call_id" TEXT,
ADD COLUMN "location_timezone" TEXT;

ALTER TABLE "canonical_event"
ADD COLUMN "location_type" TEXT,
ADD COLUMN "unlocode" TEXT,
ADD COLUMN "location_id" TEXT,
ADD COLUMN "segment_id" TEXT,
ADD COLUMN "port_call_id" TEXT,
ADD COLUMN "location_timezone" TEXT;

ALTER TABLE "lifecycle_date_fact"
ADD CONSTRAINT "lifecycle_date_fact_location_context_check"
CHECK (
  (
    "location_type" IS NULL
    AND "unlocode" IS NULL
    AND "location_id" IS NULL
    AND "segment_id" IS NULL
    AND "port_call_id" IS NULL
    AND "location_timezone" IS NULL
  )
  OR (
    "location_type" IS NOT NULL
    AND "location_timezone" IS NOT NULL
    AND "location_type" IN ('port', 'terminal', 'rail_yard', 'warehouse', 'depot', 'in_transit')
    AND length("location_timezone") BETWEEN 1 AND 100
    AND ("unlocode" IS NULL OR "unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$')
    AND ("location_id" IS NULL OR length("location_id") BETWEEN 1 AND 100)
    AND ("segment_id" IS NULL OR length("segment_id") BETWEEN 1 AND 100)
    AND ("port_call_id" IS NULL OR length("port_call_id") BETWEEN 1 AND 200)
  )
);

ALTER TABLE "canonical_event"
ADD CONSTRAINT "canonical_event_location_context_check"
CHECK (
  (
    "location_type" IS NULL
    AND "unlocode" IS NULL
    AND "location_id" IS NULL
    AND "segment_id" IS NULL
    AND "port_call_id" IS NULL
    AND "location_timezone" IS NULL
  )
  OR (
    "location_type" IS NOT NULL
    AND "location_timezone" IS NOT NULL
    AND "location_type" IN ('port', 'terminal', 'rail_yard', 'warehouse', 'depot', 'in_transit')
    AND length("location_timezone") BETWEEN 1 AND 100
    AND ("unlocode" IS NULL OR "unlocode" ~ '^[A-Z]{2}[A-Z0-9]{3}$')
    AND ("location_id" IS NULL OR length("location_id") BETWEEN 1 AND 100)
    AND ("segment_id" IS NULL OR length("segment_id") BETWEEN 1 AND 100)
    AND ("port_call_id" IS NULL OR length("port_call_id") BETWEEN 1 AND 200)
  )
);

CREATE INDEX "lifecycle_date_fact_segment_slot_idx"
ON "lifecycle_date_fact"(
  "container_id", "node_code", "event_code", "time_kind", "segment_id", "is_current"
);

-- Verification: both tables expose the six location columns, enforce all-or-nothing
-- location shape, and preserve segment-aware current slots.
-- Recovery: application rollback may leave nullable columns unread; dropping them loses
-- arrival location and segment audit context.
