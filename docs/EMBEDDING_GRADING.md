# 記述式採点（sentence-transformers 実装）

## 概要

- **埋め込み類似度 + ルーブリック**で記述式回答に部分点を付与
- **誤概念（ミスタイプ）分類**で「どの勘違いに近いか」をタグ付け
- 同義語・言い換えは埋め込みによりある程度吸収

- 実装: `backend/app/services/embedding_grading.py`
- **他人向けの利用説明**: [SENTENCE_TRANSFORMERS_利用説明.md](./SENTENCE_TRANSFORMERS_利用説明.md)

## 依存

- `sentence-transformers`（内部で PyTorch を利用）
- デフォルトモデル: `paraphrase-multilingual-MiniLM-L12-v2`（日本語・英語対応、軽量）

## ルーブリックの形式

各「観点」をテキストで定義し、受験者回答との類似度で 0 / 0.5 / 1.0 の部分点を付与する。

```python
from app.services.embedding_grading import (
    RubricItem,
    MisconceptionItem,
    score_with_rubric,
    classify_misconceptions,
    evaluate_with_rubric_and_misconceptions,
    to_legacy_evaluation_format,
)

# ルーブリック例（例: 「勾配降下法とは何か？」）
rubrics = [
    RubricItem(id="R1", text="目的関数を最小化するための反復的な最適化手法である", weight=1.0),
    RubricItem(id="R2", text="勾配に基づいてパラメータを更新する", weight=1.0),
    RubricItem(id="R3", text="学習率などのステップ幅パラメータがある", weight=0.5),
]

# 誤概念例
misconceptions = [
    MisconceptionItem(
        id="M1",
        label="二乗誤差の最小化だけの式と混同",
        example_phrases=["二乗誤差を最小にする式", "正規方程式と同じ"],
    ),
    MisconceptionItem(
        id="M2",
        label="更新方向の逆転",
        example_phrases=["勾配の逆方向に更新しない", "パラメータを増やす方向に動かす"],
    ),
]

# 採点
result = evaluate_with_rubric_and_misconceptions(
    answer="損失を減らすために、勾配の逆方向に少しずつパラメータを更新する方法です。",
    rubrics=rubrics,
    misconceptions=misconceptions,
)
# result.normalized_score (0〜100), result.details, result.misconceptions
```

## 既存 API 形式への変換

`evaluate_text_answer` と同じ形式で返したい場合は `to_legacy_evaluation_format` を使う。

```python
legacy = to_legacy_evaluation_format(result, pass_threshold=60.0)
# legacy["is_correct"], legacy["confidence"], legacy["feedback"]
# legacy["embedding_grading"] に詳細あり
```

## ルーブリックの保存場所（案）

- **A. Question に JSON カラムを追加**  
  - 例: `grading_rubric` (JSON), `grading_misconceptions` (JSON)  
  - 問題ごとにルーブリック・誤概念を保持できる
- **B. 現状のまま API で渡す**  
  - フロントまたは管理画面でルーブリックを組み立て、`POST /evaluate-text` の body に含める  
  - DB 変更不要で試せる

## API 統合の流れ

1. **text_input 問題で「ルーブリックあり」の場合**  
   - ルーブリックを取得（DB またはリクエスト）  
   - `evaluate_with_rubric_and_misconceptions` を実行  
   - `to_legacy_evaluation_format` で既存レスポンス形式に合わせて返す
2. **ルーブリックなし**  
   - 従来どおり `ai_evaluator.evaluate_text_answer`（ルールベース）を使用

## 閾値の調整

- `score_with_rubric` の `full_threshold` / `partial_threshold`: 満点・半分の境界（デフォルト 0.78 / 0.58）
- `classify_misconceptions` の `min_similarity`: 誤概念マッチの下限（デフォルト 0.65）

問題タイプや言語に応じて環境変数や設定で上書きできるようにするとよい。

## コスト・パフォーマンス

- 推論はすべてローカル（sentence-transformers）。API コストは不要。
- 初回のみモデルダウンロードが発生する。
- バッチで複数回答を採点する場合は、`embed_texts` に複数回答をまとめて渡すと効率的（未実装の場合は `score_with_rubric` をループで呼ぶ形でも可）。
