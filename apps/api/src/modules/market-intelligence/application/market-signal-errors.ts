import { HttpException, HttpStatus } from "@nestjs/common";
import {
  MarketSignalConflictError,
  MarketSignalNotFoundError,
  MarketSignalValidationError,
} from "../domain/market-signal";

export function throwMarketSignalHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof MarketSignalValidationError) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (error instanceof MarketSignalNotFoundError) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (error instanceof MarketSignalConflictError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
