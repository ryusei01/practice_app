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
from ..core.auth import get_current_active_user
from ..models import Answer, User, QuestionSet, Question
from ..ai import StatsUpdater
from ..services.ai_evaluator import evaluate_text_answer
from typing import List

router = APIRouter()


class SubmitAnswerRequest(BaseModel):
    user_id: str
    question_id: str
    user_answer: str
    is_correct: bool
    answer_time_sec: float
    session_id: Optional[str] = None


class EvaluateTextAnswerRequest(BaseModel):
    question_id: str
    user_answer: str


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


@router.post("/evaluate-text")
async def evaluate_text_answer_endpoint(
    request: EvaluateTextAnswerRequest,
    db: Session = Depends(get_db)
):
    """
    text_input問題の回答をAIで評価

    完全一致でなくても意味が正しければ正解とする
    """
    try:
        # 問題を取得
        question = db.query(Question).filter(
            Question.id == request.question_id
        ).first()

        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        if question.question_type != "text_input":
            raise HTTPException(
                status_code=400,
                detail="This endpoint is only for text_input questions"
            )

        # AI評価を実行
        evaluation = await evaluate_text_answer(
            question_text=question.question_text,
            correct_answer=question.correct_answer,
            user_answer=request.user_answer,
            explanation=question.explanation
        )

        return evaluation

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


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
    from sqlalchemy import func, Integer

    result = db.query(
        func.count(Answer.id).label("total"),
        func.sum(func.cast(Answer.is_correct, Integer)).label("correct"),
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


class LocalAnswerData(BaseModel):
    question_id: str
    user_answer: str
    is_correct: bool
    answer_time_sec: float
    session_id: Optional[str] = None
    answered_at: str


class LocalQuestionData(BaseModel):
    question_text: str
    question_type: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: Optional[str] = None
    difficulty: float


class LocalQuestionSetData(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    tags: Optional[List[str]] = None
    price: int = 0
    is_published: bool = False
    questions: List[LocalQuestionData] = []


class MigrateLocalDataRequest(BaseModel):
    answers: List[LocalAnswerData] = []
    question_sets: List[LocalQuestionSetData] = []


@router.post("/migrate-local-data")
async def migrate_local_data(
    request: MigrateLocalDataRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    ローカルデータをクラウドに移行

    無料ユーザーが課金してプレミアムになった時に呼び出される
    """
    if not current_user.is_premium:
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required to migrate data to cloud"
        )

    migrated_counts = {
        "answers": 0,
        "question_sets": 0,
        "questions": 0,
    }

    try:
        # 回答データを移行
        for answer_data in request.answers:
            # 既存の回答があるかチェック（重複防止）
            existing = db.query(Answer).filter(
                Answer.user_id == current_user.id,
                Answer.question_id == answer_data.question_id,
                Answer.answered_at == datetime.fromisoformat(answer_data.answered_at)
            ).first()

            if not existing:
                new_answer = Answer(
                    id=str(uuid.uuid4()),
                    user_id=current_user.id,
                    question_id=answer_data.question_id,
                    user_answer=answer_data.user_answer,
                    is_correct=answer_data.is_correct,
                    answer_time_sec=answer_data.answer_time_sec,
                    session_id=answer_data.session_id,
                    answered_at=datetime.fromisoformat(answer_data.answered_at),
                    try_count=1
                )
                db.add(new_answer)
                migrated_counts["answers"] += 1

        # 問題集と問題を移行
        for qs_data in request.question_sets:
            # 既存の問題集があるかチェック（タイトルとカテゴリで重複判定）
            existing_qs = db.query(QuestionSet).filter(
                QuestionSet.creator_id == current_user.id,
                QuestionSet.title == qs_data.title,
                QuestionSet.category == qs_data.category
            ).first()

            if not existing_qs:
                new_qs = QuestionSet(
                    id=str(uuid.uuid4()),
                    title=qs_data.title,
                    description=qs_data.description,
                    category=qs_data.category,
                    tags=qs_data.tags,
                    price=qs_data.price,
                    is_published=qs_data.is_published,
                    creator_id=current_user.id
                )
                db.add(new_qs)
                db.flush()  # IDを取得するため
                migrated_counts["question_sets"] += 1

                # 問題を移行
                for q_data in qs_data.questions:
                    new_question = Question(
                        id=str(uuid.uuid4()),
                        question_set_id=new_qs.id,
                        question_text=q_data.question_text,
                        question_type=q_data.question_type,
                        options=q_data.options,
                        correct_answer=q_data.correct_answer,
                        explanation=q_data.explanation,
                        difficulty=q_data.difficulty
                    )
                    db.add(new_question)
                    migrated_counts["questions"] += 1

        db.commit()

        # 統計を再計算
        if migrated_counts["answers"] > 0:
            stats_updater = StatsUpdater(db)
            stats_updater.recalculate_all_stats(current_user.id)

        return {
            "message": "Data migrated successfully",
            "migrated_counts": migrated_counts
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")
