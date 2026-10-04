import type {
  ApplySelectionReturnInput,
  TakeBackSelectionReturnInput,
} from "./domain/market-signal.repository";
import type { ApplySelectionReturnService } from "./application/apply-selection-return.service";

export const APPLY_SELECTION_RETURN = Symbol.for("logix.ApplySelectionReturn");

export type ApplySelectionReturnPort = Pick<
  ApplySelectionReturnService,
  "executeInTransaction" | "takeBackInTransaction"
>;

export type { ApplySelectionReturnInput, TakeBackSelectionReturnInput };
