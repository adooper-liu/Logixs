import { HttpException, HttpStatus } from "@nestjs/common";
import { WorkSessionConflictError } from "../domain/work-session";

export function throwWorkSessionHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof WorkSessionConflictError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
