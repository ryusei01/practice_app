# sentence-transformers の利用説明

このドキュメントでは、本プロジェクトで **sentence-transformers** をどこで・なぜ・どのように使っているかを、他人に説明できるレベルでまとめます。

---

## 1. sentence-transformers とは

**sentence-transformers** は、文章（センテンス）を固定長のベクトル（埋め込み）に変換する Python ライブラリです。

- **入力**: 文字列（日本語・英語など）
- **出力**: 数百次元の実数ベクトル
- **性質**: 「意味が近い文はベクトルも近い」ように学習されている

類似度は、2つのベクトルの **コサイン類似度** などで測ります。  
キーワードの完全一致ではなく「言い換え」や「同義表現」も、意味が近ければ高い類似度になります。

---

## 2. 本プロジェクトで使う目的

**記述式問題の採点** と **誤答のタイプ分類** です。

| 用途 | 説明 |
|------|------|
| **ルーブリック採点** | 「各観点を満たしているか」を、観点の説明文と生徒の回答の**意味の近さ**で判定し、部分点を付与する |
| **誤概念分類** | 典型的な誤解のパターン（代表フレーズ）と回答の類似度を比較し、「どの勘違いに近いか」をタグ付けする |

択一や○×はルールで判定できますが、**記述式**では言い換え・部分正解・誤解のタイプ分けに **意味的な比較** が必要なため、埋め込み（sentence-transformers）を利用しています。

---

## 3. どこで使っているか（コード上の場所）

| 場所 | 役割 |
|------|------|
| **`backend/app/services/embedding_grading.py`** | 採点ロジックの本体。モデルのロード、埋め込み取得、類似度計算、部分点・誤概念分類を実装 |
| **`backend/app/api/answers.py`** | HTTP API。`POST /evaluate-text-with-rubric` でルーブリック付き採点を呼び出し、結果を返す |
| **`backend/requirements.txt`** | 依存パッケージとして `sentence-transformers>=2.2.0` を記載 |

**使っていない場所**: フロントエンド、DB 層、他の API（例: 択一問題の採点）では使っていません。

---

## 4. 処理の流れ（他人に説明する用）

1. **初回のみ**: 指定したモデル（例: `paraphrase-multilingual-MiniLM-L12-v2`）をダウンロードし、メモリにロードする。
2. **採点リクエストが来たとき**:
   - **ルーブリックの各項目**（「勾配でパラメータを更新する」など）の文をモデルに入れ、ベクトル化する。
   - **生徒の回答**も同じモデルでベクトル化する。
   - 回答ベクトルと各ルーブリックのベクトルの **コサイン類似度** を計算する。
   - 類似度が閾値以上ならその観点は「満点」、中間なら「半分」、それ以下なら「0点」とし、重みを付けて合計する。
3. **誤概念分類**（オプション）:
   - あらかじめ登録した「典型的な誤解の例文」をベクトル化しておく。
   - 回答ベクトルと各誤解例の類似度を計算し、閾値以上のものを「この誤概念に近い」として返す。

つまり、**文章 → ベクトル → 類似度 → 部分点・ラベル** という一連の流れで sentence-transformers を使っています。

---

## 5. 使用しているモデル

- **名前**: `paraphrase-multilingual-MiniLM-L12-v2`
- **特徴**: 多言語（日本語・英語など）対応で、比較的軽いモデル。  
  初回実行時に Hugging Face からダウンロードされ、ローカルで推論します（外部 API コストはかかりません）。

モデル名は `embedding_grading.py` の `get_embedding_model()` のデフォルト引数で変更できます。

---

## 6. ライブラリの典型的な使い方（本プロジェクト内）

```python
# 1. モデル取得（シングルトン、初回のみロード）
from app.services.embedding_grading import get_embedding_model
model = get_embedding_model()  # デフォルト: paraphrase-multilingual-MiniLM-L12-v2

# 2. 文をベクトルに変換（sentence-transformers の encode）
vectors = model.encode(["文1", "文2"], show_progress_bar=False)

# 3. 本プロジェクトでは embed_texts() でラップし、list[list[float]] で扱う
from app.services.embedding_grading import embed_texts
embs = embed_texts(model, ["勾配で更新する", "パラメータを勾配方向に更新する"])

# 4. 類似度は自前で cosine_similarity() を計算
from app.services.embedding_grading import cosine_similarity
sim = cosine_similarity(embs[0], embs[1])  # 0〜1
```

採点だけ使う場合は、**ルーブリックと回答を渡して `score_with_rubric()` または `evaluate_with_rubric_and_misconceptions()` を呼ぶ**だけで、内部で上記が行われます。

---

## 7. テストの実行方法

- テストファイル: **`backend/tests/test_embedding_grading.py`**
- モデル不要のユニットテスト（`cosine_similarity`、空入力、`to_legacy_evaluation_format` など）は常に実行されます。
- **sentence-transformers をインストールしている環境**では、実際にモデルをロードする統合テストも実行されます（未インストールの場合はスキップ）。

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/test_embedding_grading.py -v
```

---

## 8. まとめ（一言で他人に説明する場合）

「**記述式の採点と誤答分類に、sentence-transformers で文をベクトル化し、ルーブリックや誤解の例文との類似度で部分点・ラベルを付けている。**」

詳細な設計・閾値・API は `docs/EMBEDDING_GRADING.md` を参照してください。
