import { HttpException, HttpStatus } from "@nestjs/common";
import {
  ProductInitiativeConflictError,
  ProductInitiativeNotFoundError,
  ProductInitiativeValidationError,
} from "../domain/product-initiative";

export function throwProductInitiativeHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof ProductInitiativeValidationError) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (error instanceof ProductInitiativeNotFoundError) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (error instanceof ProductInitiativeConflictError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
