import type {
  CustomsClearanceCaseRecord,
  ReplaceCustomsClearanceCaseCommand,
} from "./domain/customs-clearance-case";

export const REPLACE_CUSTOMS_CLEARANCE_CASE = Symbol.for(
  "logix.ReplaceCustomsClearanceCase",
);

export interface ReplaceCustomsClearanceCasePort {
  execute(
    command: ReplaceCustomsClearanceCaseCommand,
  ): Promise<CustomsClearanceCaseRecord>;
}

export type { ReplaceCustomsClearanceCaseCommand };
