import { HttpException, HttpStatus } from "@nestjs/common";
import {
  ProductInitiativeConflictError,
  ProductInitiativeNotFoundError,
  ProductInitiativeValidationError,
} from "../domain/product-initiative";
import {
  ProductInitiativeDraftConflictError,
  ProductInitiativeDraftValidationError,
} from "../domain/product-initiative-draft";
import {
  ProductInitiativeClaimConflictError,
  ProductInitiativeClaimValidationError,
} from "../domain/product-initiative-claim";
import { ProductInitiativeUnitEconomicsValidationError } from "../domain/unit-economics";

export function throwProductInitiativeHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (
    error instanceof ProductInitiativeValidationError ||
    error instanceof ProductInitiativeClaimValidationError ||
    error instanceof ProductInitiativeDraftValidationError ||
    error instanceof ProductInitiativeUnitEconomicsValidationError
  ) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (error instanceof ProductInitiativeNotFoundError) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (
    error instanceof ProductInitiativeConflictError ||
    error instanceof ProductInitiativeClaimConflictError ||
    error instanceof ProductInitiativeDraftConflictError
  ) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
