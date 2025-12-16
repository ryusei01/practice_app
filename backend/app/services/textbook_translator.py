"""
教科書（Markdown）の翻訳サービス
Markdownの構造を保持しながら翻訳を実行
"""
import re
import logging
from typing import List, Dict, Optional
from ..services.local_translator import LocalTranslator
from deep_translator import GoogleTranslator
from ..core.config import settings

logger = logging.getLogger(__name__)


class TextbookTranslator:
    """教科書（Markdown）の翻訳サービス"""

    def __init__(self):
        """初期化"""
        self.local_translator = None
        if settings.USE_LOCAL_TRANSLATION:
            self.local_translator = LocalTranslator(
                base_url=settings.OLLAMA_BASE_URL
            )

    def _split_markdown(self, text: str) -> List[Dict[str, str]]:
        """
        Markdownテキストを翻訳可能な部分に分割

        Args:
            text: Markdownテキスト

        Returns:
            分割された部分のリスト [{"type": "text|code|link", "content": ""}, ...]
        """
        parts = []
        current_pos = 0

        # コードブロックを検出
        code_block_pattern = r'```[\s\S]*?```'
        # インラインコードを検出
        inline_code_pattern = r'`[^`]+`'
        # リンクを検出
        link_pattern = r'\[([^\]]+)\]\([^\)]+\)'

        # すべての特殊要素の位置を取得
        special_elements = []
        for match in re.finditer(code_block_pattern, text):
            special_elements.append({
                "start": match.start(),
                "end": match.end(),
                "type": "code_block",
                "content": match.group()
            })
        for match in re.finditer(inline_code_pattern, text):
            special_elements.append({
                "start": match.start(),
                "end": match.end(),
                "type": "inline_code",
                "content": match.group()
            })
        for match in re.finditer(link_pattern, text):
            special_elements.append({
                "start": match.start(),
                "end": match.end(),
                "type": "link",
                "content": match.group(),
                "link_text": match.group(1)  # リンクテキストのみ
            })

        # 開始位置でソート
        special_elements.sort(key=lambda x: x["start"])

        # テキストを分割
        for element in special_elements:
            # 要素の前のテキスト
            if element["start"] > current_pos:
                text_part = text[current_pos:element["start"]]
                if text_part.strip():
                    parts.append({
                        "type": "text",
                        "content": text_part
                    })

            # 特殊要素
            parts.append({
                "type": element["type"],
                "content": element["content"],
                "link_text": element.get("link_text")
            })

            current_pos = element["end"]

        # 残りのテキスト
        if current_pos < len(text):
            text_part = text[current_pos:]
            if text_part.strip():
                parts.append({
                    "type": "text",
                    "content": text_part
                })

        # 特殊要素がない場合は全体をテキストとして扱う
        if not parts:
            parts.append({
                "type": "text",
                "content": text
            })

        return parts

    async def translate_markdown(
        self,
        markdown_text: str,
        target_lang: str,
        source_lang: Optional[str] = None
    ) -> str:
        """
        Markdownテキストを翻訳（構造を保持）

        Args:
            markdown_text: Markdownテキスト
            target_lang: 翻訳先言語
            source_lang: 翻訳元言語（Noneの場合は自動検出）

        Returns:
            翻訳されたMarkdownテキスト
        """
        # #region agent log
        with open(r'h:\document\program\project\practice_app\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(f'{{"timestamp":{int(__import__("time").time()*1000)},"location":"textbook_translator.py:112","message":"translate_markdown called","data":{{"target_lang":"{target_lang}","source_lang":"{source_lang}","text_length":{len(markdown_text)},"text_preview":"{markdown_text[:100].replace(chr(34),chr(92)+chr(34))}"}},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}}\n')
        # #endregion
        # Markdownを分割
        parts = self._split_markdown(markdown_text)

        # 翻訳が必要な部分（テキストとリンクテキスト）を抽出
        texts_to_translate = []
        text_indices = []  # 翻訳が必要な部分のインデックス

        for i, part in enumerate(parts):
            if part["type"] == "text":
                texts_to_translate.append(part["content"])
                text_indices.append(i)
            elif part["type"] == "link" and "link_text" in part:
                # リンクテキストのみ翻訳
                texts_to_translate.append(part["link_text"])
                text_indices.append(i)

        if not texts_to_translate:
            # 翻訳する部分がない場合はそのまま返す
            return markdown_text

        # 翻訳を実行
        try:
            if self.local_translator:
                # ローカルLLMを使用
                try:
                    results = await self.local_translator.translate_batch(
                        texts=texts_to_translate,
                        target_lang=target_lang,
                        source_lang=source_lang
                    )
                    translated_texts = [r["translated"] for r in results]
                except Exception as e:
                    logger.warning(f"Local translation failed, falling back to Google: {str(e)}")
                    # フォールバック: GoogleTranslatorを使用
                    translator = GoogleTranslator(
                        source=source_lang or "auto",
                        target=target_lang
                    )
                    translated_texts = []
                    for text in texts_to_translate:
                        translated = translator.translate(text)
                        # Noneの場合は元のテキストを使用
                        translated_texts.append(translated if translated is not None else text)
            else:
                # GoogleTranslatorを使用
                translator = GoogleTranslator(
                    source=source_lang or "auto",
                    target=target_lang
                )
                translated_texts = []
                for text in texts_to_translate:
                    translated = translator.translate(text)
                    # Noneの場合は元のテキストを使用
                    translated_texts.append(translated if translated is not None else text)

            # 翻訳結果を元の構造に戻す
            translated_parts = parts.copy()
            for idx, text_idx in enumerate(text_indices):
                part = translated_parts[text_idx]
                if part["type"] == "text":
                    if idx < len(translated_texts):
                        part["content"] = translated_texts[idx]
                    # idxが範囲外の場合は元のcontentをそのまま使用
                elif part["type"] == "link" and "link_text" in part:
                    # リンクテキストを置き換え
                    original_link = part["content"]
                    translated_link_text = translated_texts[idx] if idx < len(translated_texts) else part["link_text"]
                    # [元のテキスト](URL) -> [翻訳テキスト](URL)
                    part["content"] = re.sub(
                        r'\[([^\]]+)\]',
                        f'[{translated_link_text}]',
                        original_link
                    )

            # 結合して返す（すべてのcontentを文字列として結合）
            result = "".join([str(part.get("content", "")) for part in translated_parts])
            # #region agent log
            with open(r'h:\document\program\project\practice_app\.cursor\debug.log', 'a', encoding='utf-8') as f:
                f.write(f'{{"timestamp":{int(__import__("time").time()*1000)},"location":"textbook_translator.py:194","message":"Translation completed","data":{{"result_length":{len(result)},"result_preview":"{result[:200].replace(chr(34),chr(92)+chr(34))}"}},"sessionId":"debug-session","runId":"run1","hypothesisId":"A"}}\n')
            # #endregion
            return result

        except Exception as e:
            logger.error(f"Markdown translation error: {str(e)}")
            # #region agent log
            with open(r'h:\document\program\project\practice_app\.cursor\debug.log', 'a', encoding='utf-8') as f:
                f.write(f'{{"timestamp":{int(__import__("time").time()*1000)},"location":"textbook_translator.py:196","message":"Translation error occurred","data":{{"error":"{str(e).replace(chr(34),chr(92)+chr(34))}","error_type":"{type(e).__name__}"}},"sessionId":"debug-session","runId":"run1","hypothesisId":"C"}}\n')
            # #endregion
            # エラー時は元のテキストを返す
            return markdown_text




