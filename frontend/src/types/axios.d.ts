import "axios";

declare module "axios" {
  interface AxiosRequestConfig {
    /** true のとき apiClient がグローバルエラーモーダルを出さない（画面側で表示する場合） */
    skipGlobalErrorModal?: boolean;
  }
}
