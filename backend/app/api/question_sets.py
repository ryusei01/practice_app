"""
問題集CRUD APIエンドポイント
"""
import csv
import io
import json
import logging
import zipfile
from datetime import datetime
from typing import List, Optional
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, model_validator, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.auth import get_current_active_user
from ..models import User, QuestionSet, Purchase, Question
from ..utils.content_languages import (
    normalize_content_language_list,
    serialize_from_question_set_row,
)
from ..models.copyright_check import CopyrightCheckRecord, RiskLevel
from ..models.question import QuestionSetApprovalStatus
from ..models.user import SellerApplicationStatus
from ..services.copyright_checker import get_copyright_checker

logger = logging.getLogger(__name__)

router = APIRouter()


def _question_set_row_to_api_dict(qs: QuestionSet) -> dict:
    langs, primary = serialize_from_question_set_row(qs)
    return {
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
        "textbook_type": qs.textbook_type,
        "textbook_content": qs.textbook_content,
        "content_languages": langs,
        "content_language": primary,
        "approval_status": getattr(qs, "approval_status", None) or "not_required",
    }


class QuestionSetCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    tags: Optional[List[str]] = None
    price: int = 0
    is_published: bool = False
    textbook_path: Optional[str] = None
    textbook_type: Optional[str] = None
    textbook_content: Optional[str] = None
    # 後方互換: content_languages 未指定時の単一言語
    content_language: Optional[str] = None
    # 問題の言語（ja / en を複数可）。指定時はこちらが優先。
    content_languages: Optional[List[str]] = None

    @field_validator("content_language")
    @classmethod
    def validate_content_language_create(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v not in ("ja", "en"):
            raise ValueError("content_language must be ja or en")
        return v


class QuestionSetUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    price: Optional[int] = None
    is_published: Optional[bool] = None
    textbook_path: Optional[str] = None
    textbook_type: Optional[str] = None
    textbook_content: Optional[str] = None
    content_language: Optional[str] = None
    content_languages: Optional[List[str]] = None

    @field_validator("content_language")
    @classmethod
    def validate_content_language_update(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        if v not in ("ja", "en"):
            raise ValueError("content_language must be ja or en")
        return v


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
    textbook_content: Optional[str] = None
    content_languages: List[str] = ["ja"]
    content_language: str = "ja"
    approval_status: str = "not_required"

    @model_validator(mode='before')
    @classmethod
    def convert_nulls(cls, data):
        if isinstance(data, dict):
            langs = data.get("content_languages")
            cl = data.get("content_language")
            if langs is None:
                langs = normalize_content_language_list(None, cl or "ja")
                data = {**data, "content_languages": langs}
            else:
                data = {**data, "content_languages": normalize_content_language_list(langs, None)}
            if not data.get("content_language"):
                data = {**data, "content_language": data["content_languages"][0]}
            return data
        # ORM object
        if hasattr(data, '__dict__'):
            langs, primary = serialize_from_question_set_row(data)
            result = {}
            for key in ['id', 'title', 'description', 'category', 'tags', 'price', 'is_published', 'creator_id',
                       'total_questions', 'average_difficulty', 'total_purchases', 'average_rating',
                       'textbook_path', 'textbook_type', 'textbook_content', 'approval_status']:
                val = getattr(data, key, None)
                if key in ['total_questions', 'total_purchases'] and val is None:
                    result[key] = 0
                elif key == 'average_difficulty' and val is None:
                    result[key] = 0.5
                elif key == 'average_rating' and val is None:
                    result[key] = 0.0
                elif key == 'approval_status' and val is None:
                    result[key] = 'not_required'
                else:
                    result[key] = val
            result["content_languages"] = langs
            result["content_language"] = primary
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
    if request.content_languages is not None:
        normalized = normalize_content_language_list(request.content_languages, None)
    else:
        normalized = normalize_content_language_list(
            None,
            request.content_language or "ja",
        )

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
        textbook_type=request.textbook_type,
        textbook_content=request.textbook_content,
        content_languages=normalized,
        content_language=normalized[0],
    )

    db.add(new_question_set)
    db.commit()
    db.refresh(new_question_set)

    return new_question_set


@router.get("/", response_model=List[QuestionSetResponse])
async def list_question_sets(
    category: Optional[str] = Query(None, description="カテゴリでフィルタ"),
    is_published: Optional[bool] = Query(None, description="公開状態でフィルタ"),
    content_language: Optional[str] = Query(
        None, description="コンテンツ言語でフィルタ（ja / en）"
    ),
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
    if content_language in ("ja", "en"):
        query = query.filter(
            or_(
                QuestionSet.content_language == content_language,
                QuestionSet.content_languages.contains([content_language]),
            )
        )

    question_sets = query.offset(skip).limit(limit).all()

    return [_question_set_row_to_api_dict(qs) for qs in question_sets]


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

    return [_question_set_row_to_api_dict(qs) for qs in question_sets]


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

    return [_question_set_row_to_api_dict(qs) for qs in question_sets]


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

    # 公開しようとしている場合のチェック
    if request.is_published is True and not question_set.is_published:
        # 非販売者の場合：管理者審査が必要
        if not current_user.is_seller:
            app_status = current_user.seller_application_status or SellerApplicationStatus.NONE.value
            if app_status == SellerApplicationStatus.NONE.value:
                # 未申請 → 問題集を審査待ちにセットして申請を促す
                question_set.approval_status = QuestionSetApprovalStatus.PENDING_REVIEW.value
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="販売者登録が必要です。販売者ダッシュボードから申請してください。問題集は審査待ち状態に設定されました。",
                )
            elif app_status == SellerApplicationStatus.PENDING.value:
                # 申請中 → 審査待ちにセットして待機を促す
                question_set.approval_status = QuestionSetApprovalStatus.PENDING_REVIEW.value
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="販売者申請が審査中です。承認後に公開できます。問題集は審査待ち状態に設定されました。",
                )
            elif app_status == SellerApplicationStatus.REJECTED.value:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="販売者申請が却下されました。再申請するか、管理者にお問い合わせください。",
                )
            # APPROVED の場合は著作権チェックへ進む

        # 著作権チェック済みか確認（販売者または承認済みの場合）
        latest_check = (
            db.query(CopyrightCheckRecord)
            .filter(CopyrightCheckRecord.question_set_id == question_set_id)
            .order_by(CopyrightCheckRecord.checked_at.desc())
            .first()
        )
        if latest_check is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="公開前に著作権チェックを実行してください。問題集の設定画面からチェックを実行できます。",
            )
        _rv = (
            latest_check.risk_level.value
            if isinstance(latest_check.risk_level, RiskLevel)
            else latest_check.risk_level
        )
        if _rv == RiskLevel.HIGH.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="著作権チェックの結果、高リスクと判定されたため公開できません。コンテンツを修正した後、再度チェックを実行してください。",
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
    if request.textbook_content is not None:
        question_set.textbook_content = request.textbook_content
    if request.content_languages is not None:
        normalized = normalize_content_language_list(request.content_languages, None)
        question_set.content_languages = normalized
        question_set.content_language = normalized[0]
    elif request.content_language is not None:
        normalized = normalize_content_language_list([request.content_language], None)
        question_set.content_languages = normalized
        question_set.content_language = normalized[0]

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
    content_languages: List[str] = ["ja"]
    content_language: str = "ja"
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

    langs, primary = serialize_from_question_set_row(question_set)
    return QuestionSetWithQuestionsResponse(
        id=question_set.id,
        title=question_set.title,
        description=question_set.description,
        category=question_set.category,
        tags=question_set.tags,
        price=question_set.price,
        is_published=question_set.is_published,
        creator_id=question_set.creator_id,
        content_languages=langs,
        content_language=primary,
        questions=[QuestionResponse.model_validate(q) for q in questions]
    )


_CSV_EXPORT_COLUMNS = [
    "question_text", "question_type",
    "option_1", "option_2", "option_3", "option_4",
    "correct_answer", "explanation", "difficulty",
    "category", "subcategory1", "subcategory2",
]


@router.get("/{question_set_id}/export-csv")
async def export_question_set_csv(
    question_set_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """自分が作成した問題集の全問題をCSVとしてダウンロードする。"""
    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
    if not question_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="問題集が見つかりません")
    if question_set.creator_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="この問題集をエクスポートする権限がありません")

    questions = (
        db.query(Question)
        .filter(Question.question_set_id == question_set_id)
        .order_by(Question.order)
        .all()
    )

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=_CSV_EXPORT_COLUMNS)
    writer.writeheader()
    for q in questions:
        opts = q.options or []
        writer.writerow({
            "question_text": q.question_text or "",
            "question_type": q.question_type or "",
            "option_1": opts[0] if len(opts) > 0 else "",
            "option_2": opts[1] if len(opts) > 1 else "",
            "option_3": opts[2] if len(opts) > 2 else "",
            "option_4": opts[3] if len(opts) > 3 else "",
            "correct_answer": q.correct_answer or "",
            "explanation": q.explanation or "",
            "difficulty": q.difficulty if q.difficulty is not None else "",
            "category": q.category or "",
            "subcategory1": q.subcategory1 or "",
            "subcategory2": q.subcategory2 or "",
        })

    safe_title = "".join(c for c in (question_set.title or "export") if c.isalnum() or c in " _-").strip() or "export"
    filename = f"{safe_title}.csv"

    buf.seek(0)
    return StreamingResponse(
        iter(["\ufeff" + buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- 著作権チェック ---

class CopyrightCheckResponse(BaseModel):
    question_set_id: str
    risk_level: str
    reasons: List[str]
    recommendation: str
    checked_at: datetime

    class Config:
        from_attributes = True


def _copyright_record_to_response(
    question_set_id: str,
    record: CopyrightCheckRecord,
    reasons_list: Optional[List[str]] = None,
) -> CopyrightCheckResponse:
    raw_reasons = reasons_list
    if raw_reasons is None:
        try:
            raw_reasons = json.loads(record.reasons) if record.reasons else []
        except json.JSONDecodeError:
            raw_reasons = []
    if not isinstance(raw_reasons, list):
        raw_reasons = []
    rv = (
        record.risk_level.value
        if isinstance(record.risk_level, RiskLevel)
        else str(record.risk_level)
    )
    return CopyrightCheckResponse(
        question_set_id=question_set_id,
        risk_level=rv,
        reasons=[str(x) for x in raw_reasons],
        recommendation=record.recommendation or "",
        checked_at=record.checked_at,
    )


@router.get(
    "/{question_set_id}/copyright-check/latest",
    response_model=Optional[CopyrightCheckResponse],
)
async def get_latest_copyright_check(
    question_set_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """作成者が直近の著作権チェック結果を取得する（公開トグル制御などに使用）。"""
    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="問題集が見つかりません")
    if question_set.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="この問題集のチェック結果を参照する権限がありません")

    record = (
        db.query(CopyrightCheckRecord)
        .filter(CopyrightCheckRecord.question_set_id == question_set_id)
        .order_by(CopyrightCheckRecord.checked_at.desc())
        .first()
    )
    if not record:
        return None
    return _copyright_record_to_response(question_set_id, record)


@router.post("/{question_set_id}/copyright-check", response_model=CopyrightCheckResponse)
async def run_copyright_check(
    question_set_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    問題集の著作権リスクをGPT-OSS（Ollama経由）で評価する。
    販売者が公開前に実行する必須チェック。

    Returns:
        risk_level: "low" | "medium" | "high"
        reasons: リスク理由のリスト
        recommendation: 推奨対応（日本語）

    Raises:
        403: 作成者以外が呼び出した場合
        404: 問題集が見つからない場合
        503: Ollama が起動していない場合
    """
    question_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
    if not question_set:
        raise HTTPException(status_code=404, detail="問題集が見つかりません")

    if question_set.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="この問題集の著作権チェックを実行する権限がありません")

    # 問題文を収集
    questions = db.query(Question).filter(
        Question.question_set_id == question_set_id
    ).order_by(Question.order).limit(30).all()
    question_texts = [q.question_text for q in questions if q.question_text]

    checker = get_copyright_checker()
    if not await checker.is_available():
        raise HTTPException(
            status_code=503,
            detail="著作権チェックサービス（Ollama）に接続できません。サーバーでOllamaが起動しているか確認してください。",
        )
    try:
        result = await checker.check(
            title=question_set.title,
            description=question_set.description,
            question_texts=question_texts,
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="著作権チェックサービス（Ollama）に接続できません。サーバーでOllamaが起動しているか確認してください。",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=503,
            detail="著作権チェックがタイムアウトしました。時間をおいて再試行してください。",
        )

    # 結果をDBに保存
    record = CopyrightCheckRecord(
        id=str(uuid.uuid4()),
        question_set_id=question_set_id,
        risk_level=result["risk_level"],
        reasons=json.dumps(result.get("reasons", []), ensure_ascii=False),
        recommendation=result.get("recommendation", ""),
        raw_response=result.get("raw_response", ""),
        checked_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return _copyright_record_to_response(
        question_set_id,
        record,
        reasons_list=result.get("reasons", []),
    )


# --- Anki .apkg import ---

@router.post("/parse-anki")
async def parse_anki(
    file: UploadFile = File(...),
):
    """Parse an Anki .apkg file and return questions without saving to DB.
    No authentication required — intended for trial / local use."""
    import tempfile, os
    from ..services.anki_importer import import_apkg

    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".apkg"):
        raise HTTPException(status_code=400, detail="Only .apkg files are supported")

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".apkg")
    try:
        tmp.write(contents)
        tmp.close()

        result = import_apkg(tmp.name, "trial_local")

        return {
            "title": result["title"],
            "questions": result["questions"],
            "total": len(result["questions"]),
        }
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid .apkg file (not a valid ZIP)")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        os.unlink(tmp.name)


@router.post("/import-anki")
async def import_anki(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Import an Anki .apkg file and create a new question set with all cards."""
    import tempfile, os
    from ..services.anki_importer import import_apkg

    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".apkg"):
        raise HTTPException(status_code=400, detail="Only .apkg files are supported")

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    # Write to temp file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".apkg")
    try:
        tmp.write(contents)
        tmp.close()

        result = import_apkg(tmp.name, current_user.id)

        # Create question set
        question_set_id = str(uuid.uuid4())
        all_tags = set()
        for q in result["questions"]:
            all_tags.update(q.get("tags", []))

        new_set = QuestionSet(
            id=question_set_id,
            title=result["title"],
            description=f"Imported from Anki ({len(result['questions'])} cards)",
            category="Anki Import",
            creator_id=current_user.id,
            tags=list(all_tags) if all_tags else None,
            content_languages=["ja"],
            content_language="ja",
        )
        db.add(new_set)

        # Create questions
        for idx, q_data in enumerate(result["questions"]):
            question = Question(
                id=str(uuid.uuid4()),
                question_set_id=question_set_id,
                question_text=q_data["question_text"],
                question_type=q_data["question_type"],
                options=q_data.get("options"),
                correct_answer=q_data["correct_answer"],
                media_urls=q_data.get("media_urls"),
                order=idx,
            )
            db.add(question)

        db.commit()

        return {
            "message": "Anki deck imported successfully",
            "question_set_id": question_set_id,
            "title": result["title"],
            "total_questions": len(result["questions"]),
        }

    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid .apkg file (not a valid ZIP)")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        os.unlink(tmp.name)
