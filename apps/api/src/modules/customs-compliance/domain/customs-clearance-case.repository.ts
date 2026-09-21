import type {
  CustomsClearanceCaseRecord,
  NormalizedCustomsClearanceCaseCommand,
} from "./customs-clearance-case";

export const CUSTOMS_CLEARANCE_CASE_REPOSITORY = Symbol.for(
  "logix.CustomsClearanceCaseRepository",
);

export interface CustomsClearanceCaseRepository {
  findCurrent(input: {
    tenantId: string;
    containerRecordId: string;
  }): Promise<CustomsClearanceCaseRecord | null>;
  replace(
    command: NormalizedCustomsClearanceCaseCommand,
  ): Promise<CustomsClearanceCaseRecord>;
}
