# プロジェクト構造解説

## 概要

このプロジェクトは、AI機能を持つクイズマーケットプレイスアプリケーションです。
- **バックエンド**: FastAPI (Python)
- **フロントエンド**: React Native (Expo)
- **データベース**: PostgreSQL

---

## ディレクトリ構造

```
practice_app/
├── backend/               # バックエンドAPI (FastAPI)
│   ├── app/
│   │   ├── main.py       # アプリケーションのエントリーポイント
│   │   ├── core/         # コア機能
│   │   │   ├── auth.py   # JWT認証処理
│   │   │   ├── config.py # 環境設定
│   │   │   └── database.py # DB接続設定
│   │   ├── models/       # SQLAlchemyモデル
│   │   │   └── __init__.py # User, QuestionSet, Question, Answerモデル
│   │   ├── api/          # APIエンドポイント
│   │   │   ├── auth.py   # 認証API (ログイン、登録、ユーザー情報)
│   │   │   ├── question_sets.py # 問題集CRUD
│   │   │   ├── questions.py # 問題CRUD + CSV一括登録
│   │   │   └── answers.py # 回答送信、統計取得
│   │   └── ai/           # AI予測機能
│   │       ├── predictor.py # ユーザーの弱点分析、改善提案
│   │       └── stats_updater.py # 統計データ更新
│   └── venv/             # Python仮想環境
│
└── frontend/             # フロントエンド (React Native + Expo)
    ├── app/              # Expo Routerによるファイルベースルーティング
    │   ├── _layout.tsx   # ルートレイアウト
    │   ├── index.tsx     # エントリーポイント
    │   ├── login.tsx     # ログイン画面
    │   ├── register.tsx  # 登録画面
    │   └── (app)/        # 認証後の画面
    │       ├── _layout.tsx # タブナビゲーション
    │       ├── index.tsx # ホーム画面
    │       ├── ai-dashboard.tsx # AIダッシュボード
    │       ├── question-sets/ # 問題集関連
    │       │   ├── index.tsx # 問題集一覧
    │       │   ├── [id].tsx  # 問題集詳細
    │       │   ├── create.tsx # 問題集作成
    │       │   └── [id]/
    │       │       └── add-question.tsx # 問題追加
    │       └── quiz/
    │           └── [id].tsx  # クイズ画面
    │
    └── src/
        ├── services/
        │   └── api.ts    # Axiosクライアント設定、インターセプター
        ├── api/          # API呼び出し関数
        │   ├── auth.ts   # 認証API
        │   ├── questionSets.ts # 問題集API
        │   ├── questions.ts # 問題API + CSV Upload
        │   └── answers.ts # 回答API
        └── contexts/
            └── AuthContext.tsx # 認証状態管理
```

---

## バックエンドアーキテクチャ

### 1. 認証フロー

```
ユーザー → POST /api/v1/auth/login
         ← { access_token, user }

リクエスト → Header: Authorization: Bearer <token>
API → JWT検証 (get_current_active_user)
    → ユーザー情報取得
    ← レスポンス
```

**実装ファイル**:
- `backend/app/core/auth.py`: JWT生成・検証、依存性注入
- `backend/app/api/auth.py`: ログイン・登録エンドポイント

### 2. データモデル

#### User (ユーザー)
```python
- id: UUID
- email: str (ユニーク)
- hashed_password: str (Argon2)
- full_name: str
- is_active: bool
```

#### QuestionSet (問題集)
```python
- id: UUID
- title: str
- description: str
- category: str
- creator_id: UUID (FK → User)
- price: int
- is_published: bool
- tags: List[str]
```

#### Question (問題)
```python
- id: UUID
- question_set_id: UUID (FK → QuestionSet)
- question_text: str
- question_type: enum (multiple_choice, true_false, text_input)
- options: List[str] (選択肢)
- correct_answer: str
- explanation: str
- difficulty: float (0.0 - 1.0)
- order: int
- total_attempts: int (統計)
- correct_count: int (統計)
```

#### Answer (回答記録)
```python
- id: UUID
- user_id: UUID (FK → User)
- question_id: UUID (FK → Question)
- user_answer: str
- is_correct: bool
- answer_time_sec: float
- answered_at: datetime
```

### 3. AI予測システム

**`backend/app/ai/predictor.py`**

AIPredictor クラスが以下の機能を提供：

#### 機能1: ユーザー統計取得
```python
_get_user_stats(user_id) → dict
- 総回答数
- 正解数
- 正解率
- 平均回答時間
```

#### 機能2: カテゴリ別弱点分析
```python
_get_weak_categories(user_id) → List[dict]
- カテゴリごとの統計
- weakness_score (弱点スコア)
- 正解率が低く、回答時間が長いカテゴリを特定
```

#### 機能3: 改善提案生成
```python
get_improvement_suggestions(user_id) → dict
- ユーザーの弱点カテゴリ
- 推奨する問題集
- 学習アドバイス
```

**SQLAlchemy注意点**:
- `func.cast(Answer.is_correct, Integer)` - Integer型をインポート必須
- NULL値のフィルタ: `.filter(column.is_not(None))`

---

## フロントエンドアーキテクチャ

### 1. 認証フロー

```
App起動
  → AuthProvider (AuthContext)
    → AsyncStorage から access_token 取得
    → token あり → GET /api/v1/auth/me
      ↓
    成功 → user設定、isAuthenticated = true
    失敗 → token削除、ログイン画面へ
```

**実装ファイル**:
- `frontend/src/contexts/AuthContext.tsx`: 認証状態管理
- `frontend/src/services/api.ts`: Axiosインターセプター

### 2. API通信

#### リクエストインターセプター
```typescript
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### レスポンスインターセプター
```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem("access_token");
      router.replace("/login");
    }
    return Promise.reject(error);
  }
);
```

### 3. ルーティング構造

Expo Routerのファイルベースルーティング:

```
/                     → app/index.tsx (リダイレクト)
/login                → app/login.tsx
/register             → app/register.tsx

/(app)/               → app/(app)/_layout.tsx (タブレイアウト)
  ├─ /               → index.tsx (ホーム)
  ├─ /ai-dashboard   → ai-dashboard.tsx
  ├─ /question-sets  → question-sets/index.tsx
  ├─ /question-sets/[id] → question-sets/[id].tsx
  └─ /quiz/[id]      → quiz/[id].tsx
```

### 4. 主要画面の機能

#### ホーム画面 (`app/(app)/index.tsx`)
- 問題集一覧表示
- カテゴリフィルタ
- 検索機能
- 問題集作成ボタン

#### 問題集詳細 (`app/(app)/question-sets/[id].tsx`)
- 問題一覧表示
- 問題追加ボタン
- **CSV一括アップロード**
- Start Quizボタン
- 問題集削除

#### クイズ画面 (`app/(app)/quiz/[id].tsx`)
- 問題の表示
- 回答入力 (選択肢/テキスト)
- 正解・不正解の即時フィードバック
- 解説表示
- スコア表示
- 進捗バー

#### AIダッシュボード (`app/(app)/ai-dashboard.tsx`)
- ユーザー統計表示
- 弱点カテゴリ分析
- 推奨問題集
- 学習アドバイス

---

## CSV一括アップロード機能

### フォーマット

```csv
question_text,question_type,options,correct_answer,explanation,difficulty,category
"What is 2+2?",multiple_choice,"2,3,4,5",4,"Basic addition",0.2,math
"The sky is blue",true_false,,true,"Common knowledge",0.1,general
"Capital of France?",text_input,,Paris,"Paris is the capital",0.3,geography
```

### フロー

1. **フロントエンド** (`questions.ts`):
   ```typescript
   const formData = new FormData();
   formData.append('file', {
     uri: file.uri,
     name: file.name,
     type: 'text/csv',
   });
   POST /questions/bulk-upload/{questionSetId}
   ```

2. **バックエンド** (`questions.py`):
   ```python
   - ファイル読み込み (UTF-8)
   - CSVパース (csv.DictReader)
   - 各行をバリデーション
   - Questionモデル作成
   - 一括コミット
   - エラーリスト返却
   ```

3. **レスポンス**:
   ```json
   {
     "message": "Successfully imported 10 questions",
     "total_created": 10,
     "total_errors": 2,
     "errors": ["Row 5: Missing required fields", ...]
   }
   ```

---

## 開発環境のセットアップ

### バックエンド

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

pip install -r requirements.txt

# .envファイル作成
DATABASE_URL=postgresql://user:pass@localhost/dbname
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30

# サーバー起動
venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8003
```

### フロントエンド

```bash
cd frontend
npm install

# expo-document-picker インストール済み
npx expo start
```

---

## トラブルシューティング

### 1. 401エラー (Unauthorized)

**原因**: トークンが送信されていない、または期限切れ

**確認**:
- `AsyncStorage.getItem('access_token')` でトークン確認
- リクエストヘッダーに `Authorization: Bearer <token>` があるか
- トークンの有効期限 (デフォルト30分)

**解決**:
- ログアウト→再ログイン
- `api.ts` のリクエストインターセプター確認

### 2. 500エラー (SQLAlchemy)

**エラー例**: `'Function' object has no attribute '_isnull'`

**原因**: `func.Integer()` を使用している

**解決**:
```python
# ❌ 間違い
from sqlalchemy import func
func.cast(column, func.Integer())

# ✅ 正しい
from sqlalchemy import func, Integer
func.cast(column, Integer)
```

### 3. CSV アップロードエラー

**原因**: 文字エンコーディングが UTF-8 でない

**解決**:
- CSVファイルをUTF-8で保存
- Excelの場合: 「名前を付けて保存」→ 「CSV UTF-8」

### 4. サーバー起動時の ModuleNotFoundError

**原因**: venv外でコマンド実行

**解決**:
```bash
# ❌ 間違い
uvicorn app.main:app --reload

# ✅ 正しい
venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8003
```

---

## API エンドポイント一覧

### 認証
- `POST /api/v1/auth/register` - ユーザー登録
- `POST /api/v1/auth/login` - ログイン
- `GET /api/v1/auth/1` - 現在のユーザー情報

### 問題集
- `GET /api/v1/question-sets/` - 問題集一覧
- `POST /api/v1/question-sets/` - 問題集作成
- `GET /api/v1/question-sets/{id}` - 問題集詳細
- `PUT /api/v1/question-sets/{id}` - 問題集更新
- `DELETE /api/v1/question-sets/{id}` - 問題集削除

### 問題
- `GET /api/v1/questions/` - 問題一覧
- `POST /api/v1/questions/` - 問題作成
- `GET /api/v1/questions/{id}` - 問題詳細
- `PUT /api/v1/questions/{id}` - 問題更新
- `DELETE /api/v1/questions/{id}` - 問題削除
- `POST /api/v1/questions/bulk-upload/{question_set_id}` - CSV一括登録

### 回答
- `POST /api/v1/answers/submit` - 回答送信
- `GET /api/v1/answers/user/{user_id}` - ユーザーの回答履歴
- `GET /api/v1/answers/stats/{user_id}` - ユーザー統計

### AI
- `GET /api/v1/ai/improvement-suggestions/{user_id}` - 改善提案取得

---

## セキュリティ

### パスワードハッシュ化
- Argon2 使用
- ソルト自動生成

### JWT認証
- HS256アルゴリズム
- 有効期限: 30分
- トークンはAsyncStorageに保存 (フロント)

### 権限管理
- 問題集の編集・削除: 作成者のみ
- 問題の追加・編集・削除: 問題集の作成者のみ
- CSV一括登録: 問題集の作成者のみ

---

## 今後の拡張予定

- [ ] ユーザープロフィール編集
- [ ] 問題集の購入機能
- [ ] コメント・レビュー機能
- [ ] より高度なAI分析 (機械学習モデル導入)
- [ ] リアルタイム対戦クイズ
- [ ] プッシュ通知
- [ ] ダークモード対応
