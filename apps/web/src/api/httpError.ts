export function parseHttpErrorDetail(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  try {
    const body = JSON.parse(trimmed) as {
      message?: unknown;
      error?: unknown;
    };
    const raw = body.message ?? body.error;
    if (Array.isArray(raw)) {
      return raw.map(String).filter(Boolean).join("；");
    }
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  } catch {
    // 非 JSON 原文保留。
  }
  return trimmed;
}

export function formatHttpError(
  status: number,
  body: string,
  fallback: string,
): string {
  const detail = parseHttpErrorDetail(body.slice(0, 500));
  return detail
    ? `${fallback}（${status}）：${detail}`
    : `${fallback}（${status}）`;
}
