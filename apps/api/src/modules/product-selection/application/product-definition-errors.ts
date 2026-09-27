import { HttpException, HttpStatus } from "@nestjs/common";
import {
  ProductDefinitionConflictError,
  ProductDefinitionValidationError,
} from "../domain/product-definition";

/**
 * 「还没人接 / 接的人不是你」这两种拒绝与"格式不对"不是一回事：
 * 前者是业务门槛，调用方该刷新看最新状态；后者是请求写错了。
 * 分开建类，才能映射到不同的 HTTP 语义。
 */
export class ProductDefinitionNotClaimedError extends Error {}
export class ProductDefinitionNotFoundError extends Error {}

export function throwProductDefinitionHttpError(error: unknown): never {
  if (error instanceof HttpException) throw error;
  if (error instanceof ProductDefinitionValidationError) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
  if (error instanceof ProductDefinitionNotFoundError) {
    throw new HttpException(error.message, HttpStatus.NOT_FOUND);
  }
  if (error instanceof ProductDefinitionNotClaimedError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  if (error instanceof ProductDefinitionConflictError) {
    throw new HttpException(error.message, HttpStatus.CONFLICT);
  }
  throw error;
}
