import { HttpException, HttpStatus } from "@nestjs/common";
import {
  WorkHandoffConflictError,
  WorkHandoffValidationError,
} from "../domain/shipment-work-handoff";
import { WorkHandoffNotFoundError } from "../infrastructure/prisma-shipment-work-handoff.repository";

export { WorkHandoffNotFoundError };

export function throwWorkHandoffHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof WorkHandoffValidationError) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (error instanceof WorkHandoffNotFoundError) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (error instanceof WorkHandoffConflictError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
