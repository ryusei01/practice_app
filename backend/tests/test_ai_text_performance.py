"""
AIテキストタブ相当の `POST /api/v1/ai/generate-from-text` の性能テスト。

- Ollama をモックしたときのエンドツーエンド応答時間（サーバ側のオーバーヘッド上限）
- `_parse_quiz_csv` の大量行パース時間（LLM 出力想定より大きい負荷でも許容範囲か）

実 LLM 計測は環境依存のため `RUN_AI_TEXT_LIVE_PERF=1` のときのみ任意実行。
"""
import os
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
    sys.path.insert(0, str(backend))

from app.api.ai_llm import _parse_quiz_csv  # noqa: E402

SAMPLE_LLM_CSV = """question_text,question_type,option_1,option_2,option_3,option_4,correct_answer,explanation,difficulty,category
What is 2+2?,multiple_choice,3,4,5,6,2,Because 2+2=4,0.5,math
Capital of France?,multiple_choice,London,Berlin,Paris,Madrid,3,Paris is the capital.,0.4,geo
"""


def _mock_ollama_client():
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"response": SAMPLE_LLM_CSV}

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


class TestParseQuizCsvPerformance:
    """パースのみ（LLM なし）のボトルネック検知。"""

    def test_parse_many_rows_under_threshold(self):
        header = (
            "question_text,question_type,option_1,option_2,option_3,option_4,"
            "correct_answer,explanation,difficulty,category"
        )
        lines = [header]
        for i in range(400):
            lines.append(
                f'"Q{i}?",multiple_choice,A{i},B{i},C{i},D{i},1,exp,0.5,cat'
            )
        blob = "\n".join(lines)

        t0 = time.perf_counter()
        out = _parse_quiz_csv(blob)
        elapsed = time.perf_counter() - t0

        assert len(out) == 400
        assert elapsed < 1.0, f"parse took {elapsed:.3f}s, expected < 1.0s"


class TestGenerateFromTextEndpointPerformance:
    """モック LLM 時の HTTP 経路の応答時間。"""

    def test_endpoint_under_threshold_with_mock_ollama(self):
        from fastapi.testclient import TestClient
        from app.main import app

        mock_client = _mock_ollama_client()
        with patch("app.api.ai_llm.httpx.AsyncClient", return_value=mock_client):
            client = TestClient(app)
            t0 = time.perf_counter()
            r = client.post(
                "/api/v1/ai/generate-from-text",
                json={
                    "text": "This is sample text for the quiz. " * 20,
                    "count": 3,
                    "content_language": "en",
                },
            )
            elapsed = time.perf_counter() - t0

        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] >= 1
        assert elapsed < 5.0, f"endpoint took {elapsed:.3f}s with mock Ollama (expected < 5s)"


@pytest.mark.skipif(
    os.environ.get("RUN_AI_TEXT_LIVE_PERF") != "1",
    reason="実 Ollama への接続が必要。計測する場合は RUN_AI_TEXT_LIVE_PERF=1",
)
def test_live_ollama_latency_if_enabled():
    """ローカルで Ollama が起動しているときの実レイテンシ（任意）。"""
    import httpx
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.config import settings

    try:
        r0 = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        r0.raise_for_status()
    except Exception as e:
        pytest.skip(f"Ollama not reachable: {e}")

    client = TestClient(app)
    t0 = time.perf_counter()
    r = client.post(
        "/api/v1/ai/generate-from-text",
        json={
            "text": "Photosynthesis is how plants make energy from light. " * 5,
            "count": 2,
            "content_language": "en",
        },
    )
    elapsed = time.perf_counter() - t0

    assert r.status_code == 200, r.text
    print(f"\n[live] generate-from-text: {elapsed:.2f}s model={settings.OLLAMA_TEXT_GENERATION_MODEL}")
    assert elapsed < 180.0, "120s LLM timeout + margin; 実環境で異常に遅い場合は失敗"
