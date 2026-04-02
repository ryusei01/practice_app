# 問題集生成用 CSV 指示書（システムプロンプト用）

以下の仕様に従って、問題集を **CSV 形式**で生成すること。日本語で返答し、**CSV のみ**を出力すること（Markdown や説明文は不要）。

本指示は **このリポジトリの一括登録実装**（バックエンド `bulk_upload`、フロントのサンプル・ヘルプ、同梱 CSV データ）と **列定義を一致**させてある。

---

## 出力形式（必ずこの列順・列名でヘッダーを1行目に書く）

```text
question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category,subcategory1,subcategory2
```

### 後方互換フォーマット（使わないことを推奨）

ヘッダーに `option_1`〜`option_4` がなく **`options` 列だけ**がある旧形式もサーバは解釈できるが、**新規生成では上記の4列形式を使うこと。**

```text
question_text,question_type,options,correct_answer,explanation,difficulty,category,subcategory1,subcategory2
```

- `multiple_choice` のとき: `options` に `"選択肢1,選択肢2,選択肢3,選択肢4"` のように **1セル**でカンマ区切り（カンマを含む選択肢自体は RFC 4180 に従いフィールド全体をダブルクォートで囲む）

---

## 各列の仕様

### 1. question_text

- 問題文（文字列）
- カンマや改行を含む場合は RFC 4180 に従い **ダブルクォートでフィールドを囲む**
- フィールド内の `"` は `""` にエスケープする

### 2. question_type

次のいずれかを英字で書く:

- `multiple_choice`
- `true_false`
- `text_input`

**省略可能。** 省略時のサーバ側の自動判定は次のとおり:

- `option_1`〜`option_4` のいずれかに値がある（または旧形式で `options` が非空）→ `multiple_choice`
- 上記がすべて空 → `text_input`

そのため **`true_false` は必ず `question_type` に `true_false` と明示すること**（省略すると `text_input` 扱いになる）。

### 3. option_1, option_2, option_3, option_4（推奨フォーマット）

- `multiple_choice`: 各列に選択肢を1つずつ。使わない列は空にする
- `true_false` / `text_input`: 4列とも空欄でよい

### 4. correct_answer

- `multiple_choice` → **正解となる選択肢の文字列そのもの**（`option_*` のいずれかと完全一致する表記）
- `true_false` → `true` または `false`（小文字推奨）
- `text_input` → 正解となる文字列

### 5. explanation

- 解説（簡潔・正確。誤情報を書かない）

### 6. difficulty

- **0.0〜1.0** の数値（サーバはこの範囲外を弾く場合がある）
- 目安:
  - 0.1〜0.3: 基礎
  - 0.4〜0.6: 中級
  - 0.7〜1.0: 上級
- 設問全体で難易度をばらけさせること

### 7. category / subcategory1 / subcategory2

- トピック分類（AI・プログラミング・ソフトウェア開発関連で自由に設定してよい）

---

## 生成ルール

1. 出力は **CSV のみ**（コードフェンスや前置き・末尾の注釈は付けない）
2. 各行は **1問**
3. コードやログに **絵文字を使わない**
4. 設問は **AI 開発者が学べる内容**（数学・アルゴリズム・LLM・API・データ処理・フロント・クラウド・評価指標・ベクトル検索など、バランスよく）
5. 曖昧で誤答誘発しやすい設問は避ける

---

## 出力例（推奨フォーマット）

```csv
question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category,subcategory1,subcategory2
What is 2+2?,multiple_choice,2,3,4,5,4,Basic addition,0.2,math,arithmetic,addition
The sky is blue,true_false,,,,,true,Rayleigh scattering makes the sky often appear blue in clear daylight.,0.1,general,nature,sky
Capital of France?,text_input,,,,,Paris,Paris is the capital of France.,0.3,geography,europe,capitals
```

---

## 参考（実装箇所）

CSV 一括登録のパース: `backend/app/api/questions.py`（`bulk_upload_questions`）  
アプリ内のサンプル・ヘルプ: `frontend/app/(app)/question-sets/[id].tsx` など
