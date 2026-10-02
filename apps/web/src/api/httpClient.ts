import {
  getAuthSession,
  SessionUnavailableError,
  type RequestCredentials,
} from "../auth/session";
import { formatHttpError } from "./httpError";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** 业务失败时面向用户的兜底文案；HTTP 状态与服务端明细由 {@link formatHttpError} 拼接。 */
  fallback: string;
  /** 非身份类附加头；身份头只由会话决定，调用方传入即视为编程错误。 */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiRequestOptions {
  method?: HttpMethod;
  /** 原样发送的请求体（已序列化 JSON、FormData 等）；普通 JSON 调用用 {@link requestJson}。 */
  body?: BodyInit;
  /** 401 会话失效时面向用户的兜底文案。 */
  fallback: string;
  /** 非身份类附加头；身份头只由会话决定，调用方传入即视为编程错误。 */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type HttpRequestErrorKind =
  "unauthorized" | "forbidden" | "http" | "network";

export class HttpRequestError extends Error {
  readonly kind: HttpRequestErrorKind;
  readonly status: number;
  readonly traceId: string | null;
  readonly cause: unknown;

  constructor(input: {
    kind: HttpRequestErrorKind;
    status: number;
    message: string;
    traceId?: string | null;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "HttpRequestError";
    this.kind = input.kind;
    this.status = input.status;
    this.traceId = input.traceId ?? null;
    this.cause = input.cause;
  }
}

const PROTECTED_HEADERS = new Set([
  "authorization",
  "x-tenant-id",
  "x-operator-id",
  "x-roles",
]);

const API_PREFIX = "/api/";

export async function requestJson<T = unknown>(
  url: string,
  options: RequestOptions,
): Promise<T> {
  const hasBody = options.body !== undefined;
  const response = await requestApi(url, {
    method: options.method,
    fallback: options.fallback,
    headers: hasBody
      ? { ...options.headers, "Content-Type": "application/json" }
      : options.headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  if (!response.ok) {
    const body = await response.text();
    // 403 是服务端授权拒绝，保留原因与 traceId，不触发重新登录。
    const kind = response.status === 403 ? "forbidden" : "http";
    throw httpError(kind, response.status, body, options.fallback);
  }
  return (await response.json()) as T;
}

/**
 * 所有 `/api` 请求的唯一出口：负责边界校验、身份注入与 401 会话恢复。
 * 非 401 响应原样返回，由调用方保留各自的 404/null、下载与错误文案语义。
 */
export async function requestApi(
  url: string,
  options: ApiRequestOptions,
): Promise<Response> {
  // 先校验目标与附加头，再取身份：越界请求不得触达会话，更不能带出 Token。
  const target = resolveApiUrl(url);
  const extraHeaders = guardHeaders(options.headers);
  const session = getAuthSession();
  let credentials: RequestCredentials;
  try {
    credentials = await session.credentials();
  } catch (error) {
    if (!(error instanceof SessionUnavailableError)) throw error;
    await session.handleUnauthorized(currentLocation());
    throw new HttpRequestError({
      kind: "unauthorized",
      status: 401,
      message: formatHttpError(401, "", options.fallback),
      cause: error,
    });
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method: options.method ?? "GET",
      // 重定向可能把身份材料带出 /api 边界，一律按失败处理。
      redirect: "error",
      headers: { ...extraHeaders, ...identityHeaders(credentials) },
      ...(options.body === undefined ? {} : { body: options.body }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    // 调用方主动取消不是网络故障，原样交回由其按 signal 判断。
    if (options.signal?.aborted) throw error;
    throw new HttpRequestError({
      kind: "network",
      status: 0,
      message: error instanceof Error ? error.message : String(error),
      cause: error,
    });
  }

  if (response.status === 401) {
    const body = await response.text();
    await session.handleUnauthorized(currentLocation());
    throw httpError("unauthorized", response.status, body, options.fallback);
  }
  if (credentials.mode === "oidc") session.confirmAuthorized();
  return response;
}

/**
 * 只放行本应用同源 `/api/` 下的相对路径，返回归一化后的 path + query。
 * 外站、协议相对、反斜杠、控制字符、凭据，以及（含编码形式的）点段越界一律视为编程错误。
 */
export function resolveApiUrl(raw: string): string {
  const reject = (): never => {
    throw new Error(`API_URL_REJECTED: ${JSON.stringify(raw)}`);
  };
  if (typeof raw !== "string" || !raw.startsWith(API_PREFIX)) reject();
  if (
    raw.includes("\\") ||
    [...raw].some((char) => {
      const code = char.charCodeAt(0);
      return code < 0x20 || code === 0x7f;
    })
  ) {
    reject();
  }
  const origin = window.location.origin;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return reject();
  }
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    !url.pathname.startsWith(API_PREFIX)
  ) {
    reject();
  }
  // 归一化前后都检查：原始点段即使会被浏览器折叠回边界内，也说明调用方拼接出错。
  const rawPath = raw.split(/[?#]/, 1)[0];
  for (const segment of [...rawPath.split("/"), ...url.pathname.split("/")]) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return reject();
    }
    if (/(^|[/\\])\.\.?([/\\]|$)/.test(decoded)) reject();
  }
  return `${url.pathname}${url.search}`;
}

function identityHeaders(
  credentials: RequestCredentials,
): Record<string, string> {
  if (credentials.mode === "oidc") {
    return { Authorization: `Bearer ${credentials.accessToken}` };
  }
  return {
    "X-Tenant-Id": credentials.tenantId,
    "X-Operator-Id": credentials.operatorId,
    "X-Roles": credentials.roles.join(","),
  };
}

function guardHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  if (!headers) return {};
  for (const name of Object.keys(headers)) {
    if (PROTECTED_HEADERS.has(name.toLowerCase())) {
      throw new Error(`PROTECTED_HEADER_OVERRIDE: ${name}`);
    }
  }
  return headers;
}

function httpError(
  kind: HttpRequestErrorKind,
  status: number,
  body: string,
  fallback: string,
): HttpRequestError {
  return new HttpRequestError({
    kind,
    status,
    message: formatHttpError(status, body, fallback),
    traceId: readTraceId(body),
  });
}

function readTraceId(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { traceId?: unknown };
    return typeof parsed.traceId === "string" ? parsed.traceId : null;
  } catch {
    return null;
  }
}

function currentLocation(): string {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}
