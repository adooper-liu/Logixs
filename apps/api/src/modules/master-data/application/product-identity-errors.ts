import { HttpException, HttpStatus } from "@nestjs/common";
import {
  ProductIdentityConflictError,
  ProductIdentityValidationError,
} from "../domain/product-identity";
import { ProductIdentityNotFoundError } from "../infrastructure/prisma-product-identity.repository";

/** 发布快照不存在（或不属于本租户）。与"产品定义不存在"分开，是为了让人知道该看哪一处。 */
export class ProductIdentityReleaseMissingError extends Error {}

export function throwProductIdentityHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof ProductIdentityValidationError) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (
    error instanceof ProductIdentityNotFoundError ||
    error instanceof ProductIdentityReleaseMissingError
  ) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (error instanceof ProductIdentityConflictError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
