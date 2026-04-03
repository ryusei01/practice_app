"""
Anki .apkg file importer.

.apkg is a ZIP archive containing:
  - collection.anki2 or collection.anki21 (SQLite database)
  - media (JSON mapping: {"0": "filename.jpg", "1": "audio.mp3", ...})
  - numbered media files (0, 1, 2, ...)
"""
import json
import os
import re
import shutil
import sqlite3
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import Any

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

CLOZE_PATTERN = re.compile(r"\{\{c\d+::(.*?)(?:::.*)?\}\}")
IMG_PATTERN = re.compile(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>', re.IGNORECASE)
SOUND_PATTERN = re.compile(r"\[sound:([^\]]+)\]")
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    text = text.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    text = HTML_TAG_PATTERN.sub("", text)
    return text.strip()


def _extract_media_refs(text: str) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for m in IMG_PATTERN.finditer(text):
        refs.append({"type": "image", "filename": m.group(1)})
    for m in SOUND_PATTERN.finditer(text):
        refs.append({"type": "audio", "filename": m.group(1)})
    return refs


def _remove_media_tags(text: str) -> str:
    text = IMG_PATTERN.sub("", text)
    text = SOUND_PATTERN.sub("", text)
    return text.strip()


def import_apkg(
    apkg_path: str,
    creator_id: str,
) -> dict[str, Any]:
    """
    Parse an .apkg file and return structured data for DB insertion.

    Returns:
        {
            "title": str (deck name),
            "questions": [
                {
                    "question_text": str,
                    "correct_answer": str,
                    "question_type": str,
                    "options": list | None,
                    "media_urls": list | None,
                    "tags": list[str],
                }
            ]
        }
    """
    tmpdir = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(apkg_path, "r") as zf:
            zf.extractall(tmpdir)

        # Find SQLite DB
        db_path = None
        for name in ("collection.anki21", "collection.anki2"):
            candidate = os.path.join(tmpdir, name)
            if os.path.exists(candidate):
                db_path = candidate
                break
        if not db_path:
            raise ValueError("No collection database found in .apkg")

        # Load media mapping
        media_map: dict[str, str] = {}
        media_json_path = os.path.join(tmpdir, "media")
        if os.path.exists(media_json_path):
            with open(media_json_path, "r", encoding="utf-8") as f:
                media_map = json.load(f)

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        # Get deck name from col table
        deck_name = "Imported from Anki"
        try:
            col_row = conn.execute("SELECT decks FROM col").fetchone()
            if col_row:
                decks = json.loads(col_row["decks"])
                for dk in decks.values():
                    if dk.get("name") and dk["name"] != "Default":
                        deck_name = dk["name"]
                        break
        except Exception:
            pass

        # Get models (note types)
        models: dict[int, dict] = {}
        try:
            col_row = conn.execute("SELECT models FROM col").fetchone()
            if col_row:
                models = {int(k): v for k, v in json.loads(col_row["models"]).items()}
        except Exception:
            pass

        # Read notes
        notes = conn.execute("SELECT id, mid, flds, tags FROM notes").fetchall()
        conn.close()

        # A temporary question set ID for organizing media
        temp_set_id = str(uuid.uuid4())

        questions = []
        for note in notes:
            mid = note["mid"]
            fields = note["flds"].split("\x1f")
            tags_str = note["tags"].strip() if note["tags"] else ""
            note_tags = [t for t in tags_str.split() if t]

            model = models.get(mid, {})
            model_name = model.get("name", "").lower()

            if len(fields) < 2:
                continue

            front_raw = fields[0]
            back_raw = fields[1]

            front_media = _extract_media_refs(front_raw)
            back_media = _extract_media_refs(back_raw)

            front_text = _strip_html(_remove_media_tags(front_raw))
            back_text = _strip_html(_remove_media_tags(back_raw))

            if not front_text and not back_text:
                continue

            # Process media files
            media_urls = []
            for ref in front_media:
                saved = _save_media_file(tmpdir, media_map, ref["filename"], temp_set_id)
                if saved:
                    media_urls.append({"type": ref["type"], "url": saved, "position": "question"})
            for ref in back_media:
                saved = _save_media_file(tmpdir, media_map, ref["filename"], temp_set_id)
                if saved:
                    media_urls.append({"type": ref["type"], "url": saved, "position": "answer"})

            # Handle Cloze
            if "cloze" in model_name or CLOZE_PATTERN.search(front_raw):
                cloze_matches = list(CLOZE_PATTERN.finditer(front_raw))
                if cloze_matches:
                    clean_front = _strip_html(_remove_media_tags(front_raw))
                    for cm in cloze_matches:
                        answer = cm.group(1)
                        q_text = CLOZE_PATTERN.sub("___", clean_front, count=1)
                        questions.append({
                            "question_text": q_text,
                            "correct_answer": answer,
                            "question_type": "text_input",
                            "options": None,
                            "media_urls": media_urls or None,
                            "tags": note_tags,
                        })
                    continue

            # Standard card
            questions.append({
                "question_text": front_text,
                "correct_answer": back_text,
                "question_type": "text_input",
                "options": None,
                "media_urls": media_urls or None,
                "tags": note_tags,
            })

            # Reversed card (Basic and reversed)
            if "reverse" in model_name and len(fields) >= 2:
                questions.append({
                    "question_text": back_text,
                    "correct_answer": front_text,
                    "question_type": "text_input",
                    "options": None,
                    "media_urls": media_urls or None,
                    "tags": note_tags,
                })

        return {
            "title": deck_name,
            "questions": questions,
        }

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _save_media_file(
    tmpdir: str,
    media_map: dict[str, str],
    filename: str,
    question_set_id: str,
) -> str | None:
    """Find a media file in the extracted apkg and copy it to uploads/. Returns the URL path or None."""
    # Find the file: media_map maps number -> filename
    source_path = None

    # Try direct filename in tmpdir
    candidate = os.path.join(tmpdir, filename)
    if os.path.exists(candidate):
        source_path = candidate
    else:
        # Look up in media_map (reverse: filename -> number)
        for num, mapped_name in media_map.items():
            if mapped_name == filename:
                num_path = os.path.join(tmpdir, str(num))
                if os.path.exists(num_path):
                    source_path = num_path
                    break

    if not source_path:
        return None

    file_id = str(uuid.uuid4())
    ext = os.path.splitext(filename)[1].lower() or ".bin"
    dest_dir = UPLOADS_DIR / question_set_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{file_id}{ext}"
    shutil.copy2(source_path, dest)

    return f"/uploads/{question_set_id}/{file_id}{ext}"
