#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
docs/csv/*.csv を frontend/src/data/*CSV.ts に変換し、csvLoaderService.ts のバンドル部分を更新する。

対応フォーマットは docs/問題集生成_CSV指示書.md（リポジトリ直下 docs）に準拠:
  推奨: question_text,question_type,option_1..option_4,correct_answer,explanation,
        difficulty,category,subcategory1,subcategory2
  後方互換: ... options,correct_answer,...（options 1セルに4択をカンマ連結）

使い方:
  python scripts/convert_csv_to_ts.py              # 変換 + csvLoaderService 更新
  python scripts/convert_csv_to_ts.py --validate-only
  python scripts/convert_csv_to_ts.py --no-service # *CSV.ts のみ生成
  python scripts/convert_csv_to_ts.py --strict     # 警告も失敗扱い

表示タイトルは docs/csv/bundle_metadata.json で CSV ファイル名キーごとに上書き可能。
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_DIR = ROOT / "docs" / "csv"
OUTPUT_DIR = ROOT / "frontend" / "src" / "data"
CSV_LOADER_SERVICE = ROOT / "frontend" / "src" / "services" / "csvLoaderService.ts"
METADATA_FILE = CSV_DIR / "bundle_metadata.json"

# csvLoaderService.ts 内の置換範囲（この2行に挟まれたブロックが毎回全置換される）
AUTO_GEN_START = "// --- auto-generated: csv bundle (scripts/convert_csv_to_ts.py) ---"
AUTO_GEN_END = "// --- end auto-generated ---"


def sanitize_filename(filename: str) -> str:
    """
    CSV ファイル名から TS ベース名（小英数+アンダースコア）を生成。
    日本語置換の前後にスペースを入れ、「Learning問題集」→「Learningquestion_set」
    のように単語がくっつく不具合を防ぐ。
    """
    name = filename.replace(".csv", "").replace(".CSV", "")
    mappings = [
        ("E資格", "e_qualification"),
        ("問題集", "question_set"),
        ("資格", "qualification"),
        ("問題", "question"),
    ]
    for jp, en in mappings:
        name = name.replace(jp, f" {en} ")
    name = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    name = re.sub(r"_+", "_", name)
    name = name.strip("_")
    if name and name[0].isdigit():
        name = "_" + name
    return name or "csv"


def to_pascal_var_name(sanitized: str) -> str:
    parts = [p for p in sanitized.split("_") if p]
    return "".join((p[:1].upper() + p[1:]) if p else "" for p in parts)


def load_bundle_metadata() -> dict[str, dict[str, str]]:
    if not METADATA_FILE.is_file():
        return {}
    try:
        raw = json.loads(METADATA_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"[ERROR] bundle_metadata.json: {e}", file=sys.stderr)
        sys.exit(1)
    return raw if isinstance(raw, dict) else {}


def default_title_from_stem(stem: str) -> str:
    return stem.replace("_", " ").strip() or stem


def get_bundle_labels(
    csv_filename: str, stem: str, meta: dict[str, dict[str, str]]
) -> tuple[str, str]:
    entry = meta.get(csv_filename)
    if isinstance(entry, dict):
        title = (entry.get("title") or "").strip()
        desc = (entry.get("description") or "").strip()
        if title:
            return title, desc or title
    t = default_title_from_stem(stem)
    return t, t


def validate_question_csv(
    csv_path: Path, *, strict: bool
) -> tuple[bool, list[str], list[str]]:
    """
    指示書に沿ったヘッダーを検査。戻り値: (ok, errors, warnings)
    """
    errors: list[str] = []
    warnings: list[str] = []

    raw = csv_path.read_text(encoding="utf-8-sig")
    if not raw.strip():
        errors.append("ファイルが空です")
        return False, errors, warnings

    reader = csv.reader(io.StringIO(raw))
    try:
        header = next(reader)
    except StopIteration:
        errors.append("ヘッダーがありません")
        return False, errors, warnings

    headers = [h.strip() for h in header]
    header_set = set(headers)

    if "question_text" not in header_set:
        errors.append("必須列 question_text がありません")
    if "correct_answer" not in header_set:
        errors.append("必須列 correct_answer がありません")

    has_quad = all(f"option_{i}" in header_set for i in (1, 2, 3, 4))
    has_options = "options" in header_set

    if not has_quad and not has_options:
        warnings.append(
            "option_1..4 も options 列もありません（短文・記述のみのデッキなら可）"
        )

    if has_quad and has_options:
        warnings.append("option_1..4 と options の両方があります（意図どおりか確認）")

    for col in ("explanation", "difficulty", "category"):
        if col not in header_set:
            warnings.append(f"推奨列 {col} がありません")

    for col in ("subcategory1", "subcategory2"):
        if col not in header_set:
            warnings.append(f"推奨列 {col} がありません（指示書の完全形では推奨）")

    data_rows = sum(1 for row in reader if any((c or "").strip() for c in row))
    if data_rows == 0:
        warnings.append("データ行が1行もありません")

    if strict and warnings:
        errors.extend(warnings)
        warnings = []

    ok = not errors
    return ok, errors, warnings


def convert_csv_to_ts(csv_path: Path, var_name: str, ts_basename: str) -> None:
    content = csv_path.read_text(encoding="utf-8")
    out = OUTPUT_DIR / f"{ts_basename}CSV.ts"
    body = f"export const {var_name} = `\n{content}`;\n"
    out.write_text(body, encoding="utf-8")


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


def render_auto_generated_block(rows: list[dict]) -> str:
    """rows: dict with keys var_name, ts_basename, file_name, title, description"""
    dest = ",\n".join(f"      {{ {r['var_name']} }}" for r in rows)
    imps = ",\n".join(
        f'      import("../data/{r["ts_basename"]}CSV")' for r in rows
    )

    entries = []
    for r in rows:
        entries.append(
            "      {\n"
            f'        fileName: "{ts_escape(r["file_name"])}",\n'
            f'        title: "{ts_escape(r["title"])}",\n'
            f'        description: "{ts_escape(r["description"])}",\n'
            f'        csvContent: {r["var_name"]},\n'
            "      },"
        )

    return (
        f"    {AUTO_GEN_START}\n"
        f"    const [\n{dest},\n"
        f"    ] = await Promise.all([\n{imps},\n"
        f"    ]);\n\n"
        f"    const CSV_FILES: CSVFile[] = [\n"
        + "\n".join(entries)
        + "\n    ];\n"
        f"    {AUTO_GEN_END}\n"
    )


def patch_csv_loader_service(block: str) -> None:
    text = CSV_LOADER_SERVICE.read_text(encoding="utf-8")
    if AUTO_GEN_START not in text or AUTO_GEN_END not in text:
        print(
            "[ERROR] csvLoaderService.ts に自動生成マーカーがありません。\n"
            f"  期待: {AUTO_GEN_START} ... {AUTO_GEN_END}",
            file=sys.stderr,
        )
        sys.exit(1)

    pre, rest = text.split(AUTO_GEN_START, 1)
    _mid, post = rest.split(AUTO_GEN_END, 1)
    # マーカー行の直前に残ったインデントと連結すると二重インデントになるため除去
    pre = pre.rstrip() + "\n\n"
    post = post.lstrip("\n\r")
    new_text = pre + block + post
    CSV_LOADER_SERVICE.write_text(new_text, encoding="utf-8")


def collect_csv_tasks(meta: dict[str, dict[str, str]]) -> list[dict]:
    paths = sorted(CSV_DIR.glob("*.csv"), key=lambda p: p.name.lower())
    rows: list[dict] = []
    for path in paths:
        if path.name == "bundle_metadata.json":
            continue
        fname = path.name
        stem = path.stem
        sanitized = sanitize_filename(fname)
        ts_basename = sanitized.lower()
        var_core = to_pascal_var_name(sanitized)
        var_name = f"{var_core}_CSV"
        title, description = get_bundle_labels(fname, stem, meta)
        rows.append(
            {
                "path": path,
                "file_name": fname,
                "ts_basename": ts_basename,
                "var_name": var_name,
                "title": title,
                "description": description,
            }
        )
    return rows


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="Convert docs/csv to bundled TS modules.")
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="検証のみ（ファイルは書き換えない）",
    )
    parser.add_argument(
        "--no-service",
        action="store_true",
        help="csvLoaderService.ts を更新しない",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="警告をエラー扱いにする",
    )
    args = parser.parse_args()

    if not CSV_DIR.is_dir():
        print(f"[ERROR] {CSV_DIR} がありません", file=sys.stderr)
        sys.exit(1)

    meta = load_bundle_metadata()
    tasks = collect_csv_tasks(meta)

    print("CSV to TypeScript (問題集フォーマット検証付き)")
    print("=" * 60)

    exit_code = 0
    for task in tasks:
        path: Path = task["path"]
        ok, errs, warns = validate_question_csv(path, strict=args.strict)
        label = path.name
        if not ok:
            print(f"[FAIL] {label}")
            for e in errs:
                print(f"       エラー: {e}")
            exit_code = 1
        else:
            print(f"[ OK ] {label}")
        for w in warns:
            print(f"       警告: {w}")

    if args.validate_only:
        sys.exit(exit_code)

    if exit_code != 0:
        print("\n検証エラーのため変換を中止しました。", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    out_rows = []
    for task in tasks:
        path = task["path"]
        convert_csv_to_ts(path, task["var_name"], task["ts_basename"])
        print(f"  -> {OUTPUT_DIR / (task['ts_basename'] + 'CSV.ts')}")
        out_rows.append(
            {
                "var_name": task["var_name"],
                "ts_basename": task["ts_basename"],
                "file_name": task["file_name"],
                "title": task["title"],
                "description": task["description"],
            }
        )

    if not args.no_service:
        block = render_auto_generated_block(out_rows)
        patch_csv_loader_service(block)
        print(f"\n更新: {CSV_LOADER_SERVICE}")

    print("=" * 60)
    print(f"完了: {len(tasks)} ファイル")


if __name__ == "__main__":
    main()
