"""
AI回答評価サービス
無料のルールベース・NLP手法を使用してtext_input問題の回答を意味的に評価
"""
import re
from typing import Optional
from difflib import SequenceMatcher
import unicodedata


def normalize_text(text: str) -> str:
    """
    テキストを正規化（全角半角、大文字小文字、空白など）
    """
    # Unicode正規化
    text = unicodedata.normalize('NFKC', text)
    # 前後の空白削除
    text = text.strip()
    # 小文字化
    text = text.lower()
    # 連続する空白を1つに
    text = re.sub(r'\s+', ' ', text)
    return text


def calculate_similarity(str1: str, str2: str) -> float:
    """
    2つの文字列の類似度を計算（レーベンシュタイン距離ベース）

    Returns:
        0.0-1.0の類似度スコア
    """
    return SequenceMatcher(None, str1, str2).ratio()


def remove_punctuation(text: str) -> str:
    """
    句読点や記号を削除
    """
    # 日本語・英語の句読点を削除
    punctuation = r'[、。，．,!！?？;；:：\'\"\'\'""（）()[\]【】『』「」\-\s]'
    return re.sub(punctuation, '', text)


def extract_numbers(text: str) -> list:
    """
    テキストから数値を抽出
    """
    # 整数と小数を抽出
    return re.findall(r'-?\d+\.?\d*', text)


def numbers_match(correct_answer: str, user_answer: str) -> tuple[bool, float]:
    """
    数値が含まれる回答の場合、数値の一致を確認

    Returns:
        (一致するか, 信頼度)
    """
    correct_nums = extract_numbers(correct_answer)
    user_nums = extract_numbers(user_answer)

    if not correct_nums:
        return False, 0.0

    if correct_nums == user_nums:
        return True, 0.95

    return False, 0.0


def evaluate_semantic_similarity(correct_answer: str, user_answer: str) -> tuple[bool, float, str]:
    """
    意味的類似度を評価

    Returns:
        (正解か, 信頼度, フィードバック)
    """
    # 正規化
    norm_correct = normalize_text(correct_answer)
    norm_user = normalize_text(user_answer)

    # 1. 完全一致チェック（正規化後）
    if norm_correct == norm_user:
        return True, 1.0, "完全一致！正解です。"

    # 2. 句読点を除いた一致チェック
    clean_correct = remove_punctuation(norm_correct)
    clean_user = remove_punctuation(norm_user)

    if clean_correct == clean_user:
        return True, 0.98, "表現は少し異なりますが、正解です！"

    # 3. 数値問題の場合
    is_number_match, num_confidence = numbers_match(correct_answer, user_answer)
    if is_number_match:
        return True, num_confidence, "数値が正解です！"

    # 4. 文字列類似度チェック
    similarity = calculate_similarity(clean_correct, clean_user)

    if similarity >= 0.9:
        return True, 0.9, "ほぼ正解です！わずかな表現の違いがあります。"
    elif similarity >= 0.8:
        return True, 0.8, "正解です！表現が少し異なりますが、意味は合っています。"
    elif similarity >= 0.7:
        return True, 0.7, "概ね正解です！細かい表現に違いがありますが、意味は正しいです。"
    elif similarity >= 0.6:
        return False, 0.6, "惜しい！部分的に正しいですが、いくつか違いがあります。"
    elif similarity >= 0.4:
        return False, 0.4, "部分的に正しいですが、かなり違いがあります。"
    else:
        return False, 0.2, "残念ながら不正解です。正解と大きく異なります。"


async def evaluate_text_answer(
    question_text: str,
    correct_answer: str,
    user_answer: str,
    explanation: Optional[str] = None
) -> dict:
    """
    text_input問題の回答を意味的に評価（無料版）

    Args:
        question_text: 問題文
        correct_answer: 正解
        user_answer: ユーザーの回答
        explanation: 解説（オプション）

    Returns:
        {
            "is_correct": bool,  # 正解かどうか
            "confidence": float,  # 信頼度 (0.0-1.0)
            "feedback": str,     # フィードバック
            "exact_match": bool  # 完全一致かどうか
        }
    """
    # 完全一致チェック（正規化前）
    exact_match = correct_answer.strip() == user_answer.strip()

    if exact_match:
        return {
            "is_correct": True,
            "confidence": 1.0,
            "feedback": "完全一致！正解です。",
            "exact_match": True
        }

    # 意味的類似度評価
    is_correct, confidence, feedback = evaluate_semantic_similarity(
        correct_answer,
        user_answer
    )

    return {
        "is_correct": is_correct,
        "confidence": confidence,
        "feedback": feedback,
        "exact_match": False
    }


async def batch_evaluate_answers(evaluations: list[dict]) -> list[dict]:
    """
    複数の回答を一括評価

    Args:
        evaluations: 評価リスト
        [
            {
                "question_text": str,
                "correct_answer": str,
                "user_answer": str,
                "explanation": str (optional)
            },
            ...
        ]

    Returns:
        評価結果のリスト
    """
    results = []
    for eval_data in evaluations:
        result = await evaluate_text_answer(
            question_text=eval_data["question_text"],
            correct_answer=eval_data["correct_answer"],
            user_answer=eval_data["user_answer"],
            explanation=eval_data.get("explanation")
        )
        results.append(result)

    return results
