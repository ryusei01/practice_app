#!/usr/bin/env python3
"""
CSVファイルをTypeScriptファイルに変換するスクリプト
docs/csv/ ディレクトリ内のCSVファイルを frontend/src/data/ に変換します
"""

import os
import csv
import re
from pathlib import Path

# ディレクトリパス
CSV_DIR = Path(__file__).parent.parent / "docs" / "csv"
OUTPUT_DIR = Path(__file__).parent.parent / "frontend" / "src" / "data"
CSV_LOADER_SERVICE = Path(__file__).parent.parent / "frontend" / "src" / "services" / "csvLoaderService.ts"

def sanitize_filename(filename: str) -> str:
    """ファイル名をTypeScriptの変数名として使用可能な形式に変換"""
    # 拡張子を削除
    name = filename.replace(".csv", "").replace(".CSV", "")
    
    # 日本語や特殊文字を含む場合のマッピング
    # よく使われるパターンをマッピング
    mappings = {
        'E資格': 'e_qualification',
        '問題集': 'question_set',
        '資格': 'qualification',
        '問題': 'question',
    }
    
    # マッピングを適用
    for jp, en in mappings.items():
        name = name.replace(jp, en)
    
    # 特殊文字をアンダースコアに置換（英数字とアンダースコア以外）
    name = re.sub(r'[^a-zA-Z0-9_]', '_', name)
    # 連続するアンダースコアを1つに
    name = re.sub(r'_+', '_', name)
    # 先頭・末尾のアンダースコアを削除
    name = name.strip('_')
    # 数字で始まる場合はアンダースコアを追加
    if name and name[0].isdigit():
        name = '_' + name
    # 空の場合はデフォルト名
    if not name:
        name = 'csv'
    return name

def to_camel_case(name: str) -> str:
    """スネークケースをキャメルケースに変換（先頭大文字）"""
    parts = name.split('_')
    # 各部分の先頭を大文字に
    camel = ''.join(word.capitalize() for word in parts if word)
    return camel

def convert_csv_to_ts(csv_path: Path) -> tuple[str, str, str]:
    """CSVファイルをTypeScriptの文字列定数に変換"""
    filename = csv_path.name
    sanitized = sanitize_filename(filename)
    var_name = to_camel_case(sanitized) + "_CSV"
    ts_filename = sanitized.lower()
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # TypeScriptファイルの内容を生成
    ts_content = f'export const {var_name} = `\n{content}`;\n'
    
    return var_name, ts_filename, ts_content

def update_csv_loader_service(csv_files: list[tuple[str, str, str, str]]):
    """csvLoaderService.tsを更新"""
    # 既存のファイルを読み込み
    with open(CSV_LOADER_SERVICE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # インポート文を生成
    imports = []
    for var_name, ts_filename, _, _ in csv_files:
        imports.append(f'import {{ {var_name} }} from "../data/{ts_filename}CSV";')
    
    # 既存のインポートを置換
    import_pattern = r'// 全CSVファイルのコンテンツをここにインポート（自動生成）\n(?:import .*? from .*?;\n)*'
    new_imports = "// 全CSVファイルのコンテンツをここにインポート（自動生成）\n" + "\n".join(imports) + "\n"
    content = re.sub(import_pattern, new_imports, content)
    
    # CSV_FILES配列を生成
    csv_files_array = []
    for var_name, _, filename, title in csv_files:
        # タイトルと説明をエスケープ
        title_escaped = title.replace('"', '\\"')
        csv_files_array.append(f"""  {{
    fileName: "{filename}",
    title: "{title_escaped}",
    description: "{title_escaped}",
    csvContent: {var_name},
  }}""")
    
    # CSV_FILES配列を置換
    array_pattern = r'const CSV_FILES: CSVFile\[\] = \[.*?\];'
    new_array = f"const CSV_FILES: CSVFile[] = [\n" + ",\n".join(csv_files_array) + "\n];"
    content = re.sub(array_pattern, new_array, content, flags=re.DOTALL)
    
    # ファイルに書き込み
    with open(CSV_LOADER_SERVICE, 'w', encoding='utf-8') as f:
        f.write(content)

def get_title_from_csv(csv_path: Path) -> str:
    """CSVファイルからタイトルを取得（ファイル名から推測）"""
    filename = csv_path.stem
    # ファイル名を読みやすい形式に変換
    # 例: "E資格_問題集" -> "E資格 問題集"
    title = filename.replace('_', ' ')
    return title

def main():
    """メイン処理"""
    print("CSV to TypeScript Converter")
    print("=" * 50)
    
    # 出力ディレクトリが存在しない場合は作成
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # CSVファイルを検索
    csv_files = []
    csv_data = []
    
    for csv_file in CSV_DIR.glob("*.csv"):
        print(f"Processing: {csv_file.name}")
        
        # CSVをTypeScriptに変換
        var_name, ts_filename, ts_content = convert_csv_to_ts(csv_file)
        title = get_title_from_csv(csv_file)
        output_path = OUTPUT_DIR / f"{ts_filename}CSV.ts"
        
        # TypeScriptファイルを書き込み
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(ts_content)
        
        print(f"  -> Created: {output_path}")
        print(f"     Variable: {var_name}")
        
        csv_files.append((var_name, ts_filename, csv_file.name, title))
        csv_data.append((var_name, ts_filename, csv_file.name, title))
    
    # csvLoaderService.tsを更新
    if csv_data:
        print("\nUpdating csvLoaderService.ts...")
        update_csv_loader_service(csv_data)
        print(f"  -> Updated: {CSV_LOADER_SERVICE}")
    
    print("\n" + "=" * 50)
    print(f"Successfully converted {len(csv_files)} CSV file(s)")

if __name__ == "__main__":
    main()

