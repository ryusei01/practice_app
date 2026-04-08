from __future__ import annotations

import os
from io import BytesIO
from typing import Iterable, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


def _try_register_japanese_font() -> Optional[str]:
    """
    Try to register a Japanese-capable font if available on the host.
    Returns the registered font name, or None when not available.
    """
    # Common candidates:
    # - Windows: Meiryo, Yu Gothic
    # - Linux containers may not have these; in that case we fall back to Helvetica.
    candidates: list[tuple[str, str]] = [
        # Bundled (if present). Put fonts here to guarantee output even on Linux.
        (
            "NotoSansJP",
            os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                "assets",
                "fonts",
                "NotoSansJP-Regular.ttf",
            ),
        ),
        ("Meiryo", r"C:\Windows\Fonts\meiryo.ttc"),
        ("YuGothic", r"C:\Windows\Fonts\YuGothR.ttc"),
        ("NotoSansCJKjp", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
        ("NotoSansJP", "/usr/share/fonts/truetype/noto/NotoSansJP-Regular.ttf"),
    ]
    for font_name, path in candidates:
        try:
            if os.path.exists(path):
                pdfmetrics.registerFont(TTFont(font_name, path))
                return font_name
        except Exception:
            # If registration fails, try next candidate.
            continue
    return None


def _register_cid_japanese_font() -> str:
    """
    Register a Japanese CID font that works without external TTF files.
    This is a good default to avoid mojibake on minimal Linux servers.
    """
    font_name = "HeiseiKakuGo-W5"
    try:
        pdfmetrics.registerFont(UnicodeCIDFont(font_name))
    except Exception:
        # If registration fails for any reason, fall back to Helvetica.
        return "Helvetica"
    return font_name


def build_question_set_pdf_bytes(
    *,
    title: str,
    description: str | None,
    questions: Iterable[dict],
    include_answers: bool = True,
) -> bytes:
    """
    Build a simple PDF for a question set.

    questions: iterable of dict with keys:
      - question_text: str
      - question_type: str
      - options: list[str] | None
      - correct_answer: str | None
      - explanation: str | None
    """
    buf = BytesIO()
    canvas = Canvas(buf, pagesize=A4)
    width, height = A4

    font_jp = _try_register_japanese_font()
    # If no TTF is available, use CID font for Japanese-capable rendering.
    font_body = font_jp or _register_cid_japanese_font()
    # CID fonts don't have separate bold variants; keep it consistent.
    font_bold = font_jp or font_body

    left = 16 * mm
    right = 16 * mm
    top = 18 * mm
    bottom = 16 * mm

    y = height - top

    def set_font(name: str, size: int):
        canvas.setFont(name, size)

    def new_page():
        nonlocal y
        canvas.showPage()
        y = height - top

    def ensure_space(need: float):
        nonlocal y
        if y <= bottom + need:
            new_page()

    def wrap_text(text: str, max_width: float, font_name: str, font_size: int) -> list[str]:
        # Very small/robust wrapper: split by spaces; for long CJK strings, fallback to char wrapping.
        if not text:
            return [""]
        words = text.replace("\r\n", "\n").replace("\r", "\n").split(" ")
        lines: list[str] = []
        cur = ""
        for w in words:
            trial = (cur + " " + w).strip()
            if pdfmetrics.stringWidth(trial, font_name, font_size) <= max_width:
                cur = trial
                continue
            if cur:
                lines.append(cur)
            # If the word itself is too long, do char wrap.
            if pdfmetrics.stringWidth(w, font_name, font_size) > max_width:
                chunk = ""
                for ch in w:
                    t2 = chunk + ch
                    if pdfmetrics.stringWidth(t2, font_name, font_size) <= max_width:
                        chunk = t2
                    else:
                        if chunk:
                            lines.append(chunk)
                        chunk = ch
                cur = chunk
            else:
                cur = w
        if cur:
            lines.append(cur)
        # Also handle explicit newlines by re-wrapping each paragraph.
        out: list[str] = []
        for ln in lines:
            if "\n" not in ln:
                out.append(ln)
            else:
                for p in ln.split("\n"):
                    out.extend(wrap_text(p, max_width, font_name, font_size))
        return out

    def draw_block(text: str, *, font_name: str, font_size: int, leading: float):
        nonlocal y
        max_width = width - left - right
        for line in wrap_text(text, max_width, font_name, font_size):
            ensure_space(leading)
            canvas.drawString(left, y, line)
            y -= leading

    def draw_centered(text: str, y_pos: float, font_name: str, font_size: int):
        canvas.setFont(font_name, font_size)
        w = pdfmetrics.stringWidth(text, font_name, font_size)
        x = max(left, (width - w) / 2)
        canvas.drawString(x, y_pos, text)

    def header_block():
        nonlocal y
        title_text = (title or "Untitled").strip()
        ensure_space(26 * mm)
        draw_centered(title_text, y, font_bold, 18)
        y -= 7 * mm

        # "school print" style header lines
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(1)
        canvas.line(left, y, width - right, y)
        y -= 6 * mm

        set_font(font_body, 11)
        # name/class blanks (common on worksheets)
        canvas.drawString(left, y, "氏名：")
        canvas.line(left + 12 * mm, y - 1.2 * mm, left + 85 * mm, y - 1.2 * mm)
        canvas.drawString(left + 95 * mm, y, "日付：")
        canvas.line(left + 107 * mm, y - 1.2 * mm, width - right, y - 1.2 * mm)
        y -= 8 * mm

        if description:
            set_font(font_body, 10)
            draw_block(description.strip(), font_name=font_body, font_size=10, leading=5 * mm)
            y -= 2 * mm

        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(0.6)
        canvas.line(left, y, width - right, y)
        y -= 7 * mm

    header_block()

    # Collect answers for separate answer sheet (when include_answers=True)
    answer_sheet: list[tuple[int, str, str]] = []

    # Questions (worksheet style)
    for idx, q in enumerate(questions, start=1):
        q_text = (q.get("question_text") or "").strip()
        q_type = (q.get("question_type") or "").strip()
        opts = q.get("options") or []
        correct = (q.get("correct_answer") or "").strip()
        explanation = (q.get("explanation") or "").strip()

        if include_answers and (correct or explanation):
            answer_sheet.append((idx, correct, explanation))

        # Estimate needed space roughly; if tight, page break before box
        approx_lines = max(1, len(wrap_text(q_text, width - left - right - 8 * mm, font_body, 11)))
        approx_height = (approx_lines * 6 * mm) + (len(opts) * 5.5 * mm) + (18 * mm)
        ensure_space(min(approx_height, height / 2))

        # Box
        box_x = left
        box_w = width - left - right
        box_top_y = y

        # Content inside box
        inner_left = left + 4 * mm
        inner_right = right + 4 * mm
        old_left, old_right = left, right
        left, right = inner_left, inner_right

        set_font(font_bold, 12)
        draw_block(f"Q{idx}. {q_text}", font_name=font_bold, font_size=12, leading=6 * mm)

        if opts:
            set_font(font_body, 11)
            for oi, opt in enumerate(opts, start=1):
                draw_block(f"  {oi}) {str(opt)}", font_name=font_body, font_size=11, leading=5.5 * mm)

        if not include_answers:
            # Answer area (blank lines)
            y -= 3 * mm
            set_font(font_body, 10)
            canvas.setFillColor(colors.black)
            canvas.drawString(left, y, "解答：")
            y -= 6 * mm
            canvas.setStrokeColor(colors.black)
            canvas.setLineWidth(0.6)
            for _ in range(2):
                ensure_space(6 * mm)
                canvas.line(left, y, width - right, y)
                y -= 7 * mm

        # restore margins
        left, right = old_left, old_right

        # Draw rectangle around question block
        box_bottom_y = y - 2 * mm
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(0.8)
        canvas.rect(box_x, box_bottom_y, box_w, box_top_y - box_bottom_y, stroke=1, fill=0)

        y -= 7 * mm

    if include_answers and answer_sheet:
        new_page()
        y = height - top
        draw_centered("解答・解説", y, font_bold, 16)
        y -= 8 * mm
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(1)
        canvas.line(left, y, width - right, y)
        y -= 8 * mm

        for idx, correct, explanation in answer_sheet:
            ensure_space(18 * mm)
            set_font(font_bold, 12)
            draw_block(f"Q{idx}", font_name=font_bold, font_size=12, leading=6 * mm)
            if correct:
                set_font(font_body, 11)
                draw_block(f"解答: {correct}", font_name=font_body, font_size=11, leading=5.5 * mm)
            if explanation:
                set_font(font_body, 10)
                draw_block(f"解説: {explanation}", font_name=font_body, font_size=10, leading=5 * mm)
            y -= 5 * mm

    canvas.save()
    return buf.getvalue()

