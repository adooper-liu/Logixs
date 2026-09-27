import { HttpException, HttpStatus } from "@nestjs/common";
import {
  ProductOpportunityConflictError,
  ProductOpportunityNotFoundError,
  ProductOpportunityValidationError,
} from "../domain/product-opportunity";

export function throwProductOpportunityHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof ProductOpportunityValidationError) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (error instanceof ProductOpportunityNotFoundError) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (error instanceof ProductOpportunityConflictError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
