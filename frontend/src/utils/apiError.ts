import { AxiosError } from "axios";

/**
 * Axios / fetch 失敗時にユーザー向けメッセージを組み立てる（FastAPI の detail など）
 */
export function getApiErrorMessage(
  error: unknown,
  fallbackEn: string,
  fallbackJa: string
): string {
  const ax = error as AxiosError<{ detail?: unknown }>;
  const status = ax.response?.status;
  const detail = ax.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item: { msg?: string }) => item?.msg)
      .filter(Boolean) as string[];
    if (parts.length) return parts.join("\n");
  }

  if (status === 404) {
    return `${fallbackJa}（404） / ${fallbackEn} (404)`;
  }
  if (status === 403) {
    return "アクセスが拒否されました（403） / Access denied (403)";
  }
  if (status === 500 || status === 502 || status === 503) {
    return "サーバーでエラーが発生しました。しばらくしてから再度お試しください。 / Server error. Please try again later.";
  }

  const msg = ax.message?.trim();
  if (msg) return msg;

  return `${fallbackJa} / ${fallbackEn}`;
}
