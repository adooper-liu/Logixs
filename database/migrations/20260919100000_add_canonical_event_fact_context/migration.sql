-- State-changing canonical events must retain the accepted professional fact and policy snapshot.
-- Columns stay nullable only for canonical events created before this invariant was introduced.
ALTER TABLE "canonical_event"
ADD COLUMN "domain_fact_id" TEXT,
ADD COLUMN "node_code" TEXT,
ADD COLUMN "time_kind" TEXT,
ADD COLUMN "authority_policy_ref" TEXT;

CREATE UNIQUE INDEX "canonical_event_domain_fact_key"
ON "canonical_event"("domain_fact_id");

ALTER TABLE "canonical_event"
ADD CONSTRAINT "canonical_event_fact_context_check"
CHECK (
  (
    "domain_fact_id" IS NULL
    AND "node_code" IS NULL
    AND "time_kind" IS NULL
    AND "authority_policy_ref" IS NULL
  )
  OR (
    "domain_fact_id" IS NOT NULL
    AND "node_code" IS NOT NULL
    AND "time_kind" IS NOT NULL
    AND "authority_policy_ref" IS NOT NULL
    AND
    length("domain_fact_id") BETWEEN 1 AND 100
    AND length("node_code") BETWEEN 1 AND 100
    AND "time_kind" = 'actual'
    AND length("authority_policy_ref") BETWEEN 1 AND 200
  )
);

ALTER TABLE "canonical_event"
ADD CONSTRAINT "canonical_event_domain_fact_id_fkey"
FOREIGN KEY ("domain_fact_id") REFERENCES "lifecycle_date_fact"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Verification: new state events persist all four context fields together, reference an existing fact, and one fact maps to one event.
-- Recovery: retain nullable columns on application rollback; dropping them loses accepted-policy traceability.
