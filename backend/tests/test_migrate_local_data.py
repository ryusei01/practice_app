"""
POST /api/v1/answers/migrate-local-data の振る舞いテスト（インメモリ SQLite）。
"""
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
    sys.path.insert(0, str(backend))

from app.main import app  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.core.auth import get_current_active_user  # noqa: E402
from app.models import User, QuestionSet, Question, Answer  # noqa: E402
from app.models.user import UserRole  # noqa: E402


@pytest.fixture
def memory_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    uid = "migrate-test-user"
    qs_id = str(uuid.uuid4())
    q_id = str(uuid.uuid4())

    db = SessionLocal()
    try:
        db.add(
            User(
                id=uid,
                email="migrate@test.local",
                username="migrateuser",
                is_active=True,
                is_premium=False,
                role=UserRole.USER,
            )
        )
        db.add(
            QuestionSet(
                id=qs_id,
                title="Seed Set",
                category="cat",
                creator_id=uid,
                content_languages=["ja"],
                content_language="ja",
            )
        )
        db.add(
            Question(
                id=q_id,
                question_set_id=qs_id,
                question_text="Q1",
                question_type="multiple_choice",
                correct_answer="A",
                difficulty=0.5,
            )
        )
        db.commit()
    finally:
        db.close()

    def _get_db():
        s = SessionLocal()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _get_db

    client = TestClient(app)
    yield client, uid, q_id

    app.dependency_overrides.clear()


def test_migrate_local_data_forbidden_without_premium(memory_client):
    client, uid, q_id = memory_client
    app.dependency_overrides[get_current_active_user] = lambda: SimpleNamespace(
        id=uid, is_active=True, is_premium=False
    )
    try:
        r = client.post(
            "/api/v1/answers/migrate-local-data",
            json={
                "answers": [
                    {
                        "question_id": q_id,
                        "user_answer": "A",
                        "is_correct": True,
                        "answer_time_sec": 1.0,
                        "session_id": "s1",
                        "answered_at": "2026-04-07T12:00:00",
                    }
                ],
                "question_sets": [],
            },
        )
        assert r.status_code == 403
        assert "Premium" in r.json().get("detail", "")
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


def test_migrate_local_data_inserts_answer_and_question_set(memory_client):
    client, uid, q_id = memory_client
    app.dependency_overrides[get_current_active_user] = lambda: SimpleNamespace(
        id=uid, is_active=True, is_premium=True
    )
    try:
        answered_at = "2026-04-07T15:30:00"
        r = client.post(
            "/api/v1/answers/migrate-local-data",
            json={
                "answers": [
                    {
                        "question_id": q_id,
                        "user_answer": "A",
                        "is_correct": True,
                        "answer_time_sec": 2.5,
                        "session_id": "sess-m1",
                        "answered_at": answered_at,
                    }
                ],
                "question_sets": [
                    {
                        "title": "Local Imported",
                        "description": "d",
                        "category": "math",
                        "tags": ["a", "b"],
                        "price": 0,
                        "is_published": False,
                        "content_language": "ja",
                        "questions": [
                            {
                                "question_text": "2+2",
                                "question_type": "text_input",
                                "options": None,
                                "correct_answer": "4",
                                "explanation": None,
                                "difficulty": 0.3,
                            }
                        ],
                    }
                ],
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["migrated_counts"]["answers"] == 1
        assert body["migrated_counts"]["question_sets"] == 1
        assert body["migrated_counts"]["questions"] == 1

        # 重複送信では同じ answered_at の回答はスキップ
        r2 = client.post(
            "/api/v1/answers/migrate-local-data",
            json={
                "answers": [
                    {
                        "question_id": q_id,
                        "user_answer": "A",
                        "is_correct": True,
                        "answer_time_sec": 2.5,
                        "session_id": "sess-m1",
                        "answered_at": answered_at,
                    }
                ],
                "question_sets": [
                    {
                        "title": "Local Imported",
                        "category": "math",
                        "questions": [],
                    }
                ],
            },
        )
        assert r2.status_code == 200
        assert r2.json()["migrated_counts"]["answers"] == 0
        assert r2.json()["migrated_counts"]["question_sets"] == 0
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)
