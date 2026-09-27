import { HttpException, HttpStatus } from "@nestjs/common";
import {
  ProductInitiativeConflictError,
  ProductInitiativeNotFoundError,
  ProductInitiativeValidationError,
} from "../domain/product-initiative";
import {
  ProductInitiativeClaimConflictError,
  ProductInitiativeClaimValidationError,
} from "../domain/product-initiative-claim";

export function throwProductInitiativeHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (
    error instanceof ProductInitiativeValidationError ||
    error instanceof ProductInitiativeClaimValidationError
  ) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (error instanceof ProductInitiativeNotFoundError) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (
    error instanceof ProductInitiativeConflictError ||
    error instanceof ProductInitiativeClaimConflictError
  ) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
