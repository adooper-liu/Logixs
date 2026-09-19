import type { IngestTrackingEyesEventService } from "./application/ingest-trackingeyes-event.service";

export const INGEST_TRACKINGEYES_EVENT = Symbol.for(
  "logix.IngestTrackingEyesEvent",
);

export type IngestTrackingEyesEventPort = Pick<
  IngestTrackingEyesEventService,
  "execute"
>;
