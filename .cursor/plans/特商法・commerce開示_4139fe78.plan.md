---
name: 特商法・Commerce開示
overview: 既存の特定商取引法表記ページを、StripeのCommerce Disclosureで推奨される透明性（事業者・連絡先・支払・返品）に沿って項目補完し、本番で差し替え可能な環境変数ベースの事業者情報表示に整えます。必要なら公開ルートへ移しダッシュボード用の固定URLにもしやすくします。
todos:
  - id: env-tokusho-fields
    content: "`tokusho` 用 `EXPO_PUBLIC_TOKUSHO_*` を定義し、`process.env` から事業者行を組み立て（未設定はプレースホルダー／メールは規約とフォールバック整合）"
    status: completed
  - id: tokusho-items-stripe-align
    content: "`TOKUSHO_ITEMS` に「代金以外の費用」等を追加し、プラットフォーム/販売者の説明を Commerce Disclosure 的に1段明確化"
    status: completed
  - id: public-route-redirect
    content: "`(public)/tokusho.tsx` へ移設、`(app)/legal/tokusho` はリダイレクト、`_layout`・購入/販売者リンクを更新"
    status: completed
  - id: optional-sitemap
    content: 必要なら `sitemap.xml` に `/tokusho` を追加
    status: completed
isProject: false
---

# 特定商取引法表記ページの完成（Stripe Commerce Disclosure 考え方の反映）

## 現状

- 表記ページは **既に実装済み**: `[frontend/app/(app)/legal/tokusho.tsx](frontend/app/(app)`/legal/tokusho.tsx)
- 購入画面・販売者ダッシュボードから `/(app)/legal/tokusho` へリンク済み（`[frontend/app/(app)/question-sets/[id].tsx](frontend/app/(app)`/question-sets/[id].tsx)、`[frontend/app/(app)/seller-dashboard.tsx](frontend/app/(app)`/seller-dashboard.tsx)）
- **未対応**: 販売業者・所在地・電話・運営責任者・メールがプレースホルダー。特商法でよく求められる **「商品代金以外に必要となる費用」** などの行がない
- 利用規約・プライバシーは `[frontend/app/(public)/](frontend/app/(public)`/) 配下で、連絡先に `support@ai-practice-book.com` が使われている（`[frontend/app/(public)/terms-of-service.tsx](frontend/app/(public)`/terms-of-service.tsx) 等）。表記ページのメールと整合できる

参考にした Stripe の記事は、取引時に事業者情報・返金・連絡手段を顧客が確実に見られるようにする、という趣旨です（[Commerce Disclosure の作成と表示](https://support.stripe.com/questions/how-to-create-and-display-a-commerce-disclosure-page)）。日本の **特定商取引法に基づく表記** と目的が一致するため、**新規に別ページを増やす必要はなく**、既存 `tokusho.tsx` を「完成形」に近づけるのが適切です。

## 実装方針

### 1. 表示項目の追加・文言の整備

`TOKUSHO_ITEMS` に次を追加（文言はデジタル販売・マーケットプレイス前提で調整）:

- **商品代金以外に必要となる費用**（例: インターネット接続料・通信料は利用者負担、本アプリの閲覧に別途アプリストア規約に基づく利用料がかかる場合がある、等）
- 必要に応じて **表現の補足**（プラットフォーム運営者と各問題集の販売者の関係は、既存の黄枠_notice_を活かしつつ、Stripe側が重視する「誰が課金・サポートの窓口か」を1文で明確化）

法令上の最終責任は事業者実態に依存するため、**本文は弁護士・税理士確認を前提**に、コード上は中立な定型文に留める。

### 2. 事業者情報をコードに直書きせず環境変数化

プレースホルダーを置換するのではなく、例として次の `**EXPO_PUBLIC_**` 変数から読み込み、**未設定時は既存と同様のプレースホルダー**を表示する方式にする（リポジトリに実名・住所をコミットしない）:

- `EXPO_PUBLIC_TOKUSHO_SELLER_NAME`（販売業者／屋号・法人名）
- `EXPO_PUBLIC_TOKUSHO_OPERATOR_NAME`（運営責任者）
- `EXPO_PUBLIC_TOKUSHO_ADDRESS`
- `EXPO_PUBLIC_TOKUSHO_PHONE`
- `EXPO_PUBLIC_TOKUSHO_EMAIL`（未設定時は `support@ai-practice-book.com` にフォールバックして規約類と揃える、等）

`[frontend/.env](frontend/.env)` にはキー例とコメントのみ追加し、実値は本番の `[frontend/.env.production](frontend/.env.production)` またはホストのシークレットで設定する運用を README に書く必要はない（ユーザーがドキュメントを求めた場合のみ）。

### 3. （推奨）公開ルートへの移動とリンク更新

利用規約・プライバシーと同じく `**(public)` グループ** に `tokusho.tsx` を置くと:

- 未ログインでも閲覧しやすい
- Stripe ダッシュボード等に **固定URL**（例: `https://ai-practice-book.com/tokusho`）を登録しやすい

手順案:

- 新規: `[frontend/app/(public)/tokusho.tsx](frontend/app/(public)`/tokusho.tsx) に内容を移す（スタイルは既存を踏襲し、`privacy-policy` と同様に `useLanguage` で英語併記も可能だが、**特商法は日本向け表記が主**のため、第1版は日本語のみまたは最小限の英語見出しのみに留める判断も可）
- 旧 `[frontend/app/(app)/legal/tokusho.tsx](frontend/app/(app)`/legal/tokusho.tsx) は `**router.replace` で新URLへリダイレクト**する薄いラッパーにして既存ディープリンクを壊さない
- `[frontend/app/_layout.tsx](frontend/app/_layout.tsx)` に `Stack.Screen name="(public)/tokusho"` を追加（他の public 画面と同様）
- すべての `router.push('/(app)/legal/tokusho')` を `/(public)/tokusho`（または実際の path）に更新

### 4. 任意: Web SEO

`[frontend/public/sitemap.xml](frontend/public/sitemap.xml)` に `/tokusho` を追加すると、開示ページの発見性が上がる（必須ではない）。

## ユーザー側作業（コード外）

- 本番の **正式な事業者名・住所・電話・運営責任者** を決め、環境変数に設定
- 表示内容の **法的妥当性** は専門家に確認

## 変更予定ファイル（まとめ）


| ファイル                                                                                                                                                                           | 内容                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `[frontend/app/(app)/legal/tokusho.tsx](frontend/app/(app)`/legal/tokusho.tsx)                                                                                                 | リダイレクト用に縮小、または削除してリンク先のみ変更        |
| 新規 `[frontend/app/(public)/tokusho.tsx](frontend/app/(public)`/tokusho.tsx)                                                                                                    | 項目追加・`process.env` 読み取り           |
| `[frontend/app/(app)/question-sets/[id].tsx](frontend/app/(app)`/question-sets/[id].tsx), `[frontend/app/(app)/seller-dashboard.tsx](frontend/app/(app)`/seller-dashboard.tsx) | `push` 先の更新                       |
| `[frontend/app/_layout.tsx](frontend/app/_layout.tsx)`                                                                                                                         | `Stack.Screen` 追加                 |
| `[frontend/.env](frontend/.env)`                                                                                                                                               | `EXPO_PUBLIC_TOKUSHO_*` のコメントつき雛形 |


