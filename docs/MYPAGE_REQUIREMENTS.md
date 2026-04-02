# マイページ要件定義書

## 1. 概要

### 1.1 目的

ユーザーが自身のアカウント情報、学習進捗、設定などを一元的に管理・確認できるマイページを提供する。

### 1.2 対象ユーザー

- 一般ユーザー（user）
- 販売者（seller）
- プレミアムユーザー（is_premium = true）

### 1.3 関連画面

- ログイン画面
- 設定画面（`/app/settings`）
- 統計画面（`/app/stats`）
- プレミアムアップグレード画面（`/app/premium-upgrade`）
- 販売者ダッシュボード（`/app/seller-dashboard`）

## 2. 機能要件

### 2.1 基本情報セクション

#### 2.1.1 表示項目

- **ユーザー名（username）**

  - 表示形式: テキスト表示
  - 編集: 可能（インライン編集またはモーダル編集）
  - バリデーション: 1 文字以上、50 文字以下、重複チェック

- **メールアドレス（email）**

  - 表示形式: テキスト表示
  - 編集: 可能（メール変更時は確認メール送信）
  - バリデーション: メール形式、重複チェック

- **アカウント作成日（created_at）**

  - 表示形式: 日付形式（例: 2024 年 1 月 1 日）
  - 編集: 不可（読み取り専用）

- **最終更新日（updated_at）**
  - 表示形式: 日付形式（例: 2024 年 1 月 1 日 12:00）
  - 編集: 不可（読み取り専用）

#### 2.1.2 アクション

- ユーザー名編集
- メールアドレス変更（確認メール送信）
- パスワード変更（別画面へのリンク）

### 2.2 アカウントステータスセクション

#### 2.2.1 表示項目

- **アカウント状態**

  - 表示: バッジ形式
  - 状態: 有効 / 無効 / ロック中
  - ロック中の場合: 解除時刻を表示

- **ユーザーロール**

  - 表示: バッジ形式
  - ロール: 一般ユーザー / 販売者 / 管理者
  - 販売者の場合: 販売者ダッシュボードへのリンク表示

- **プレミアムステータス**
  - 表示: バッジ形式
  - 状態: 無料 / プレミアム
  - プレミアムの場合: 有効期限を表示
  - 無料の場合: アップグレードボタン表示

#### 2.2.2 アクション

- プレミアムアップグレード（`/app/premium-upgrade`へのリンク）
- 販売者ダッシュボードへの遷移（販売者の場合）

### 2.3 学習統計セクション

#### 2.3.1 表示項目

- **総回答数（total_answers）**

  - 表示形式: 数値 + 単位
  - 更新: リアルタイム

- **正答数（correct_answers）**

  - 表示形式: 数値 + 単位
  - 更新: リアルタイム

- **正答率（correct_rate）**

  - 表示形式: パーセンテージ + プログレスバー
  - 計算式: (correct_answers / total_answers) × 100
  - 更新: リアルタイム

- **平均回答時間（avg_time_sec）**

  - 表示形式: 秒数 → 分:秒形式に変換
  - 更新: リアルタイム

- **学習日数**
  - 表示形式: 日数
  - 計算: 初回回答日から現在までの日数

#### 2.3.2 アクション

- 詳細統計画面への遷移（`/app/stats`へのリンク）
- 統計情報のリフレッシュ

### 2.4 最近の学習履歴セクション

#### 2.4.1 表示項目

- **最近の回答（最大 10 件）**
  - 問題集名
  - 問題文（最初の 50 文字）
  - 正誤判定（○/×）
  - 回答日時
  - 回答時間

#### 2.4.2 アクション

- 詳細履歴画面への遷移（`/app/stats`へのリンク）
- 個別問題への遷移

### 2.5 作成した問題集セクション（販売者の場合）

#### 2.5.1 表示項目

- **作成した問題集一覧（最大 5 件）**
  - 問題集タイトル
  - 問題数
  - 価格
  - 販売数
  - 作成日時

#### 2.5.2 アクション

- 販売者ダッシュボードへの遷移
- 問題集詳細への遷移

### 2.6 購入した問題集セクション

#### 2.6.1 表示項目

- **購入した問題集一覧（最大 5 件）**
  - 問題集タイトル
  - 購入日時
  - 進捗状況（完了率）

#### 2.6.2 アクション

- 問題集詳細への遷移
- 全購入履歴への遷移

### 2.7 クイックアクションセクション

#### 2.7.1 アクションボタン

- **設定**

  - 遷移先: `/app/settings`
  - アイコン: 歯車アイコン

- **統計詳細**

  - 遷移先: `/app/stats`
  - アイコン: グラフアイコン

- **プレミアムアップグレード**（無料ユーザーの場合）

  - 遷移先: `/app/premium-upgrade`
  - アイコン: 星アイコン

- **販売者ダッシュボード**（販売者の場合）

  - 遷移先: `/app/seller-dashboard`
  - アイコン: 店舗アイコン

- **ログアウト**
  - アクション: ログアウト処理
  - 確認ダイアログ: 表示
  - 遷移先: `/login`

## 3. 非機能要件

### 3.1 パフォーマンス

- ページ読み込み時間: 2 秒以内
- API 呼び出し: 並列処理で最適化
- 画像読み込み: 遅延読み込み（Lazy Loading）

### 3.2 レスポンシブデザイン

- モバイル（幅 < 600px）: 1 カラムレイアウト
- タブレット（600px ≤ 幅 < 1024px）: 2 カラムレイアウト
- デスクトップ（幅 ≥ 1024px）: 3 カラムレイアウト

### 3.3 アクセシビリティ

- キーボードナビゲーション対応
- スクリーンリーダー対応
- コントラスト比: WCAG 2.1 AA 準拠

### 3.4 セキュリティ

- 認証必須（未認証ユーザーはログイン画面へリダイレクト）
- 個人情報の暗号化
- CSRF 対策
- XSS 対策

## 4. UI/UX 要件

### 4.1 レイアウト

```
┌─────────────────────────────────────┐
│ ヘッダー（ユーザー名、アバター）      │
├─────────────────────────────────────┤
│ 基本情報セクション                    │
│ - ユーザー名（編集可能）              │
│ - メールアドレス（編集可能）          │
│ - アカウント作成日                    │
├─────────────────────────────────────┤
│ アカウントステータスセクション        │
│ - アカウント状態バッジ                │
│ - ユーザーロールバッジ                │
│ - プレミアムステータスバッジ          │
├─────────────────────────────────────┤
│ 学習統計セクション                    │
│ - 総回答数、正答数、正答率            │
│ - 平均回答時間                        │
│ - 詳細統計へのリンク                  │
├─────────────────────────────────────┤
│ 最近の学習履歴セクション              │
│ - 回答履歴リスト（最大10件）          │
│ - 詳細履歴へのリンク                  │
├─────────────────────────────────────┤
│ 作成した問題集セクション（販売者のみ）│
│ - 問題集リスト（最大5件）             │
│ - 販売者ダッシュボードへのリンク      │
├─────────────────────────────────────┤
│ 購入した問題集セクション              │
│ - 問題集リスト（最大5件）             │
│ - 全購入履歴へのリンク                │
├─────────────────────────────────────┤
│ クイックアクションセクション          │
│ - 設定、統計詳細、プレミアム等        │
└─────────────────────────────────────┘
```

### 4.2 デザインガイドライン

- **カラーパレット**

  - プライマリ: #007AFF（青）
  - セカンダリ: #4CAF50（緑）
  - エラー: #F44336（赤）
  - 警告: #FF9800（オレンジ）
  - 背景: #F5F5F5（ライトグレー）
  - テキスト: #333333（ダークグレー）

- **タイポグラフィ**

  - タイトル: 24px, Bold
  - セクションタイトル: 20px, Semi-Bold
  - 本文: 16px, Regular
  - キャプション: 14px, Regular

- **スペーシング**
  - セクション間: 24px
  - 要素間: 16px
  - パディング: 20px

### 4.3 インタラクション

- **ホバー効果**: ボタンやリンクにホバー時の色変更
- **ローディング状態**: データ読み込み中はスケルトンローダー表示
- **エラー表示**: エラーメッセージを赤色で表示
- **成功表示**: 成功メッセージを緑色で表示

## 5. API 要件

### 5.1 エンドポイント一覧

#### 5.1.1 ユーザー情報取得

```
GET /api/v1/auth/me
Response: {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_premium: boolean
  premium_expires_at: string | null
  role: string
  is_seller: boolean
  created_at: string
  updated_at: string
}
```

#### 5.1.2 ユーザー名更新

```
PUT /api/v1/auth/me
Request: {
  username: string
}
Response: {
  id: string
  email: string
  full_name: string
  ...
}
```

#### 5.1.3 メールアドレス変更

```
POST /api/v1/auth/change-email
Request: {
  new_email: string
  password: string
}
Response: {
  message: string
}
```

#### 5.1.4 統計情報取得

```
GET /api/v1/answers/stats/{user_id}
Response: {
  total_answers: number
  correct_answers: number
  correct_rate: number
  avg_time_sec: number
}
```

#### 5.1.5 回答履歴取得

```
GET /api/v1/answers/history/{user_id}?limit=10&offset=0
Response: {
  answers: Array<{
    id: string
    question_id: string
    question_text: string
    question_set_title: string
    user_answer: string
    is_correct: boolean
    answer_time_sec: number
    answered_at: string
  }>
  total: number
}
```

#### 5.1.6 作成した問題集取得（販売者の場合）

```
GET /api/v1/question-sets/my?limit=5
Response: {
  question_sets: Array<{
    id: string
    title: string
    question_count: number
    price: number
    sales_count: number
    created_at: string
  }>
  total: number
}
```

#### 5.1.7 購入した問題集取得

```
GET /api/v1/purchases/my?limit=5
Response: {
  purchases: Array<{
    id: string
    question_set_id: string
    question_set_title: string
    purchased_at: string
    progress: number
  }>
  total: number
}
```

### 5.2 エラーハンドリング

- **400 Bad Request**: バリデーションエラー
- **401 Unauthorized**: 認証エラー
- **403 Forbidden**: 権限エラー
- **404 Not Found**: リソースが見つからない
- **500 Internal Server Error**: サーバーエラー

## 6. データモデル

### 6.1 ユーザー情報

```typescript
interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  role: "user" | "seller" | "admin" | "super_admin";
  is_seller: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### 6.2 統計情報

```typescript
interface UserStats {
  total_answers: number;
  correct_answers: number;
  correct_rate: number;
  avg_time_sec: number;
}
```

### 6.3 回答履歴

```typescript
interface AnswerHistory {
  id: string;
  question_id: string;
  question_text: string;
  question_set_title: string;
  user_answer: string;
  is_correct: boolean;
  answer_time_sec: number;
  answered_at: string;
}
```

## 7. 実装優先度

### 7.1 Phase 1（必須機能）

1. 基本情報表示
2. アカウントステータス表示
3. 学習統計表示
4. クイックアクション（設定、統計詳細、ログアウト）

### 7.2 Phase 2（重要機能）

1. 最近の学習履歴表示
2. ユーザー名編集
3. メールアドレス変更
4. 購入した問題集表示

### 7.3 Phase 3（拡張機能）

1. 作成した問題集表示（販売者）
2. 詳細な統計グラフ
3. 学習目標設定
4. アバター画像アップロード

## 8. テスト要件

### 8.1 単体テスト

- 各コンポーネントのレンダリングテスト
- 状態管理のテスト
- API 呼び出しのモックテスト

### 8.2 統合テスト

- 認証フローのテスト
- API 連携のテスト
- エラーハンドリングのテスト

### 8.3 E2E テスト

- マイページ表示フロー
- 情報編集フロー
- ログアウトフロー

## 9. セキュリティ要件

### 9.1 認証・認可

- JWT トークンによる認証
- ユーザーは自分の情報のみアクセス可能
- 管理者は全ユーザー情報にアクセス可能

### 9.2 データ保護

- 個人情報の暗号化
- HTTPS 通信の強制
- セッションタイムアウト（30 分）

### 9.3 入力検証

- XSS 対策（入力値のサニタイズ）
- SQL インジェクション対策（パラメータ化クエリ）
- CSRF 対策（トークン検証）

## 10. 運用要件

### 10.1 ログ

- ユーザー情報変更ログ
- アクセスログ
- エラーログ

### 10.2 モニタリング

- API 応答時間の監視
- エラー率の監視
- ユーザーアクティビティの監視

### 10.3 バックアップ

- ユーザー情報の定期バックアップ
- 統計情報の定期バックアップ

## 11. 今後の拡張予定

### 11.1 機能拡張

- プロフィール画像のアップロード
- 学習目標の設定と進捗表示
- バッジ・実績システム
- ソーシャル機能（フォロー、フォロワー）

### 11.2 UI 改善

- ダークモード対応
- カスタムテーマ設定
- アニメーション効果の追加

## 12. 参考資料

### 12.1 関連ドキュメント

- [データベーススキーマ](./.claude/database-schema.md)
- [API 仕様書](./docs/API.md)
- [セキュリティ分析](./docs/LOGIN_SECURITY_ANALYSIS.md)

### 12.2 既存実装

- 設定画面: `frontend/app/(app)/settings.tsx`
- 統計画面: `frontend/app/(app)/stats.tsx`
- 認証 API: `backend/app/api/auth.py`
- 回答 API: `backend/app/api/answers.py`
