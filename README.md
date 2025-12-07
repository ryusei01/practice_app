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

### 3. AI意味評価機能（記述式問題）
- **完全無料**のルールベース意味評価システム
- text_input問題で完全一致でなくても意味が正しければ正解と判定
- 文字列正規化・類似度計算・数値抽出・**漢字読み対応**による多段階評価
- 信頼度スコア（0-100%）とフィードバックを表示
- **クライアントサイド実行** - オフラインでも動作、API呼び出し不要
- **日本語対応強化** - 漢字⇔ひらがな⇔カタカナの相互変換に対応
- **複数正解パターン対応** - `/`区切りで複数の正解を設定可能（例: `東京/とうきょう/Tokyo`）
- **手動正解上書き機能** - AIが不正解と判定した場合でもユーザーが正解として記録可能

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
- **difflib** (Python標準) - 文字列類似度計算（レーベンシュタイン距離）
- **unicodedata** (Python標準) - テキスト正規化（全角半角統一）

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
│   │   │   └── ai_evaluator.py  # 記述式問題の意味評価
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
│   │   ├── i18n/     # 多言語対応
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
cp .env.example .env
# .env を編集して環境変数を設定
uvicorn app.main:app --reload --port 8003
```

### フロントエンド
```bash
cd frontend
npm install --legacy-peer-deps
cp .env.example .env
# .env を編集してAPI URLを設定
npx expo start
```

## デプロイ

### Cloudflare Pages（フロントエンド）- 手動デプロイ

```bash
# Windows
deploy-cloudflare.bat

# Mac/Linux
chmod +x deploy-cloudflare.sh
./deploy-cloudflare.sh
```

その後、https://dash.cloudflare.com/ で `frontend/dist` をアップロード

詳細は [DEPLOYMENT.md](DEPLOYMENT.md) を参照

### Railway（バックエンド）

1. https://railway.app/ でGitHub連携
2. 環境変数を設定（`.env.example` 参照）
3. 自動デプロイ

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

## AI意味評価システムの仕組み

### 概要
記述式問題（text_input）の回答を、完全一致でなくても意味的に正しければ正解と判定する無料のAI評価システム。OpenAI APIなどの有料サービスを使わず、**クライアントサイド（フロントエンド）でルールベースアルゴリズムを実行**。

**重要**: 評価ロジックはフロントエンドに実装されているため、クイズ開始時に全問題データを取得し、回答評価はローカルで即座に実行されます。ネットワーク接続不要でオフラインでも動作します。

### 評価アルゴリズム

#### 1. テキスト正規化
```python
# Unicode正規化 (NFKC: 全角→半角、合成文字分解)
text = unicodedata.normalize('NFKC', text)
# 大文字→小文字変換
text = text.lower()
# 連続する空白を1つに統一
text = re.sub(r'\s+', ' ', text)
```

#### 2. 評価ステップ（優先順位順）

**ステップ1: 完全一致チェック（正規化前）**
- 信頼度: 100%
- 例: `"Python"` == `"Python"` → 正解

**ステップ2: 正規化後一致チェック**
- 信頼度: 100%
- 例: `"Python --Version"` → `"python --version"` → 正解

**ステップ3: 句読点除去後一致チェック**
```python
# 日本語・英語の句読点を削除
punctuation = r'[、。，．,!！?？;；:：\'\"\'\'""（）()[\]【】『』「」\-\s]'
```
- 信頼度: 98%
- 例: `"東京です。"` vs `"東京です"` → 正解

**ステップ4: 漢字の読み（ひらがな・カタカナ）チェック**
```typescript
// カタカナをひらがなに変換して比較
const correctHiragana = katakanaToHiragana(normalizeText(correctAnswer));
const userHiragana = katakanaToHiragana(normalizeText(userAnswer));
```
- 信頼度: 85-97%
- 例: `"東京"` vs `"とうきょう"` → 正解（読みが一致）
- 例: `"東京"` vs `"トウキョウ"` → 正解（読みが一致）

**ステップ5: 数値問題の特別処理**
```python
# 正規表現で数値を抽出
numbers = re.findall(r'-?\d+\.?\d*', text)
```
- 信頼度: 95%
- 例: `"答えは42です"` vs `"42"` → 正解（数値が一致）

**ステップ6: 文字列類似度評価（レーベンシュタイン距離）**
```python
from difflib import SequenceMatcher
similarity = SequenceMatcher(None, str1, str2).ratio()
```

| 類似度 | 判定 | 信頼度 | フィードバック |
|--------|------|--------|----------------|
| ≥ 0.9  | 正解 | 90%    | "ほぼ正解です！わずかな表現の違いがあります" |
| ≥ 0.8  | 正解 | 80%    | "正解です！表現が少し異なりますが、意味は合っています" |
| ≥ 0.7  | 正解 | 70%    | "概ね正解です！細かい表現に違いがありますが、意味は正しいです" |
| ≥ 0.6  | 不正解 | 60%  | "惜しい！部分的に正しいですが、いくつか違いがあります" |
| ≥ 0.4  | 不正解 | 40%  | "部分的に正しいですが、かなり違いがあります" |
| < 0.4  | 不正解 | 20%  | "残念ながら不正解です。正解と大きく異なります" |

### 実装場所

**クライアントサイド（推奨）**:
- ファイル: `frontend/src/utils/aiEvaluator.ts`
- 関数: `evaluateTextAnswer(correctAnswer: string, userAnswer: string)`
- 使用方法:
```typescript
import { evaluateTextAnswer } from '../utils/aiEvaluator';

const evaluation = evaluateTextAnswer(
  question.correct_answer,
  userAnswer
);
// { is_correct: true, confidence: 0.95, feedback: "数値が正解です！", exact_match: false }
```

**サーバーサイド（オプション）**:
- ファイル: `backend/app/services/ai_evaluator.py`
- エンドポイント: `POST /api/v1/answers/evaluate-text`
- 注意: 現在は使用されていません。クライアントサイド評価を使用しています。

### 評価例

#### 例1: 大文字小文字の違い
- 正解: `"python --version"`
- 回答: `"Python --Version"`
- 結果: ✅ 正解（信頼度100%） - 正規化後一致

#### 例2: 表現の違い
- 正解: `"日本の首都は東京です"`
- 回答: `"首都は東京です"`
- 結果: ✅ 正解（信頼度80%） - 類似度評価

#### 例3: 数値問題
- 正解: `"42"`
- 回答: `"答えは42です"`
- 結果: ✅ 正解（信頼度95%） - 数値一致

#### 例4: 句読点の違い
- 正解: `"東京です。"`
- 回答: `"東京です"`
- 結果: ✅ 正解（信頼度98%） - 句読点除去後一致

#### 例5: 漢字の読み（ひらがな）
- 正解: `"東京"`
- 回答: `"とうきょう"`
- 結果: ✅ 正解（信頼度97%） - 読みが一致

#### 例6: 漢字の読み（カタカナ）
- 正解: `"日本"`
- 回答: `"ニホン"`
- 結果: ✅ 正解（信頼度97%） - 読みが一致

#### 例7: 漢字とかなの混在
- 正解: `"りんご"`
- 回答: `"林檎"`
- 結果: ✅ 正解（信頼度85%） - 読みの可能性が高い

#### 例8: 複数の正解パターン
- 正解: `"東京/とうきょう/Tokyo"`
- 回答: `"とうきょう"`
- 結果: ✅ 正解（信頼度100%） - 完全一致

#### 例9: 複数の正解パターン（漢字の読み）
- 正解: `"日本/にほん"`
- 回答: `"ニホン"`
- 結果: ✅ 正解（信頼度97%） - 読みが一致

### メリット
- ✅ **完全無料** - API料金不要、外部サービス不要
- ✅ **超高速** - クライアントサイド実行、ネットワーク遅延なし
- ✅ **完全オフライン** - ネットワーク接続不要で動作
- ✅ **プライバシー保護** - 回答データが外部に送信されない
- ✅ **拡張性** - 独自のルール追加が容易
- ✅ **透明性** - 評価ロジックが明確
- ✅ **スケーラブル** - サーバー負荷なし

### 制限事項
- 複雑な言い換え（同義語）の完全対応は困難
- 文脈理解は限定的
- より高度な評価にはLLM APIの併用を検討

## ライセンス
MIT
