ALTER TABLE "container_dispatch_snapshot"
ADD CONSTRAINT "container_dispatch_snapshot_state_time_check"
CHECK (("state" = 'active' AND "superseded_at" IS NULL) OR ("state" = 'superseded' AND "superseded_at" IS NOT NULL)),
ADD CONSTRAINT "container_dispatch_snapshot_booking_check"
CHECK (length("booking_number") BETWEEN 1 AND 100 AND "booking_number" = btrim("booking_number")),
ADD CONSTRAINT "container_dispatch_snapshot_carrier_check"
CHECK (length("carrier_code") BETWEEN 1 AND 32 AND "carrier_code" = btrim("carrier_code") AND "carrier_code" = upper("carrier_code")),
ADD CONSTRAINT "container_dispatch_snapshot_vessel_check"
CHECK (length("vessel_name") BETWEEN 1 AND 128 AND "vessel_name" = btrim("vessel_name")),
ADD CONSTRAINT "container_dispatch_snapshot_voyage_check"
CHECK (length("voyage_number") BETWEEN 1 AND 64 AND "voyage_number" = btrim("voyage_number")),
ADD CONSTRAINT "container_dispatch_snapshot_master_bill_check"
CHECK ("master_bill_number" IS NULL OR (length("master_bill_number") BETWEEN 1 AND 100 AND "master_bill_number" = btrim("master_bill_number"))),
ADD CONSTRAINT "container_dispatch_snapshot_house_bill_check"
CHECK ("house_bill_number" IS NULL OR (length("house_bill_number") BETWEEN 1 AND 100 AND "house_bill_number" = btrim("house_bill_number"))),
ADD CONSTRAINT "container_dispatch_snapshot_ingestion_check"
CHECK ("ingestion_channel" IN ('api', 'webhook', 'file_import', 'manual_ui')),
ADD CONSTRAINT "container_dispatch_snapshot_source_check"
CHECK (length("source_system") BETWEEN 1 AND 128 AND "source_system" = btrim("source_system")),
ADD CONSTRAINT "container_dispatch_snapshot_actor_check"
CHECK (length("actor_id") BETWEEN 1 AND 128 AND "actor_id" = btrim("actor_id")),
ADD CONSTRAINT "container_dispatch_snapshot_reason_check"
CHECK (length("reason_code") BETWEEN 1 AND 100 AND "reason_code" = btrim("reason_code")),
ADD CONSTRAINT "container_dispatch_snapshot_idempotency_check"
CHECK (length("idempotency_key") BETWEEN 1 AND 200 AND "idempotency_key" = btrim("idempotency_key")),
ADD CONSTRAINT "container_dispatch_snapshot_payload_hash_check"
CHECK ("payload_hash" ~ '^[0-9a-f]{64}$');
