type ShowFn = (message: string) => void;

let listener: ShowFn | null = null;

/** ルートのモーダルがマウント時に登録する */
export function setGlobalApiErrorListener(fn: ShowFn | null) {
  listener = fn;
}

/** axios インターセプターから呼ぶ（未登録時はコンソールのみ） */
export function emitGlobalApiError(message: string) {
  if (listener) {
    listener(message);
  } else {
    console.warn("[GlobalApiError]", message);
  }
}
