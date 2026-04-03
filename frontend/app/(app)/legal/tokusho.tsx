import { Redirect } from "expo-router";

/** 旧パス互換: 特定商取引法表記は公開ルートへ統一 */
export default function LegacyTokushoRedirect() {
  return <Redirect href="/(public)/tokusho" />;
}
