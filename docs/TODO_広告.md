# 広告の入れ方・TODO

## 現状の構成（要約）

| プラットフォーム | 仕組み | 主なファイル |
|------------------|--------|----------------|
| **Web** | Google AdSense（`adsbygoogle.js` + `<ins class="adsbygoogle">`） | `WebThirdPartyScripts.tsx`（開発時の script 挿入）、`AdBanner.web.tsx`、ビルド後 `scripts/inject-adsense.js`、`public/ads.txt` |
| **iOS / Android** | Google Mobile Ads（AdMob）バナー | `react-native-google-mobile-ads`、`AdBanner.native.tsx`、`app.config.js` のプラグイン設定 |
| **共通** | `user.is_premium === true` のとき **バナー・インタースティシャル風モーダルは出さない** | `AuthContext` の `user` |

### スクリプト・認証（Web）

- 開発（`expo start --web`）: `_layout` 経由の `WebThirdPartyScripts` が head に AdSense / gtag を挿入。
- 本番静的書き出し: `npm run build:web` が `inject-adsense.js` で `dist/*.html` の `<head>` に meta + script を注入（重複はスキップ）。
- `https://<ドメイン>/ads.txt` は `public/ads.txt` → `dist/ads.txt` で配信。詳細は `frontend/ADSENSE.md`。

### バナー配置（画面）

`AdBanner` を置いている例:

- `app/(app)/dashboard.tsx`
- `app/(app)/ai-dashboard.tsx`
- `app/(app)/store.tsx`
- `app/(app)/learning-plan.tsx`
- `app/(app)/study-records.tsx`
- `app/(app)/my-question-sets/index.tsx`
- `app/(app)/quiz/result.tsx`

### クイズ中の「インタースティシャル風」

- `QuizEngine.tsx`: 解答済み数が **20問ごと**（`AD_INTERVAL`）、かつ **最終問の手前まで** の「次へ」で `InterstitialAdModal` を表示。
- モーダル内は `AdBanner`（Web なら AdSense、ネイティブなら AdMob バナー）。プレミアムは即 `onClose`。

### 環境変数（参照）

| 変数 | 用途 |
|------|------|
| `EXPO_PUBLIC_AD_UNIT_ANDROID` / `EXPO_PUBLIC_AD_UNIT_IOS` | ネイティブバナー unit ID（未設定時は Google のテスト ID） |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` / `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | AdMob アプリ ID（未設定時はテスト用） |
| `EXPO_PUBLIC_AD_SLOT_WEB` | Web の AdSense **広告ユニット（スロット）**（未設定時はプレースホルダ） |

`.env.example` に広告用の行が無い場合は、本番前に追記・ドキュメント整合を TODO で扱う。

---

## TODO（運用・本番前）

### 必須

- [ ] **AdSense（Web）**: 本番用の **広告ユニット（`data-ad-slot`）** を AdSense で作成し、`EXPO_PUBLIC_AD_SLOT_WEB` に設定（現状デフォルト `1234567890` は本番では無効想定）。
- [ ] **ads.txt**: 本番ドメインで `https://<ドメイン>/ads.txt` が配信され、AdSense コンソールと一致しているか確認。
- [ ] **AdMob（ネイティブ）**: 本番用 **アプリ ID**・**バナー unit ID** を `app.config.js` 用 env に設定し、開発ビルドではテスト IDのままにする運用を決める。
- [ ] **プレミアム連携**: ログイン後 `is_premium` が API で正しく返ることを確認し、有料ユーザーに広告が出ないことを実機・Web で確認。

### 任意・改善

- [ ] `frontend/.env.example` に上記 `EXPO_PUBLIC_*` 広告変数の説明を追記（有料プラン TODO と同様の運用品質）。
- [ ] AdSense / AdMob のポリシー（クリック誘導・誤タップ・コンテンツ要件）に沿った配置・ラベル（「広告」表記は `InterstitialAdModal` にあり）の最終レビュー。
- [ ] 本番のみ広告を有効化するフラグ（開発で常に非表示など）が必要なら設計・実装。
- [ ] ネイティブで **本物のインタースティシャル広告** に差し替えるかは別タスク（現状はモーダル + バナー）。

## 参照パス

- `frontend/src/components/AdBanner.web.tsx` / `AdBanner.native.tsx`
- `frontend/src/components/WebThirdPartyScripts.tsx`
- `frontend/src/components/InterstitialAdModal.tsx`
- `frontend/src/components/QuizEngine.tsx`（`AD_INTERVAL`）
- `frontend/scripts/inject-adsense.js`、`frontend/ADSENSE.md`
- `frontend/app.config.js`（`react-native-google-mobile-ads` プラグイン）
