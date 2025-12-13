# AI機能の仕組み

## 概要

このアプリケーションには以下の2つのAI機能が実装されています:

1. **問題推薦システム (QuestionRecommender)**: ユーザーに最適な問題を選定
2. **スコア予測システム (ScorePredictor)**: ユーザーの今後のスコアを予測

---

## 1. 問題推薦システム

### 目的
ユーザーの回答履歴から最適な学習問題を選定し、効率的な学習をサポート

### アルゴリズム

#### スコアリング方式
各問題に対して0-1.0のスコアを付与し、スコアが高い順に推薦します。

```python
総合スコア = 苦手カテゴリスコア(0.3) + 難易度スコア(0.4) + 未回答スコア(0.2) + 復習必要スコア(0.1)
```

#### 1. 苦手カテゴリスコア (重み: 0.3)
- ユーザーの正答率が60%以下のカテゴリを「苦手カテゴリ」と判定
- 苦手度が高いカテゴリほど高スコア
- 計算式: `0.3 × (1 - 苦手ランク / 苦手カテゴリ総数)`

```python
# 例: ユーザーの苦手カテゴリ
weak_categories = ['数学', '物理', '化学']  # 苦手度順

# 「数学」の問題の場合
weak_rank = 0  # 最も苦手
score = 0.3 × (1 - 0/3) = 0.3

# 「化学」の問題の場合
weak_rank = 2
score = 0.3 × (1 - 2/3) = 0.1
```

#### 2. 難易度スコア (重み: 0.4)
- ユーザーの実力に適した難易度の問題を優先
- 目標難易度が指定されていない場合、正答率50-70%を狙う難易度を自動算出
- 計算式: `0.4 × (1 - |問題難易度 - 目標難易度|)`

```python
# 例: ユーザーの全体正答率が70%の場合
target_difficulty = 1 - 0.7 + 0.1 = 0.4  # 難易度0.4の問題が適切

# 難易度0.35の問題の場合
difficulty_diff = |0.35 - 0.4| = 0.05
score = 0.4 × (1 - 0.05) = 0.38

# 難易度0.8の問題の場合
difficulty_diff = |0.8 - 0.4| = 0.4
score = 0.4 × (1 - 0.4) = 0.24
```

#### 3. 未回答スコア (重み: 0.2)
- まだ解いていない問題を優先
- 習熟度が低い問題も優先

```python
if 未回答:
    score = 0.2
elif 習熟度 < 0.5:
    score = 0.2 × (1 - 習熟度)
else:
    score = 0
```

#### 4. 復習必要スコア (重み: 0.1)
- 過去に間違えた問題を復習として出題
- 間違い率が高いほど高スコア

```python
if 間違えた経験あり:
    error_rate = 1 - (正解数 / 総回答数)
    score = 0.1 × error_rate
```

### API エンドポイント

#### POST /ai/recommend
問題を推薦

**リクエスト:**
```json
{
  "user_id": "user123",
  "question_set_id": "set456",
  "count": 10,
  "target_difficulty": 0.5  // optional
}
```

**レスポンス:**
```json
{
  "question_ids": ["q1", "q2", "q3", ...],
  "count": 10
}
```

#### GET /ai/adaptive-difficulty/{user_id}/{category}
適応型学習: 次の問題の推奨難易度を取得

**レスポンス:**
```json
{
  "category": "数学",
  "recommended_difficulty": 0.45
}
```

### データソース

#### UserCategoryStats (カテゴリ別統計)
```sql
- user_id: ユーザーID
- category: カテゴリ名
- correct_rate: 正答率
- weakness_score: 苦手度スコア
```

#### UserQuestionStats (問題別統計)
```sql
- user_id: ユーザーID
- question_id: 問題ID
- total_attempts: 総回答数
- correct_count: 正解数
- mastery_score: 習熟度スコア (0-1)
```

---

## 2. スコア予測システム

### 目的
ユーザーが今受験したら取れそうなスコアを予測し、学習の進捗を可視化

### アルゴリズム

```python
予測スコア = 基本スコア + 速度補正 + トレンド補正 + 難易度補正
```

#### 1. 基本スコア
ユーザーの正答率をベースに算出

```python
基本スコア = 正答率 × 満点スコア

# 例: 正答率75%、満点100点の場合
基本スコア = 0.75 × 100 = 75点
```

#### 2. 速度補正 (-5〜+2点)
回答速度から理解度を推定

```python
理想的な回答時間: 5-15秒

if 5秒 <= 平均回答時間 <= 15秒:
    補正 = +2.0  # 適切なペース
elif 平均回答時間 < 5秒:
    補正 = -3.0 × (5 - 平均回答時間) / 5  # 速すぎ = 適当に答えている
else:
    補正 = -min(5.0, (平均回答時間 - 15) / 10)  # 遅すぎ = 理解不足
```

**例:**
- 平均3秒 → `-3.0 × (5-3)/5 = -1.2点` (速すぎ)
- 平均10秒 → `+2.0点` (理想的)
- 平均30秒 → `-min(5, (30-15)/10) = -1.5点` (遅すぎ)

#### 3. トレンド補正 (-10〜+10点)
最近30日間の正答率の傾向

```python
最近の正答率 - 過去の正答率 = トレンド

if トレンド > 0:
    補正 = +min(10, トレンド × 20)  # 向上傾向
else:
    補正 = -min(10, |トレンド| × 20)  # 低下傾向
```

**例:**
- 最近70% → 過去60% → `トレンド = +0.1` → `補正 = +2点`
- 最近50% → 過去70% → `トレンド = -0.2` → `補正 = -4点`

#### 4. 難易度補正 (-5〜+5点)
解いた問題の難易度から実力を補正

```python
平均難易度 = ユーザーが解いた問題の平均難易度

if 平均難易度 > 0.6:
    補正 = +5  # 難しい問題を解いている = 実力高い
elif 平均難易度 < 0.3:
    補正 = -5  # 簡単な問題ばかり = 実力低め
else:
    補正 = 0
```

#### 5. 信頼度計算
予測の信頼度を0-1で表現

```python
信頼度 = min(1.0, 回答数 / 100)

# 例:
# 10問回答 → 信頼度 0.1 (10%)
# 50問回答 → 信頼度 0.5 (50%)
# 100問以上 → 信頼度 1.0 (100%)
```

### API エンドポイント

#### POST /ai/predict-score
スコアを予測

**リクエスト:**
```json
{
  "user_id": "user123",
  "question_set_id": "set456",  // optional: 全体の場合はnull
  "max_score": 100
}
```

**レスポンス:**
```json
{
  "predicted_score": 78.5,
  "confidence": 0.85,
  "base_score": 75.0,
  "adjustments": {
    "speed": 2.0,
    "trend": 3.5,
    "difficulty": -2.0
  },
  "stats": {
    "correct_rate": 0.75,
    "total_attempts": 85,
    "avg_time_sec": 12.3
  }
}
```

#### GET /ai/category-predictions/{user_id}
カテゴリ別のスコア予測

**レスポンス:**
```json
[
  {
    "category": "数学",
    "predicted_score": 85.0,
    "confidence": 0.9,
    "max_score": 100
  },
  {
    "category": "物理",
    "predicted_score": 62.0,
    "confidence": 0.7,
    "max_score": 100
  }
]
```

#### GET /ai/improvement-suggestions/{user_id}
学習改善の提案

**レスポンス:**
```json
{
  "suggestions": [
    {
      "category": "物理",
      "suggestion": "物理の正答率が低いため、基礎問題から復習することをお勧めします",
      "priority": 1
    },
    {
      "category": "化学",
      "suggestion": "化学は最近正答率が低下傾向です。難易度を下げて復習しましょう",
      "priority": 2
    }
  ]
}
```

---

## データフロー

### 1. 回答データの記録
```
ユーザーが問題に回答
↓
POST /api/answers (フロントエンド)
↓
answersテーブルに保存 (バックエンド)
↓
UserCategoryStats, UserQuestionStats を更新 (バックエンド)
```

### 2. AI推薦の実行
```
ユーザーがクイズ開始ボタンをクリック
↓
POST /ai/recommend (フロントエンド)
↓
QuestionRecommender.recommend_questions() (バックエンド)
↓
各問題にスコアを付与してソート
↓
上位N問を返す
```

### 3. スコア予測の表示
```
ユーザーがAIダッシュボードを開く
↓
GET /ai/category-predictions/{user_id} (フロントエンド)
GET /ai/improvement-suggestions/{user_id} (フロントエンド)
↓
ScorePredictor.predict_score() (バックエンド)
ScorePredictor.get_improvement_suggestions() (バックエンド)
↓
予測結果を表示
```

---

## 3. テキスト回答のAI評価システム

### 目的
ユーザーが入力したテキスト回答を、単純な文字列一致ではなく意味的に評価し、柔軟な正誤判定を実現

### アルゴリズム

#### 評価フロー
```
ユーザー回答を受け取る
↓
複数の正解パターンに対して評価
↓
最も高い信頼度の結果を採用
↓
正誤判定 + フィードバックを返す
```

#### 1. テキスト正規化
回答を比較する前に、以下の正規化を実行:

```typescript
function normalizeText(text: string): string {
  // Unicode正規化（NFKC: 全角→半角）
  let normalized = text.normalize('NFKC');
  // 前後の空白削除
  normalized = normalized.trim();
  // 小文字化
  normalized = normalized.toLowerCase();
  // 連続する空白を1つに
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized;
}
```

**例:**
- `"　TOKYO　"` → `"tokyo"`
- `"こんにちは　　世界"` → `"こんにちは 世界"`
- `"１２３"` → `"123"`

#### 2. 評価手法の階層

正確性の高い順に以下の手法を適用:

##### 2.1 完全一致チェック (信頼度: 1.0)
正規化後の文字列が完全に一致

```typescript
if (normCorrect === normUser) {
  return { is_correct: true, confidence: 1.0 };
}
```

##### 2.2 句読点除外一致 (信頼度: 0.98)
句読点・記号を除いて一致

```typescript
const cleanCorrect = removePunctuation(normCorrect);
const cleanUser = removePunctuation(normUser);

if (cleanCorrect === cleanUser) {
  return { is_correct: true, confidence: 0.98 };
}
```

**除外される記号:**
- 日本語: `、。，．,!！?？;；:：「」『』【】（）`
- 英語: `,.!?;:'"()[]{}`
- その他: `-`、空白

##### 2.3 数字表現の正規化一致 (信頼度: 0.95)
異なる数字表記を統一して比較

```typescript
// 漢数字・かな表記をアラビア数字に変換
normalizeNumbers("三つ") → "3つ"
normalizeNumbers("十") → "10"
normalizeNumbers("一、二、三") → "1、2、3"
```

**対応表:**
| アラビア数字 | 漢数字・かな表記 |
|-------------|-----------------|
| 0 | 〇、ゼロ、ぜろ、零、れい |
| 1 | 一、いち、ひとつ、1つ |
| 2 | 二、に、ふたつ、2つ |
| 3 | 三、さん、みっつ、3つ |
| ... | ... |
| 10 | 十、じゅう、とお |

**例:**
- 正解: `"3つ"` → ユーザー: `"三つ"` → ✓ 正解
- 正解: `"10人"` → ユーザー: `"十人"` → ✓ 正解

##### 2.4 漢字の読み一致 (信頼度: 0.85-0.97)
漢字とひらがな/カタカナの読み対応をチェック

```typescript
// カタカナをひらがなに統一
katakanaToHiragana("トウキョウ") → "とうきょう"

// 完全一致 (信頼度: 0.97)
"とうきょう" === "とうきょう" → ✓

// 漢字 vs かな推定 (信頼度: 0.85)
// 漢字数に対してかなの文字数が妥当かチェック
// 条件: 漢字数 × 1.5 ≤ かな文字数 ≤ 漢字数 × 5
```

**例:**
- 正解: `"東京"` (漢字2文字) → ユーザー: `"とうきょう"` (かな5文字) → ✓ 正解 (2×1.5=3 ≤ 5 ≤ 2×5=10)
- 正解: `"りんご"` (かな3文字) → ユーザー: `"林檎"` (漢字2文字) → ✓ 正解
- 正解: `"日本"` (漢字2文字) → ユーザー: `"にほん"` (かな3文字) → ✓ 正解

##### 2.5 数値抽出一致 (信頼度: 0.95)
回答に含まれる数値が一致するかチェック

```typescript
extractNumbers("答えは42です") → ["42"]
extractNumbers("3.14と2.71") → ["3.14", "2.71"]

// 数値配列が完全一致すれば正解
```

##### 2.6 レーベンシュタイン距離による類似度 (信頼度: 0.7-0.9)
文字列編集距離を計算し、類似度を算出

```typescript
similarity = (longer.length - editDistance) / longer.length

if (similarity >= 0.9) {
  return { is_correct: true, confidence: 0.9 };
} else if (similarity >= 0.8) {
  return { is_correct: true, confidence: 0.8 };
} else if (similarity >= 0.7) {
  return { is_correct: true, confidence: 0.7 };
}
```

**例:**
- `"photosynthesis"` vs `"photosynthsis"` (1文字削除) → 類似度: 0.92 → ✓ 正解
- `"こんにちは"` vs `"こんいちは"` (1文字削除) → 類似度: 0.8 → ✓ 正解

#### 3. 複数正解パターンへの対応

正解が複数ある場合、`/`で区切って記述:

```typescript
correctAnswer = "東京/とうきょう/Tokyo"

// すべてのパターンを評価し、最も高い信頼度を採用
patterns = ["東京", "とうきょう", "Tokyo"]

for (pattern of patterns) {
  evaluate(pattern, userAnswer)
  → 最大信頼度を更新
}
```

#### 4. ユーザーによる手動補正機能

AI評価の結果に不満がある場合、ユーザーが手動で正誤を上書き可能:

```typescript
// QuizEngineコンポーネント内
const handleOverrideCorrect = () => {
  // 最後の回答を正解として記録
  updatedAnswers[updatedAnswers.length - 1].is_correct = true;
  setScore(score + 1);
  setEvaluationFeedback("✓ ユーザーが正解として記録しました");
};

const handleOverrideIncorrect = () => {
  // 最後の回答を不正解として記録
  updatedAnswers[updatedAnswers.length - 1].is_correct = false;
  if (isCorrect) setScore(score - 1);
  setEvaluationFeedback("✗ ユーザーが不正解として記録しました");
};
```

**UI表示:**
```
┌─────────────────────────────┐
│ 正誤を手動で記録:           │
├─────────────────────────────┤
│ [✓ 正解] [✗ 不正解]         │
└─────────────────────────────┘
```

**確認モーダル:**
- 手動記録前に確認ダイアログを表示
- 上書き後は3秒間メッセージを表示

### 使用場面

#### QuizEngine (クイズモード)
- `text_input`形式の問題に対してAI評価を実行
- `showAdvancedFeatures={true}`の場合のみ有効
- 評価結果をフィードバックと共に表示
- ユーザーが手動で正誤を補正可能

```typescript
// frontend/src/components/QuizEngine.tsx
if (questionType === "text_input" && showAdvancedFeatures) {
  const evaluation = evaluateTextAnswer(
    currentQuestion.correct_answer,
    userAnswer,
    language as 'en' | 'ja'
  );
  correct = evaluation.is_correct;
  feedback = evaluation.feedback;
}
```

### フィードバックメッセージ

| 信頼度 | 正誤 | 日本語 | 英語 |
|-------|------|--------|------|
| 1.0 | ✓ | 完全一致！正解です。 | Perfect match! |
| 0.98 | ✓ | 表現は少し異なりますが、正解です！ | Correct! Slightly different expression. |
| 0.95-0.97 | ✓ | 読みが正解です！/数字表現が正解です！ | Correct reading!/Correct number! |
| 0.9 | ✓ | ほぼ正解です！わずかな表現の違いがあります。 | Almost perfect! Minor differences. |
| 0.8 | ✓ | 正解です！表現が少し異なりますが、意味は合っています。 | Correct! Slightly different but same meaning. |
| 0.7 | ✓ | 概ね正解です！細かい表現に違いがありますが、意味は正しいです。 | Mostly correct! Some differences but right meaning. |
| 0.6 | ✗ | 惜しい！部分的に正しいですが、いくつか違いがあります。 | Close! Partially correct but some differences. |
| 0.4 | ✗ | 部分的に正しいですが、かなり違いがあります。 | Partially correct but significant differences. |
| 0.2 | ✗ | 残念ながら不正解です。正解と大きく異なります。 | Incorrect. Very different from the answer. |

### 実装ファイル

- **評価ロジック**: `frontend/src/utils/aiEvaluator.ts`
- **QuizEngine統合**: `frontend/src/components/QuizEngine.tsx`
- **Trial Quiz統合**: `frontend/app/(trial)/quiz/[id].tsx`

### ログ出力

デバッグ用に詳細なログを出力:

```typescript
console.log('[evaluateTextAnswer] Called with:', {
  correctAnswer,
  userAnswer,
});

console.log('[AI Evaluator] Number normalization:', {
  cleanCorrect,
  cleanUser,
  numNormCorrect,
  numNormUser,
  match: numNormCorrect === numNormUser
});

console.log('[evaluateTextAnswer] Final result:', bestResult);
```

### 改善の余地

1. **機械学習ベースの意味理解**
   - Word2VecやBERTによる意味的類似度計算
   - 同義語・類義語の自動検出

2. **言語固有の最適化**
   - 日本語: 漢字の異字体対応（例: 「高」と「髙」）
   - 英語: スペルチェッカー統合

3. **文脈理解**
   - 問題文の文脈から期待される回答形式を推定
   - 単位の自動補完（例: 「100」→「100m」）

---

## フロントエンド実装

### AI Dashboard (`frontend/app/(app)/ai-dashboard.tsx`)
```tsx
export default function AIDashboardScreen() {
  const { user } = useAuth();
  const [categoryPredictions, setCategoryPredictions] = useState<CategoryPrediction[]>([]);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);

  // データ読み込み
  useEffect(() => {
    if (user) {
      const [predictions, improvementSuggestions] = await Promise.all([
        aiApi.getCategoryPredictions(user.id),
        aiApi.getImprovementSuggestions(user.id),
      ]);
      setCategoryPredictions(predictions);
      setSuggestions(improvementSuggestions);
    }
  }, [user]);

  // カテゴリ別予測スコアを表示
  // 学習改善提案を表示
}
```

### API Client (`frontend/src/api/ai.ts`)
```typescript
export const aiApi = {
  recommendQuestions: async (data: RecommendationRequest): Promise<RecommendationResponse> => {
    const response = await apiClient.post('/ai/recommend', data);
    return response.data;
  },

  predictScore: async (data: ScorePredictionRequest): Promise<ScorePrediction> => {
    const response = await apiClient.post('/ai/predict-score', data);
    return response.data;
  },

  getCategoryPredictions: async (userId: string, maxScore: number = 100): Promise<CategoryPrediction[]> => {
    const response = await apiClient.get(`/ai/category-predictions/${userId}`, {
      params: { max_score: maxScore },
    });
    return response.data;
  },

  getImprovementSuggestions: async (userId: string): Promise<ImprovementSuggestion[]> => {
    const response = await apiClient.get(`/ai/improvement-suggestions/${userId}`);
    return response.data.suggestions;
  },
};
```

---

## 改善の余地

### 1. 機械学習モデルの導入
現在はルールベースのアルゴリズムですが、以下のような機械学習モデルを導入できます:

- **協調フィルタリング**: 類似ユーザーの学習パターンから推薦
- **深層学習**: LSTM/GRUで時系列の学習パターンを学習
- **強化学習**: ユーザーのフィードバックから最適な推薦を学習

### 2. より詳細な統計
- 時間帯別の正答率
- 曜日別の学習効率
- 問題タイプ別の得意/不得意

### 3. パーソナライズ
- 学習スタイルの分析（短時間集中型 vs 長時間学習型）
- 忘却曲線に基づく復習タイミングの最適化
- 目標達成までの推定期間

---

## データベーススキーマ

### answers (回答履歴)
```sql
- id: UUID
- user_id: UUID (外部キー)
- question_id: UUID (外部キー)
- is_correct: BOOLEAN
- answer_time_sec: FLOAT
- answered_at: TIMESTAMP
```

### user_category_stats (カテゴリ別統計)
```sql
- id: UUID
- user_id: UUID
- category: VARCHAR
- correct_rate: FLOAT
- weakness_score: FLOAT
- total_attempts: INTEGER
- updated_at: TIMESTAMP
```

### user_question_stats (問題別統計)
```sql
- id: UUID
- user_id: UUID
- question_id: UUID
- total_attempts: INTEGER
- correct_count: INTEGER
- mastery_score: FLOAT
- last_answered_at: TIMESTAMP
```

---

## まとめ

このAIシステムは、ユーザーの回答履歴を分析して:

1. **最適な問題を推薦** - 苦手分野を克服し、適切な難易度で学習
2. **スコアを予測** - 学習の進捗を可視化し、モチベーション向上
3. **改善提案を提供** - 具体的な学習アドバイスで効率的な学習をサポート

これにより、ユーザーは自分の実力に合った効率的な学習が可能になります。
