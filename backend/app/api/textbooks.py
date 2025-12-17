"""
教科書ファイル提供APIエンドポイント
"""
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from pathlib import Path
import os
from typing import List

router = APIRouter()

# 教科書ファイルのベースディレクトリ
# プロジェクトルートからの相対パス（backend/app/api/textbooks.py から ../../docs/textbook）
_current_file = Path(__file__)
_project_root = _current_file.parent.parent.parent.parent
TEXTBOOK_BASE_DIR = _project_root / "docs" / "textbook"


class TextbookInfo(BaseModel):
    """教科書情報"""
    path: str
    name: str
    type: str  # "markdown" or "pdf"


@router.get("/", response_model=List[TextbookInfo])
async def list_textbooks():
    """
    利用可能な教科書ファイルのリストを取得

    Returns:
        教科書ファイルのリスト
    """
    textbooks = []
    
    # デバッグ用: パスを確認
    print(f"[Textbooks] Looking for textbooks in: {TEXTBOOK_BASE_DIR.absolute()}")
    print(f"[Textbooks] Directory exists: {TEXTBOOK_BASE_DIR.exists()}")
    
    if not TEXTBOOK_BASE_DIR.exists():
        print(f"[Textbooks] Directory not found: {TEXTBOOK_BASE_DIR.absolute()}")
        return textbooks
    
    # docs/textbook配下のファイルをスキャン
    for file_path in TEXTBOOK_BASE_DIR.iterdir():
        if file_path.is_file() and not file_path.name.startswith('.'):
            file_extension = file_path.suffix.lower()
            
            # MarkdownとPDFのみを対象
            if file_extension in ['.md', '.pdf']:
                textbook_type = "markdown" if file_extension == '.md' else "pdf"
                # ファイル名から拡張子を除いたものを名前として使用
                name = file_path.stem
                
                textbooks.append(TextbookInfo(
                    path=file_path.name,
                    name=name,
                    type=textbook_type
                ))
    
    return textbooks


@router.get("/{file_path:path}")
async def get_textbook(file_path: str):
    """
    教科書ファイルを取得

    Args:
        file_path: ファイルパス（例: "Decision Trees and Random Forests Textbook.md"）

    Returns:
        ファイルの内容

    Raises:
        HTTPException: ファイルが見つからない場合
    """
    # パストラバーサル攻撃を防ぐ
    # - Windows の "\" 区切りや "docs/textbook/xxx.md" などが来ても安全にファイル名だけ抽出する
    normalized = (file_path or "").replace("\\", "/")
    safe_path = Path(normalized).name
    
    # ファイルパスを構築
    file_full_path = TEXTBOOK_BASE_DIR / safe_path
    
    # ファイルが存在するか確認
    if not file_full_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="教科書ファイルが見つかりません"
        )
    
    # ファイル拡張子に応じて適切なレスポンスを返す
    file_extension = file_full_path.suffix.lower()
    
    if file_extension == '.md':
        # Markdownファイルはテキストとして返す
        try:
            with open(file_full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return PlainTextResponse(content, media_type='text/markdown; charset=utf-8')
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"ファイルの読み込みに失敗しました: {str(e)}"
            )
    elif file_extension == '.pdf':
        # PDFファイルはバイナリとして返す
        return FileResponse(
            str(file_full_path),
            media_type='application/pdf',
            filename=safe_path
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="サポートされていないファイル形式です"
        )

