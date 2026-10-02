import {
  AUTH_CALLBACK_PATH,
  AUTH_LOGOUT_CALLBACK_PATH,
  AUTH_SILENT_CALLBACK_PATH,
} from "./config";

export const DEFAULT_RETURN_URL = "/";

const PROTOCOL_PATHS = new Set([
  AUTH_CALLBACK_PATH,
  AUTH_LOGOUT_CALLBACK_PATH,
  AUTH_SILENT_CALLBACK_PATH,
]);

/**
 * 只接受本应用内的相对路径；外站、协议相对、反斜杠变体和认证协议路径一律回落首页，
 * 既防开放重定向，也防止登录成功后又回到回调页形成递归。
 */
export function safeReturnUrl(raw: unknown, origin: string): string {
  if (typeof raw !== "string") return DEFAULT_RETURN_URL;
  const candidate = raw.trim();
  if (!candidate.startsWith("/") || /^\/[/\\]/.test(candidate)) {
    return DEFAULT_RETURN_URL;
  }
  if (
    candidate.includes("\\") ||
    [...candidate].some((char) => char.charCodeAt(0) < 0x20)
  ) {
    return DEFAULT_RETURN_URL;
  }
  let url: URL;
  try {
    url = new URL(candidate, origin);
  } catch {
    return DEFAULT_RETURN_URL;
  }
  if (url.origin !== origin) return DEFAULT_RETURN_URL;
  if (PROTOCOL_PATHS.has(url.pathname)) return DEFAULT_RETURN_URL;
  return `${url.pathname}${url.search}${url.hash}`;
}
