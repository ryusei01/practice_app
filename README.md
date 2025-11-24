# 問題集売買 × AI適応型学習アプリ

## 概要
個人が作成した問題集を売買できるマーケットプレイス機能と、AIによる適応型学習機能を備えたスマホアプリ。

## 主要機能

### 1. 問題集マーケットプレイス
- ユーザーが問題集を作成・登録・販売
- 他のユーザーが問題集を購入
- 手数料制のマネタイズ（20-30%）

### 2. AI適応型学習
- 回答履歴（正誤・時間・再回答回数）の記録
- AIによる苦手分野の分析
- 最適な問題選定
- 予想スコアの算出

## 技術スタック

### フロントエンド
- **React Native (Expo)** - クロスプラットフォーム開発
- **TypeScript** - 型安全性
- **React Navigation** - ルーティング
- **React Query** - データフェッチング

### バックエンド
- **FastAPI** - 高速なPython Webフレームワーク
- **Python 3.11+**
- **SQLAlchemy** - ORM
- **Pydantic** - データバリデーション

### データベース・認証
- **Supabase** (PostgreSQL + Auth + Storage)
  - Database: 500MB無料
  - Auth: 無制限ユーザー（無料）
  - Storage: 1GB無料

### AI/ML
- **scikit-learn** - 機械学習モデル
- **LightGBM** - 問題推薦システム
- **pandas** - データ処理

### 決済
- **Stripe Connect** - 個人間決済
  - 手数料: 3.6% + ¥0

### デプロイ
- **Backend**: Render (Free tier) / Railway
- **Frontend**: Expo (OTA更新無料)

## コスト構成

| サービス | プラン | 月額 |
|---------|--------|------|
| Supabase | Free | $0 |
| Render/Railway | Free | $0 |
| Stripe | 手数料のみ | 取引の3.6% |
| **合計** | | **$0/月** |

## プロジェクト構造

```
practice_app/
├── backend/           # FastAPI バックエンド
│   ├── app/
│   │   ├── api/      # APIエンドポイント
│   │   ├── models/   # データベースモデル
│   │   ├── schemas/  # Pydanticスキーマ
│   │   ├── services/ # ビジネスロジック
│   │   ├── ai/       # AI/ML ロジック
│   │   └── core/     # 設定・認証
│   ├── tests/
│   └── requirements.txt
├── frontend/          # React Native アプリ
│   ├── src/
│   │   ├── screens/  # 画面コンポーネント
│   │   ├── components/
│   │   ├── navigation/
│   │   ├── services/ # API連携
│   │   └── types/
│   ├── app.json
│   └── package.json
└── docs/             # ドキュメント
```

## セットアップ手順

### バックエンド
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### フロントエンド
```bash
cd frontend
npm install
npx expo start
```

## 開発フェーズ

### Phase 1: MVP (最小機能製品)
- [ ] ユーザー認証
- [ ] 問題集CRUD
- [ ] 基本的な問題解答機能
- [ ] 回答履歴の記録

### Phase 2: AI機能
- [ ] 回答データ分析
- [ ] 問題推薦アルゴリズム
- [ ] 予想スコア算出

### Phase 3: マーケットプレイス
- [ ] 問題集の販売・購入
- [ ] Stripe Connect統合
- [ ] 売上管理

### Phase 4: 高度な機能
- [ ] レビュー・評価システム
- [ ] カテゴリ・タグ検索
- [ ] 学習統計ダッシュボード

## ライセンス
MIT
