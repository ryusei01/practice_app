"""
問題集CRUD APIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, model_validator
from typing import List, Optional
import uuid

from ..core.database import get_db
from ..core.auth import get_current_active_user
from ..models import User, QuestionSet, Purchase, Question

router = APIRouter()


class QuestionSetCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    tags: Optional[List[str]] = None
    price: int = 0
    is_published: bool = False
    textbook_path: Optional[str] = None
    textbook_type: Optional[str] = None


class QuestionSetUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    price: Optional[int] = None
    is_published: Optional[bool] = None
    textbook_path: Optional[str] = None
    textbook_type: Optional[str] = None


class QuestionSetResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    category: str
    tags: Optional[List[str]]
    price: int
    is_published: bool
    creator_id: str
    total_questions: int = 0
    average_difficulty: float = 0.5
    total_purchases: int = 0
    average_rating: float = 0.0
    textbook_path: Optional[str] = None
    textbook_type: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def convert_nulls(cls, data):
        if isinstance(data, dict):
            return data
        # ORM object
        if hasattr(data, '__dict__'):
            result = {}
            for key in ['id', 'title', 'description', 'category', 'tags', 'price', 'is_published', 'creator_id',
                       'total_questions', 'average_difficulty', 'total_purchases', 'average_rating',
                       'textbook_path', 'textbook_type']:
                val = getattr(data, key, None)
                if key in ['total_questions', 'total_purchases'] and val is None:
                    result[key] = 0
                elif key == 'average_difficulty' and val is None:
                    result[key] = 0.5
                elif key == 'average_rating' and val is None:
                    result[key] = 0.0
                else:
                    result[key] = val
            return result
        return data

    class Config:
        from_attributes = True


@router.post("/", response_model=QuestionSetResponse, status_code=status.HTTP_201_CREATED)
async def create_question_set(
    request: QuestionSetCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    新規問題集を作成

    Args:
        request: 問題集作成リクエスト
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        作成された問題集
    """
    new_question_set = QuestionSet(
        id=str(uuid.uuid4()),
        title=request.title,
        description=request.description,
        category=request.category,
        tags=request.tags,
        price=request.price,
        is_published=request.is_published,
        creator_id=current_user.id,
        textbook_path=request.textbook_path,
        textbook_type=request.textbook_type
    )

    db.add(new_question_set)
    db.commit()
    db.refresh(new_question_set)

    return new_question_set


@router.get("/", response_model=List[QuestionSetResponse])
async def list_question_sets(
    category: Optional[str] = Query(None, description="カテゴリでフィルタ"),
    is_published: Optional[bool] = Query(None, description="公開状態でフィルタ"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    問題集一覧を取得

    Args:
        category: カテゴリフィルタ
        is_published: 公開状態フィルタ
        skip: スキップ数
        limit: 取得数上限
        db: データベースセッション

    Returns:
        問題集のリスト
    """
    query = db.query(QuestionSet)

    if category:
        query = query.filter(QuestionSet.category == category)
    if is_published is not None:
        query = query.filter(QuestionSet.is_published == is_published)

    question_sets = query.offset(skip).limit(limit).all()

    # NULL値を安全に処理
    result = []
    for qs in question_sets:
        result.append({
            "id": qs.id,
            "title": qs.title,
            "description": qs.description,
            "category": qs.category,
            "tags": qs.tags,
            "price": qs.price,
            "is_published": qs.is_published,
            "creator_id": qs.creator_id,
            "total_questions": qs.total_questions if qs.total_questions is not None else 0,
            "average_difficulty": qs.average_difficulty if qs.average_difficulty is not None else 0.5,
            "total_purchases": qs.total_purchases if qs.total_purchases is not None else 0,
            "average_rating": qs.average_rating if qs.average_rating is not None else 0.0
        })

    return result


@router.get("/my/question-sets", response_model=List[QuestionSetResponse])
async def get_my_question_sets(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    自分が作成した問題集一覧を取得

    Args:
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        自分が作成した問題集のリスト
    """
    print(f"[QuestionSets] get_my_question_sets called by user: {current_user.id}")
    try:
        question_sets = db.query(QuestionSet).filter(
            QuestionSet.creator_id == current_user.id
        ).all()
        print(f"[QuestionSets] Found {len(question_sets)} question sets")
    except Exception as e:
        print(f"[QuestionSets] Database query failed: {e}")
        raise

    # NULL値を安全に処理
    result = []
    for qs in question_sets:
        result.append({
            "id": qs.id,
            "title": qs.title,
            "description": qs.description,
            "category": qs.category,
            "tags": qs.tags,
            "price": qs.price,
            "is_published": qs.is_published,
            "creator_id": qs.creator_id,
            "total_questions": qs.total_questions if qs.total_questions is not None else 0,
            "average_difficulty": qs.average_difficulty if qs.average_difficulty is not None else 0.5,
            "total_purchases": qs.total_purchases if qs.total_purchases is not None else 0,
            "average_rating": qs.average_rating if qs.average_rating is not None else 0.0,
            "textbook_path": qs.textbook_path,
            "textbook_type": qs.textbook_type
        })

    return result


@router.get("/purchased", response_model=List[QuestionSetResponse])
async def get_purchased_question_sets(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    購入済みの問題集一覧を取得

    Returns:
        購入した問題集のリスト
    """
    print(f"[QuestionSets] get_purchased_question_sets called by user: {current_user.id}")
    try:
        # 購入済みの問題集IDを取得
        purchases = db.query(Purchase).filter(
            Purchase.buyer_id == current_user.id
        ).all()
        print(f"[QuestionSets] Found {len(purchases)} purchases")

        purchased_ids = [p.question_set_id for p in purchases]

        if not purchased_ids:
            return []

        # 問題集を取得
        question_sets = db.query(QuestionSet).filter(
            QuestionSet.id.in_(purchased_ids)
        ).all()
        print(f"[QuestionSets] Found {len(question_sets)} purchased question sets")
    except Exception as e:
        print(f"[QuestionSets] Database query failed: {e}")
        raise

    result = []
    for qs in question_sets:
        result.append({
            "id": qs.id,
            "title": qs.title,
            "description": qs.description,
            "category": qs.category,
            "tags": qs.tags,
            "price": qs.price,
            "is_published": qs.is_published,
            "creator_id": qs.creator_id,
            "total_questions": qs.total_questions if qs.total_questions is not None else 0,
            "average_difficulty": qs.average_difficulty if qs.average_difficulty is not None else 0.5,
            "total_purchases": qs.total_purchases if qs.total_purchases is not None else 0,
            "average_rating": qs.average_rating if qs.average_rating is not None else 0.0,
            "textbook_path": qs.textbook_path,
            "textbook_type": qs.textbook_type
        })

    return result


@router.get("/{question_set_id}", response_model=QuestionSetResponse)
async def get_question_set(
    question_set_id: str,
    db: Session = Depends(get_db)
):
    """
    問題集の詳細を取得

    Args:
        question_set_id: 問題集ID
        db: データベースセッション

    Returns:
        問題集の詳細

    Raises:
        HTTPException: 問題集が見つからない場合
    """
    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    return question_set


@router.put("/{question_set_id}", response_model=QuestionSetResponse)
async def update_question_set(
    question_set_id: str,
    request: QuestionSetUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    問題集を更新

    Args:
        question_set_id: 問題集ID
        request: 更新リクエスト
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        更新された問題集

    Raises:
        HTTPException: 問題集が見つからない、または権限がない場合
    """
    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    # 作成者のみ編集可能
    if question_set.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この問題集を編集する権限がありません"
        )

    # 更新処理
    if request.title is not None:
        question_set.title = request.title
    if request.description is not None:
        question_set.description = request.description
    if request.category is not None:
        question_set.category = request.category
    if request.tags is not None:
        question_set.tags = request.tags
    if request.price is not None:
        question_set.price = request.price
    if request.is_published is not None:
        question_set.is_published = request.is_published
    if request.textbook_path is not None:
        question_set.textbook_path = request.textbook_path
    if request.textbook_type is not None:
        question_set.textbook_type = request.textbook_type

    db.commit()
    db.refresh(question_set)

    return question_set


@router.delete("/{question_set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question_set(
    question_set_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    問題集を削除

    Args:
        question_set_id: 問題集ID
        current_user: 現在のユーザー
        db: データベースセッション

    Raises:
        HTTPException: 問題集が見つからない、または権限がない場合
    """
    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    # 作成者のみ削除可能
    if question_set.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この問題集を削除する権限がありません"
        )

    db.delete(question_set)
    db.commit()

    return None


class QuestionResponse(BaseModel):
    id: str
    question_set_id: str
    question_text: str
    question_type: str
    options: Optional[List[str]]
    correct_answer: str
    explanation: Optional[str]
    difficulty: float

    class Config:
        from_attributes = True


class QuestionSetWithQuestionsResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    category: str
    tags: Optional[List[str]]
    price: int
    is_published: bool
    creator_id: str
    questions: List[QuestionResponse]

    class Config:
        from_attributes = True


@router.get("/{question_set_id}/download", response_model=QuestionSetWithQuestionsResponse)
async def download_question_set(
    question_set_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    購入済みの問題集を問題と一緒にダウンロード

    Args:
        question_set_id: 問題集ID
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        問題集と全問題
    """
    # 問題集を取得
    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    # 購入済みかチェック（または自分が作成したものか）
    if question_set.creator_id != current_user.id:
        purchase = db.query(Purchase).filter(
            Purchase.buyer_id == current_user.id,
            Purchase.question_set_id == question_set_id
        ).first()

        if not purchase:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="この問題集を閲覧する権限がありません"
            )

    # 問題を取得
    questions = db.query(Question).filter(
        Question.question_set_id == question_set_id
    ).all()

    return QuestionSetWithQuestionsResponse(
        id=question_set.id,
        title=question_set.title,
        description=question_set.description,
        category=question_set.category,
        tags=question_set.tags,
        price=question_set.price,
        is_published=question_set.is_published,
        creator_id=question_set.creator_id,
        questions=[QuestionResponse.model_validate(q) for q in questions]
    )
