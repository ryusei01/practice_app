# CSV to TypeScript Converter

`docs/csv/`ディレクトリ内のCSVファイルを自動的にTypeScriptファイルに変換し、`csvLoaderService.ts`を更新するスクリプトです。

## 使い方

```bash
python scripts/convert_csv_to_ts.py
```

## 機能

1. `docs/csv/`ディレクトリ内のすべてのCSVファイルを検索
2. 各CSVファイルを`frontend/src/data/`ディレクトリにTypeScriptファイルとして変換
3. `frontend/src/services/csvLoaderService.ts`を自動更新
   - インポート文を追加
   - CSV_FILES配列に追加

## ファイル名の変換ルール

- 日本語文字は英語に変換されます（例: `E資格` → `e_qualification`）
- 特殊文字はアンダースコアに置換されます
- 変数名はキャメルケースになります（例: `EQualificationQuestionSet_CSV`）

## 注意事項

- CSVファイルはUTF-8エンコーディングである必要があります
- ファイル名に日本語が含まれる場合、適切に変換されます



