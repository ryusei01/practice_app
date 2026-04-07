"""
.apkg インポート（import_apkg）のユニットテスト。

最小構成の ZIP + collection.anki21（SQLite）を生成し、
パース結果と `POST /api/v1/question-sets/parse-anki` のスモークテストを行う。
"""
import io
import json
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path

import pytest

backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
    sys.path.insert(0, str(backend))

from app.services import anki_importer


def _write_minimal_collection_anki21(db_path: Path, *, deck_name: str, front: str, back: str) -> int:
    """.apkg 内 collection DB 互換の最小 SQLite（importer が参照する列のみ）を書き出す。"""
    mid = 9876543210001
    decks = {
        "1": {
            "id": 1,
            "name": "Default",
            "desc": "",
            "extended": {},
        },
        "2": {
            "id": 2,
            "name": deck_name,
            "desc": "",
            "extended": {},
        },
    }
    models = {
        str(mid): {
            "id": mid,
            "name": "Basic",
            "flds": [{"name": "Front"}, {"name": "Back"}],
        }
    }
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(
            "CREATE TABLE col (id INTEGER PRIMARY KEY, decks TEXT NOT NULL, models TEXT NOT NULL);"
        )
        conn.execute(
            "INSERT INTO col (id, decks, models) VALUES (1, ?, ?);",
            (json.dumps(decks), json.dumps(models)),
        )
        conn.execute(
            "CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER NOT NULL, flds TEXT NOT NULL, tags TEXT NOT NULL);"
        )
        flds = f"{front}\x1f{back}"
        conn.execute(
            "INSERT INTO notes (id, mid, flds, tags) VALUES (1, ?, ?, '');",
            (mid, flds),
        )
        conn.commit()
    finally:
        conn.close()
    return mid


def build_minimal_apkg(apkg_path: Path) -> None:
    """1 枚の Basic カードを含む .apkg（ZIP）を生成する。"""
    with tempfile.TemporaryDirectory() as td:
        tdir = Path(td)
        db_file = tdir / "collection.anki21"
        _write_minimal_collection_anki21(
            db_file,
            deck_name="UnitTestDeck",
            front="What is 2+2?",
            back="4",
        )
        with zipfile.ZipFile(apkg_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(db_file, "collection.anki21")
            zf.writestr("media", "{}")


class TestImportApkg:
    def test_import_basic_card(self, tmp_path: Path):
        apkg = tmp_path / "minimal.apkg"
        build_minimal_apkg(apkg)
        result = anki_importer.import_apkg(str(apkg), "test_creator_id")
        assert result["title"] == "UnitTestDeck"
        assert len(result["questions"]) == 1
        q = result["questions"][0]
        assert q["question_text"] == "What is 2+2?"
        assert q["correct_answer"] == "4"
        assert q["question_type"] == "text_input"
        assert q["options"] is None

    def test_invalid_zip_raises(self, tmp_path: Path):
        bad = tmp_path / "not.zip"
        bad.write_bytes(b"not a zip")
        with pytest.raises(zipfile.BadZipFile):
            anki_importer.import_apkg(str(bad), "u1")

    def test_zip_without_collection_raises(self, tmp_path: Path):
        empty = tmp_path / "empty.apkg"
        with zipfile.ZipFile(empty, "w") as zf:
            zf.writestr("readme.txt", "x")
        with pytest.raises(ValueError, match="No collection database"):
            anki_importer.import_apkg(str(empty), "u1")

    def test_strip_html_basic(self, tmp_path: Path):
        apkg = tmp_path / "html.apkg"
        with tempfile.TemporaryDirectory() as td:
            tdir = Path(td)
            db_file = tdir / "collection.anki21"
            _write_minimal_collection_anki21(
                db_file,
                deck_name="HtmlDeck",
                front="<b>Hello</b>",
                back="<div>World</div>",
            )
            with zipfile.ZipFile(apkg, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.write(db_file, "collection.anki21")
                zf.writestr("media", "{}")
        result = anki_importer.import_apkg(str(apkg), "u1")
        assert result["questions"][0]["question_text"] == "Hello"
        assert result["questions"][0]["correct_answer"] == "World"


def test_parse_anki_api_smoke():
    """FastAPI TestClient で /parse-anki の HTTP 経路を確認する。"""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    buf = io.BytesIO()
    with tempfile.TemporaryDirectory() as td:
        tdir = Path(td)
        db_file = tdir / "collection.anki21"
        _write_minimal_collection_anki21(
            db_file,
            deck_name="ApiDeck",
            front="Q",
            back="A",
        )
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(db_file, "collection.anki21")
            zf.writestr("media", "{}")
    buf.seek(0)
    r = client.post(
        "/api/v1/question-sets/parse-anki",
        files={"file": ("test.apkg", buf, "application/octet-stream")},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["title"] == "ApiDeck"
    assert data["total"] >= 1
