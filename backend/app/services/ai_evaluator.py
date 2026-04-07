"""
AI回答評価サービス
独自ルールベース手法のみを使用してtext_input問題の回答を意味的に評価
外部ライブラリ不使用 ── 標準的な文字列操作のみで実装
"""
import re
import unicodedata
from typing import Optional


def normalize_text(text: str) -> str:
    """テキストを正規化（全角半角、大文字小文字、空白など）"""
    text = unicodedata.normalize('NFKC', text)
    text = text.strip()
    text = text.lower()
    text = re.sub(r'\s+', ' ', text)
    return text


def levenshtein_distance(s1: str, s2: str) -> int:
    """レーベンシュタイン距離を計算（DP）"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            cost = 0 if c1 == c2 else 1
            curr_row.append(min(
                curr_row[j] + 1,       # insertion
                prev_row[j + 1] + 1,   # deletion
                prev_row[j] + cost,    # substitution
            ))
        prev_row = curr_row

    return prev_row[-1]


def calculate_similarity(s1: str, s2: str) -> float:
    """2つの文字列のレーベンシュタイン距離ベースの類似度 (0.0–1.0)"""
    longer = max(len(s1), len(s2))
    if longer == 0:
        return 1.0
    dist = levenshtein_distance(s1, s2)
    return (longer - dist) / longer


def remove_punctuation(text: str) -> str:
    """日本語・英語の句読点や記号を削除"""
    return re.sub(
        r'[、。，．,!！?？;；:：\'\"\'\'""（）()\[\]【】『』「」\-\s]',
        '', text,
    )


def extract_numbers(text: str) -> list[str]:
    """テキストから数値（整数・小数）を抽出"""
    return re.findall(r'-?\d+\.?\d*', text)


def numbers_match(correct: str, user: str) -> tuple[bool, float]:
    """数値が含まれる回答の数値一致を確認"""
    cn = extract_numbers(correct)
    un = extract_numbers(user)
    if not cn:
        return False, 0.0
    if cn == un:
        return True, 0.95
    return False, 0.0


_NUMBER_CONVERSIONS: dict[str, list[str]] = {
    '0': ['〇', 'ゼロ', 'ぜろ', '零', 'れい'],
    '1': ['一', 'いち', 'ひとつ', '1つ'],
    '2': ['二', 'に', 'ふたつ', '2つ'],
    '3': ['三', 'さん', 'みっつ', '3つ'],
    '4': ['四', 'よん', 'し', 'よっつ', '4つ'],
    '5': ['五', 'ご', 'いつつ', '5つ'],
    '6': ['六', 'ろく', 'むっつ', '6つ'],
    '7': ['七', 'なな', 'しち', 'ななつ', '7つ'],
    '8': ['八', 'はち', 'やっつ', '8つ'],
    '9': ['九', 'きゅう', 'く', 'ここのつ', '9つ'],
    '10': ['十', 'じゅう', 'とお'],
}


def normalize_numbers(text: str) -> str:
    """数字表現を統一（全角→半角、漢数字→アラビア数字）"""
    normalized = re.sub(
        r'[０-９]',
        lambda m: chr(ord(m.group()) - 0xFEE0),
        text,
    )
    for digit, variants in _NUMBER_CONVERSIONS.items():
        for v in variants:
            normalized = normalized.replace(v, digit)
    return normalized


def katakana_to_hiragana(text: str) -> str:
    """カタカナをひらがなに変換"""
    return re.sub(
        r'[\u30A1-\u30F6]',
        lambda m: chr(ord(m.group()) - 0x60),
        text,
    )


def reading_match(correct: str, user: str) -> tuple[bool, float]:
    """カタカナ⇔ひらがなの読み一致チェック"""
    c_hira = katakana_to_hiragana(normalize_text(correct))
    u_hira = katakana_to_hiragana(normalize_text(user))

    if c_hira == u_hira:
        return True, 0.97

    clean_c = remove_punctuation(c_hira)
    clean_u = remove_punctuation(u_hira)
    if clean_c == clean_u:
        return True, 0.96

    has_kanji = lambda s: bool(re.search(r'[\u4E00-\u9FFF]', s))
    is_only_kana = lambda s: bool(re.fullmatch(r'[\u3040-\u309F\u30A0-\u30FF\s]+', s))

    if has_kanji(correct) and is_only_kana(user):
        kanji_count = len(re.findall(r'[\u4E00-\u9FFF]', correct))
        kana_count = len(clean_u)
        if kanji_count * 1.5 <= kana_count <= kanji_count * 5:
            return True, 0.85

    if is_only_kana(correct) and has_kanji(user):
        kanji_count = len(re.findall(r'[\u4E00-\u9FFF]', user))
        kana_count = len(clean_c)
        if kanji_count * 1.5 <= kana_count <= kanji_count * 5:
            return True, 0.85

    return False, 0.0


def contains_match(correct: str, user: str) -> tuple[bool, float]:
    """一方が他方を含んでいるかチェック"""
    clean_c = remove_punctuation(normalize_text(correct))
    clean_u = remove_punctuation(normalize_text(user))
    if not clean_c or not clean_u:
        return False, 0.0

    if clean_c in clean_u or clean_u in clean_c:
        shorter = min(len(clean_c), len(clean_u))
        longer = max(len(clean_c), len(clean_u))
        if shorter / longer >= 0.5:
            return True, 0.85
    return False, 0.0


def word_overlap_match(correct: str, user: str) -> tuple[bool, float]:
    """単語レベルの一致（英語等スペース区切り向け）"""
    cw = [w for w in normalize_text(correct).split() if w]
    uw = [w for w in normalize_text(user).split() if w]
    if not cw or not uw:
        return False, 0.0

    cs, us = set(cw), set(uw)
    inter = cs & us
    precision = len(inter) / len(us)
    recall = len(inter) / len(cs)
    if precision == 0 or recall == 0:
        return False, 0.0

    f1 = 2 * precision * recall / (precision + recall)
    if f1 >= 0.7:
        return True, min(0.9, f1)
    return False, f1


def evaluate_semantic_similarity(
    correct_answer: str,
    user_answer: str,
) -> tuple[bool, float, str]:
    """独自ルールで意味的類似度を評価"""
    norm_c = normalize_text(correct_answer)
    norm_u = normalize_text(user_answer)

    if norm_c == norm_u:
        return True, 1.0, "完全一致！正解です。"

    clean_c = remove_punctuation(norm_c)
    clean_u = remove_punctuation(norm_u)
    if clean_c == clean_u:
        return True, 0.98, "表現は少し異なりますが、正解です！"

    num_c = normalize_numbers(clean_c)
    num_u = normalize_numbers(clean_u)
    if num_c == num_u:
        return True, 0.95, "数字表現が正解です！"

    ok, conf = reading_match(correct_answer, user_answer)
    if ok:
        return True, conf, "読みが正解です！"

    ok, conf = numbers_match(correct_answer, user_answer)
    if ok:
        return True, conf, "数値が正解です！"

    ok, conf = contains_match(correct_answer, user_answer)
    if ok:
        return True, conf, "正解です！"

    ok, conf = word_overlap_match(correct_answer, user_answer)
    if ok:
        return True, conf, "正解です！表現が少し異なります。"

    similarity = calculate_similarity(clean_c, clean_u)

    if similarity >= 0.85:
        return True, 0.9, "ほぼ正解です！わずかな表現の違いがあります。"
    if similarity >= 0.7:
        return True, 0.8, "正解です！表現が少し異なりますが、意味は合っています。"
    if similarity >= 0.55:
        return True, 0.7, "概ね正解です！細かい表現に違いがあります。"
    if similarity >= 0.4:
        return False, 0.4, "惜しい！部分的に正しいですが、違いがあります。"
    return False, 0.2, "残念ながら不正解です。正解と大きく異なります。"


async def evaluate_text_answer(
    question_text: str,
    correct_answer: str,
    user_answer: str,
    explanation: Optional[str] = None,
) -> dict:
    """
    text_input問題の回答を意味的に評価

    Returns:
        {"is_correct": bool, "confidence": float, "feedback": str, "exact_match": bool}
    """
    first_line = correct_answer.split('\n')[0].strip()
    patterns = [p.strip() for p in first_line.split('/')]

    best: dict = {
        "is_correct": False,
        "confidence": 0.0,
        "feedback": "残念ながら不正解です。正解と大きく異なります。",
        "exact_match": False,
    }

    for pattern in patterns:
        if pattern.strip() == user_answer.strip():
            return {
                "is_correct": True,
                "confidence": 1.0,
                "feedback": "完全一致！正解です。",
                "exact_match": True,
            }

        ok, conf, fb = evaluate_semantic_similarity(pattern, user_answer)
        if conf > best["confidence"]:
            best = {
                "is_correct": ok,
                "confidence": conf,
                "feedback": fb,
                "exact_match": False,
            }
        if ok and conf >= 0.7:
            return best

    return best


async def batch_evaluate_answers(evaluations: list[dict]) -> list[dict]:
    """複数の回答を一括評価"""
    results = []
    for ev in evaluations:
        r = await evaluate_text_answer(
            question_text=ev["question_text"],
            correct_answer=ev["correct_answer"],
            user_answer=ev["user_answer"],
            explanation=ev.get("explanation"),
        )
        results.append(r)
    return results
