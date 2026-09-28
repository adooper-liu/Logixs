import { HttpException, HttpStatus } from "@nestjs/common";
import {
  SourcingConflictError,
  SourcingValidationError,
} from "../domain/supplier-nomination";
import { SourcingNotFoundError } from "../infrastructure/prisma-supplier-nomination.repository";

export { SourcingNotFoundError };

export function throwSourcingHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof SourcingValidationError) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (error instanceof SourcingNotFoundError) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (error instanceof SourcingConflictError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
