"""
AI関連のAPIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..core.database import get_db
from ..ai import QuestionRecommender, ScorePredictor
from pydantic import BaseModel

router = APIRouter()


class RecommendationRequest(BaseModel):
    user_id: str
    question_set_id: str
    count: int = 10
    target_difficulty: Optional[float] = None


class RecommendationResponse(BaseModel):
    question_ids: List[str]
    count: int


class ScorePredictionRequest(BaseModel):
    user_id: str
    question_set_id: Optional[str] = None
    max_score: int = 100


@router.post("/recommend", response_model=RecommendationResponse)
async def recommend_questions(
    request: RecommendationRequest,
    db: Session = Depends(get_db)
):
    """
    AIによる問題推薦

    ユーザーの回答履歴から最適な問題を選定して返す
    """
    recommender = QuestionRecommender(db)

    try:
        question_ids = recommender.recommend_questions(
            user_id=request.user_id,
            question_set_id=request.question_set_id,
            count=request.count,
            target_difficulty=request.target_difficulty
        )

        return RecommendationResponse(
            question_ids=question_ids,
            count=len(question_ids)
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict-score")
async def predict_score(
    request: ScorePredictionRequest,
    db: Session = Depends(get_db)
):
    """
    AIによる予想スコア算出

    ユーザーの回答履歴から今受験したら取れそうなスコアを予測
    """
    predictor = ScorePredictor(db)

    try:
        prediction = predictor.predict_score(
            user_id=request.user_id,
            question_set_id=request.question_set_id,
            max_score=request.max_score
        )

        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/category-predictions/{user_id}")
async def get_category_predictions(
    user_id: str,
    max_score: int = 100,
    db: Session = Depends(get_db)
):
    """
    カテゴリ別の予想スコアを取得
    """
    predictor = ScorePredictor(db)

    try:
        predictions = predictor.get_category_predictions(
            user_id=user_id,
            max_score=max_score
        )
        return predictions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/improvement-suggestions/{user_id}")
async def get_improvement_suggestions(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    学習改善の提案を取得
    """
    predictor = ScorePredictor(db)

    try:
        suggestions = predictor.get_improvement_suggestions(user_id=user_id)
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/adaptive-difficulty/{user_id}/{category}")
async def get_adaptive_difficulty(
    user_id: str,
    category: str,
    db: Session = Depends(get_db)
):
    """
    次の問題の推奨難易度を取得（適応型学習）
    """
    recommender = QuestionRecommender(db)

    try:
        difficulty = recommender.get_next_adaptive_difficulty(
            user_id=user_id,
            category=category
        )
        return {
            "category": category,
            "recommended_difficulty": difficulty
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
