"""
回答関連のAPIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
import uuid

from ..core.database import get_db
from ..models import Answer
from ..ai import StatsUpdater

router = APIRouter()


class SubmitAnswerRequest(BaseModel):
    user_id: str
    question_id: str
    user_answer: str
    is_correct: bool
    answer_time_sec: float
    session_id: Optional[str] = None


class AnswerResponse(BaseModel):
    id: str
    user_id: str
    question_id: str
    is_correct: bool
    answer_time_sec: float
    try_count: int
    answered_at: datetime

    class Config:
        from_attributes = True


@router.post("/submit", response_model=AnswerResponse)
async def submit_answer(
    request: SubmitAnswerRequest,
    db: Session = Depends(get_db)
):
    """
    回答を提出

    回答データを保存し、統計情報を更新する
    """
    try:
        # 既存の回答数を確認（try_count計算用）
        previous_answers = db.query(Answer).filter(
            Answer.user_id == request.user_id,
            Answer.question_id == request.question_id
        ).count()

        # 回答を保存
        answer = Answer(
            id=str(uuid.uuid4()),
            user_id=request.user_id,
            question_id=request.question_id,
            user_answer=request.user_answer,
            is_correct=request.is_correct,
            answer_time_sec=request.answer_time_sec,
            try_count=previous_answers + 1,
            session_id=request.session_id or str(uuid.uuid4()),
            answered_at=datetime.utcnow()
        )

        db.add(answer)
        db.commit()
        db.refresh(answer)

        # 統計情報を更新
        stats_updater = StatsUpdater(db)
        stats_updater.update_on_answer(
            user_id=request.user_id,
            question_id=request.question_id,
            is_correct=request.is_correct,
            answer_time_sec=request.answer_time_sec
        )

        return answer

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{user_id}")
async def get_answer_history(
    user_id: str,
    question_set_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    ユーザーの回答履歴を取得
    """
    query = db.query(Answer).filter(Answer.user_id == user_id)

    # 問題集でフィルタ
    if question_set_id:
        from ..models import Question
        query = query.join(Question).filter(
            Question.question_set_id == question_set_id
        )

    # ページネーション
    answers = query.order_by(
        Answer.answered_at.desc()
    ).offset(offset).limit(limit).all()

    total = query.count()

    return {
        "answers": answers,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/stats/{user_id}")
async def get_user_stats(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    ユーザーの全体統計を取得
    """
    from sqlalchemy import func

    result = db.query(
        func.count(Answer.id).label("total"),
        func.sum(func.cast(Answer.is_correct, func.Integer())).label("correct"),
        func.avg(Answer.answer_time_sec).label("avg_time")
    ).filter(Answer.user_id == user_id).first()

    if result.total == 0:
        return {
            "total_attempts": 0,
            "correct_count": 0,
            "correct_rate": 0.0,
            "avg_time_sec": 0.0
        }

    return {
        "total_attempts": result.total,
        "correct_count": result.correct,
        "correct_rate": result.correct / result.total,
        "avg_time_sec": result.avg_time or 0.0
    }


@router.post("/recalculate-stats/{user_id}")
async def recalculate_stats(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    ユーザーの統計を再計算

    データの整合性が崩れた時に使用
    """
    try:
        stats_updater = StatsUpdater(db)
        stats_updater.recalculate_all_stats(user_id)

        return {"message": "Stats recalculated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
