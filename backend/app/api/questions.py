"""
問題CRUD APIエンドポイント
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from pydantic import BaseModel
from typing import List, Optional
import uuid
import csv
import io

from ..core.database import get_db
from ..core.auth import get_current_active_user
from ..models import User, Question, QuestionSet, Answer

router = APIRouter()


class QuestionCreate(BaseModel):
    question_set_id: str
    question_text: str
    question_type: str  # multiple_choice, true_false, text_input
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: Optional[str] = None
    difficulty: Optional[float] = None
    category: Optional[str] = None
    subcategory1: Optional[str] = None
    subcategory2: Optional[str] = None
    order: int = 0


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    difficulty: Optional[float] = None
    category: Optional[str] = None
    subcategory1: Optional[str] = None
    subcategory2: Optional[str] = None
    order: Optional[int] = None


class QuestionResponse(BaseModel):
    id: str
    question_set_id: str
    question_text: str
    question_type: str
    options: Optional[List[str]]
    correct_answer: str
    explanation: Optional[str]
    difficulty: Optional[float]
    category: Optional[str]
    subcategory1: Optional[str]
    subcategory2: Optional[str]
    order: int
    total_attempts: int = 0
    correct_count: int = 0
    average_time_sec: float = 0.0

    class Config:
        from_attributes = True


@router.post("/", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    request: QuestionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    新規問題を作成

    Args:
        request: 問題作成リクエスト
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        作成された問題

    Raises:
        HTTPException: 問題集が見つからない、または権限がない場合
    """
    # 問題集の存在と権限を確認
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == request.question_set_id
    ).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    # 作成者のみ問題を追加可能
    if question_set.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この問題集に問題を追加する権限がありません"
        )

    new_question = Question(
        id=str(uuid.uuid4()),
        question_set_id=request.question_set_id,
        question_text=request.question_text,
        question_type=request.question_type,
        options=request.options,
        correct_answer=request.correct_answer,
        explanation=request.explanation,
        difficulty=request.difficulty,
        category=request.category,
        subcategory1=request.subcategory1,
        subcategory2=request.subcategory2,
        order=request.order
    )

    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    return new_question


@router.get("/", response_model=List[QuestionResponse])
async def list_questions(
    question_set_id: Optional[str] = Query(None, description="問題集IDでフィルタ"),
    category: Optional[str] = Query(None, description="カテゴリでフィルタ"),
    subcategory1: Optional[str] = Query(None, description="サブカテゴリ1でフィルタ"),
    subcategory2: Optional[str] = Query(None, description="サブカテゴリ2でフィルタ"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    問題一覧を取得

    Args:
        question_set_id: 問題集IDフィルタ
        category: カテゴリフィルタ
        subcategory1: サブカテゴリ1フィルタ
        subcategory2: サブカテゴリ2フィルタ
        skip: スキップ数
        limit: 取得数上限
        db: データベースセッション

    Returns:
        問題のリスト
    """
    query = db.query(Question)

    if question_set_id:
        query = query.filter(Question.question_set_id == question_set_id)
    if category:
        query = query.filter(Question.category == category)
    if subcategory1:
        query = query.filter(Question.subcategory1 == subcategory1)
    if subcategory2:
        query = query.filter(Question.subcategory2 == subcategory2)

    # orderでソート
    query = query.order_by(Question.order)

    questions = query.offset(skip).limit(limit).all()

    # NULL値を安全に処理
    result = []
    for q in questions:
        result.append({
            "id": q.id,
            "question_set_id": q.question_set_id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "difficulty": q.difficulty,
            "category": q.category,
            "subcategory1": q.subcategory1,
            "subcategory2": q.subcategory2,
            "order": q.order if q.order is not None else 0,
            "total_attempts": q.total_attempts if q.total_attempts is not None else 0,
            "correct_count": q.correct_count if q.correct_count is not None else 0,
            "average_time_sec": q.average_time_sec if q.average_time_sec is not None else 0.0
        })

    return result


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    db: Session = Depends(get_db)
):
    """
    問題の詳細を取得

    Args:
        question_id: 問題ID
        db: データベースセッション

    Returns:
        問題の詳細

    Raises:
        HTTPException: 問題が見つからない場合
    """
    question = db.query(Question).filter(Question.id == question_id).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題が見つかりません"
        )

    return question


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    request: QuestionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    問題を更新

    Args:
        question_id: 問題ID
        request: 更新リクエスト
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        更新された問題

    Raises:
        HTTPException: 問題が見つからない、または権限がない場合
    """
    question = db.query(Question).filter(Question.id == question_id).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題が見つかりません"
        )

    # 問題集の作成者のみ編集可能
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == question.question_set_id
    ).first()

    if question_set.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この問題を編集する権限がありません"
        )

    # 更新処理
    if request.question_text is not None:
        question.question_text = request.question_text
    if request.question_type is not None:
        question.question_type = request.question_type
    if request.options is not None:
        question.options = request.options
    if request.correct_answer is not None:
        question.correct_answer = request.correct_answer
    if request.explanation is not None:
        question.explanation = request.explanation
    if request.difficulty is not None:
        question.difficulty = request.difficulty
    if request.category is not None:
        question.category = request.category
    if request.subcategory1 is not None:
        question.subcategory1 = request.subcategory1
    if request.subcategory2 is not None:
        question.subcategory2 = request.subcategory2
    if request.order is not None:
        question.order = request.order

    db.commit()
    db.refresh(question)

    return question


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    問題を削除

    Args:
        question_id: 問題ID
        current_user: 現在のユーザー
        db: データベースセッション

    Raises:
        HTTPException: 問題が見つからない、または権限がない場合
    """
    question = db.query(Question).filter(Question.id == question_id).first()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題が見つかりません"
        )

    # 問題集の作成者のみ削除可能
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == question.question_set_id
    ).first()

    if question_set.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この問題を削除する権限がありません"
        )

    db.delete(question)
    db.commit()

    return None


class QuestionGroup(BaseModel):
    """問題グループ"""
    category: Optional[str]
    subcategory1: Optional[str]
    subcategory2: Optional[str]
    count: int
    questions: List[QuestionResponse]


@router.get("/groups/{question_set_id}", response_model=List[QuestionGroup])
async def get_question_groups(
    question_set_id: str,
    group_by: str = Query("subcategory1", description="グルーピング基準: category, subcategory1, subcategory2"),
    db: Session = Depends(get_db)
):
    """
    問題をグループ化して取得

    Args:
        question_set_id: 問題集ID
        group_by: グルーピング基準（category, subcategory1, subcategory2）
        db: データベースセッション

    Returns:
        グループ化された問題リスト

    Raises:
        HTTPException: 問題集が見つからない場合
    """
    # 問題集の存在確認
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == question_set_id
    ).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    # 問題を取得
    questions = db.query(Question).filter(
        Question.question_set_id == question_set_id
    ).order_by(Question.order).all()

    # グループ化
    groups = {}
    for q in questions:
        # グルーピングキーを決定
        if group_by == "category":
            key = q.category or "未分類"
        elif group_by == "subcategory1":
            key = q.subcategory1 or "未分類"
        elif group_by == "subcategory2":
            key = q.subcategory2 or "未分類"
        else:
            key = "未分類"

        if key not in groups:
            groups[key] = {
                "category": q.category if group_by == "category" else None,
                "subcategory1": q.subcategory1 if group_by == "subcategory1" else None,
                "subcategory2": q.subcategory2 if group_by == "subcategory2" else None,
                "questions": []
            }

        groups[key]["questions"].append({
            "id": q.id,
            "question_set_id": q.question_set_id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "difficulty": q.difficulty,
            "category": q.category,
            "subcategory1": q.subcategory1,
            "subcategory2": q.subcategory2,
            "order": q.order if q.order is not None else 0,
            "total_attempts": q.total_attempts if q.total_attempts is not None else 0,
            "correct_count": q.correct_count if q.correct_count is not None else 0,
            "average_time_sec": q.average_time_sec if q.average_time_sec is not None else 0.0
        })

    # 結果を整形
    result = []
    for key, group_data in groups.items():
        result.append({
            "category": group_data["category"],
            "subcategory1": group_data["subcategory1"],
            "subcategory2": group_data["subcategory2"],
            "count": len(group_data["questions"]),
            "questions": group_data["questions"]
        })

    return result


@router.post("/bulk-upload/{question_set_id}")
async def bulk_upload_questions(
    question_set_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    CSVファイルから問題を一括登録

    CSVフォーマット:
    question_text,question_type,options,correct_answer,explanation,difficulty,category,subcategory1,subcategory2

    例:
    "What is 2+2?",multiple_choice,"2,3,4,5",4,"Basic addition",0.2,math,arithmetic,addition
    "The sky is blue",true_false,,true,"Common knowledge",0.1,general,nature,sky

    Args:
        question_set_id: 問題集ID
        file: CSVファイル
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        登録された問題数と詳細
    """
    # 問題集の存在と権限を確認
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == question_set_id
    ).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    if question_set.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この問題集に問題を追加する権限がありません"
        )

    # CSVファイルを読み込み
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(decoded))

        created_questions = []
        errors = []

        for idx, row in enumerate(csv_reader, start=1):
            try:
                # 必須フィールドの確認
                if not row.get('question_text') or not row.get('correct_answer'):
                    errors.append(f"Row {idx}: Missing required fields (question_text or correct_answer)")
                    continue

                # question_typeのデフォルト値
                question_type = row.get('question_type', 'text_input').strip()

                # optionsの処理（カンマ区切りの文字列をリストに変換）
                options_str = row.get('options', '').strip()
                options = [opt.strip() for opt in options_str.split(',')] if options_str else None

                # difficultyの処理
                difficulty_str = row.get('difficulty', '').strip()
                if difficulty_str:
                    try:
                        difficulty = float(difficulty_str)
                        if not (0 <= difficulty <= 1):
                            difficulty = None
                    except (ValueError, TypeError):
                        difficulty = None
                else:
                    difficulty = None

                # 問題を作成
                new_question = Question(
                    id=str(uuid.uuid4()),
                    question_set_id=question_set_id,
                    question_text=row['question_text'].strip(),
                    question_type=question_type,
                    options=options,
                    correct_answer=row['correct_answer'].strip(),
                    explanation=row.get('explanation', '').strip() or None,
                    difficulty=difficulty,
                    category=row.get('category', '').strip() or None,
                    subcategory1=row.get('subcategory1', '').strip() or None,
                    subcategory2=row.get('subcategory2', '').strip() or None,
                    order=len(created_questions)
                )

                db.add(new_question)
                created_questions.append(new_question)

            except Exception as e:
                errors.append(f"Row {idx}: {str(e)}")
                continue

        # 一括コミット
        if created_questions:
            db.commit()

        return {
            "message": f"Successfully imported {len(created_questions)} questions",
            "total_created": len(created_questions),
            "total_errors": len(errors),
            "errors": errors if errors else None
        }

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file encoding. Please use UTF-8 encoded CSV file"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process CSV file: {str(e)}"
        )


@router.get("/select/ai/{question_set_id}", response_model=List[QuestionResponse])
async def select_questions_by_ai(
    question_set_id: str,
    count: int = Query(..., ge=1, le=100, description="選出する問題数"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    AIベースの問題選出

    優先順位:
    1. 回答履歴がない問題を優先（まだ解いていない問題）
    2. 回答履歴がある問題の中で：
       - 間違えた回数が多い問題
       - 解いた回数が少ない問題
       - 平均回答時間が長い問題

    Args:
        question_set_id: 問題集ID
        count: 選出する問題数
        current_user: 現在のユーザー
        db: データベースセッション

    Returns:
        選出された問題のリスト
    """
    # 問題集の存在確認
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == question_set_id
    ).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    # ユーザーの回答履歴をサブクエリで取得
    user_answers_subquery = (
        db.query(
            Answer.question_id,
            func.count(Answer.id).label('attempt_count'),
            func.sum(case((Answer.is_correct == False, 1), else_=0)).label('error_count'),
            func.avg(Answer.answer_time_sec).label('avg_time')
        )
        .filter(Answer.user_id == current_user.id)
        .group_by(Answer.question_id)
        .subquery()
    )

    # 問題を取得してスコアリング
    questions = (
        db.query(Question)
        .outerjoin(user_answers_subquery, Question.id == user_answers_subquery.c.question_id)
        .filter(Question.question_set_id == question_set_id)
        .order_by(
            # 1. 回答履歴がない問題を優先（attempt_countがNULLまたは0の問題）
            case(
                (user_answers_subquery.c.attempt_count == None, 0),  # 履歴なし = 0 (優先)
                else_=1  # 履歴あり = 1
            ),
            # 2. 回答履歴がある問題の中での優先順位
            # 2-1. 間違えた回数が多い順（降順）
            func.coalesce(user_answers_subquery.c.error_count, 0).desc(),
            # 2-2. 解いた回数が少ない順（昇順）
            func.coalesce(user_answers_subquery.c.attempt_count, 0).asc(),
            # 2-3. 平均回答時間が長い順（降順）
            func.coalesce(user_answers_subquery.c.avg_time, 0).desc(),
            # 3. 問題の順序
            Question.order
        )
        .limit(count)
        .all()
    )

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題が見つかりません"
        )

    # レスポンス整形
    result = []
    for q in questions:
        result.append({
            "id": q.id,
            "question_set_id": q.question_set_id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "difficulty": q.difficulty,
            "category": q.category,
            "order": q.order if q.order is not None else 0,
            "total_attempts": q.total_attempts if q.total_attempts is not None else 0,
            "correct_count": q.correct_count if q.correct_count is not None else 0,
            "average_time_sec": q.average_time_sec if q.average_time_sec is not None else 0.0
        })

    return result


@router.get("/select/range/{question_set_id}", response_model=List[QuestionResponse])
async def select_questions_by_range(
    question_set_id: str,
    start: int = Query(..., ge=0, description="開始番号（0から始まる）"),
    count: int = Query(..., ge=1, le=100, description="問題数"),
    db: Session = Depends(get_db)
):
    """
    範囲指定での問題選出

    Args:
        question_set_id: 問題集ID
        start: 開始番号（0から始まる）
        count: 選出する問題数
        db: データベースセッション

    Returns:
        選出された問題のリスト
    """
    # 問題集の存在確認
    question_set = db.query(QuestionSet).filter(
        QuestionSet.id == question_set_id
    ).first()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="問題集が見つかりません"
        )

    # orderでソートして範囲指定で取得
    questions = (
        db.query(Question)
        .filter(Question.question_set_id == question_set_id)
        .order_by(Question.order)
        .offset(start)
        .limit(count)
        .all()
    )

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="指定された範囲に問題が見つかりません"
        )

    # レスポンス整形
    result = []
    for q in questions:
        result.append({
            "id": q.id,
            "question_set_id": q.question_set_id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "difficulty": q.difficulty,
            "category": q.category,
            "order": q.order if q.order is not None else 0,
            "total_attempts": q.total_attempts if q.total_attempts is not None else 0,
            "correct_count": q.correct_count if q.correct_count is not None else 0,
            "average_time_sec": q.average_time_sec if q.average_time_sec is not None else 0.0
        })

    return result
