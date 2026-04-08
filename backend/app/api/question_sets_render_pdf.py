"""
Trial / local PDF rendering endpoint.

Defined in a separate module so it can be included BEFORE the dynamic
`/{question_set_id}` routes in `question_sets.py`, preventing 405 (Allow: GET)
due to route capture.
"""

import io
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from ..core.limiter import limiter
from ..services.question_set_pdf import build_question_set_pdf_bytes

router = APIRouter()


class RenderPdfQuestion(BaseModel):
    question_text: str = Field(..., min_length=1, max_length=4000)
    question_type: str = Field(..., min_length=1, max_length=40)
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = Field(default=None, max_length=400)
    explanation: Optional[str] = Field(default=None, max_length=8000)

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: Optional[List[str]]):
        if v is None:
            return v
        if len(v) > 20:
            raise ValueError("options too many (max 20)")
        for x in v:
            if x is None:
                continue
            if len(str(x)) > 400:
                raise ValueError("option too long (max 400 chars)")
        return v


class RenderPdfRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=8000)
    questions: List[RenderPdfQuestion] = Field(..., min_length=1, max_length=300)


def _estimate_render_pdf_chars(payload: RenderPdfRequest) -> int:
    total = 0
    total += len(payload.title or "")
    total += len(payload.description or "")
    for q in payload.questions:
        total += len(q.question_text or "")
        total += len(q.question_type or "")
        total += len(q.correct_answer or "")
        total += len(q.explanation or "")
        for opt in (q.options or []):
            total += len(opt or "")
    return total


@router.post("/render-pdf")
@limiter.limit("20/minute")
async def render_pdf_from_payload(
    request: Request,
    payload: RenderPdfRequest,
    include_answers: bool = Query(True, description="解答・解説をPDFに含めるか"),
):
    """
    お試しモード等、サーバーに保存されていない問題データからPDFを生成する（認証不要）。
    """
    if len(payload.questions) > 300:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Too many questions (max 300)",
        )
    total_chars = _estimate_render_pdf_chars(payload)
    if total_chars > 200_000:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Payload too large (max 200,000 characters)",
        )

    pdf_bytes = build_question_set_pdf_bytes(
        title=payload.title or "export",
        description=payload.description,
        questions=[
            {
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
            }
            for q in payload.questions
        ],
        include_answers=include_answers,
    )
    safe_title = (
        "".join(
            c for c in (payload.title or "export") if c.isalnum() or c in " _-"
        ).strip()
        or "export"
    )
    filename = f"{safe_title}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

