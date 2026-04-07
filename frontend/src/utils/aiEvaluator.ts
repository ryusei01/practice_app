/**
 * AI回答評価ユーティリティ
 * 独自ルールベース手法のみでtext_input問題の回答を評価
 */

interface EvaluationResult {
  is_correct: boolean;
  confidence: number;
  feedback: string;
  exact_match: boolean;
}

/**
 * 不可視文字（ゼロ幅スペース、BOM等）を除去
 */
function stripInvisible(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u2060\u2061-\u2064\u2066-\u2069]/g, '');
}

/**
 * テキストを正規化（全角半角、大文字小文字、空白など）
 */
function normalizeText(text: string): string {
  let normalized = text.normalize('NFKC');
  normalized = stripInvisible(normalized);
  normalized = normalized.trim();
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized;
}

/**
 * 2つの文字列の類似度を計算（レーベンシュタイン距離ベース）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * レーベンシュタイン距離を計算
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * 句読点や記号を削除
 */
function removePunctuation(text: string): string {
  // 日本語・英語の句読点を削除
  const punctuation = /[、。，．,!！?？;；:：'"''""（）()\[\]【】『』「」\-\s]/g;
  return text.replace(punctuation, '');
}

/**
 * テキストから数値を抽出
 */
function extractNumbers(text: string): string[] {
  // 整数と小数を抽出
  const matches = text.match(/-?\d+\.?\d*/g);
  return matches || [];
}

/**
 * 数値が含まれる回答の場合、数値の一致を確認
 */
function numbersMatch(correctAnswer: string, userAnswer: string): { match: boolean; confidence: number } {
  const correctNums = extractNumbers(correctAnswer);
  const userNums = extractNumbers(userAnswer);

  if (correctNums.length === 0) {
    return { match: false, confidence: 0.0 };
  }

  if (JSON.stringify(correctNums) === JSON.stringify(userNums)) {
    return { match: true, confidence: 0.95 };
  }

  return { match: false, confidence: 0.0 };
}

/**
 * カタカナをひらがなに変換
 */
function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * 数字と漢数字・かなの対応表
 */
const numberConversions: { [key: string]: string[] } = {
  '0': ['〇', 'ゼロ', 'ぜろ', '零', 'れい'],
  '1': ['一', 'いち', '１', 'ひとつ', '1つ'],
  '2': ['二', 'に', '２', 'ふたつ', '2つ'],
  '3': ['三', 'さん', '３', 'みっつ', '3つ'],
  '4': ['四', 'よん', 'し', '４', 'よっつ', '4つ'],
  '5': ['五', 'ご', '５', 'いつつ', '5つ'],
  '6': ['六', 'ろく', '６', 'むっつ', '6つ'],
  '7': ['七', 'なな', 'しち', '７', 'ななつ', '7つ'],
  '8': ['八', 'はち', '８', 'やっつ', '8つ'],
  '9': ['九', 'きゅう', 'く', '９', 'ここのつ', '9つ'],
  '10': ['十', 'じゅう', 'とお', '１０'],
};

/**
 * 数字表現の正規化（アラビア数字、漢数字、かな表記の統一）
 */
function normalizeNumbers(text: string): string {
  let normalized = text;

  // 全角数字を半角に変換（NFKC正規化で対応済みだが明示的に）
  normalized = normalized.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

  // 漢数字・かな表記をアラビア数字に変換
  for (const [digit, variants] of Object.entries(numberConversions)) {
    for (const variant of variants) {
      // 完全一致または単語境界でのみ置換
      const regex = new RegExp(`\\b${variant}\\b|${variant}(?=[のつ])`, 'g');
      normalized = normalized.replace(regex, digit);
    }
  }

  return normalized;
}

/**
 * 漢字の読み（ひらがな・カタカナ）が一致するかチェック
 */
function readingMatch(correctAnswer: string, userAnswer: string): { match: boolean; confidence: number } {
  const hasKanji = (str: string) => /[\u4E00-\u9FFF]/.test(str);
  const hasKana = (str: string) => /[\u3040-\u309F\u30A0-\u30FF]/.test(str);
  const isOnlyKana = (str: string) => /^[\u3040-\u309F\u30A0-\u30FF\s]+$/.test(str);

  // 両方をひらがなに統一（カタカナのみ変換）
  const correctHiragana = katakanaToHiragana(normalizeText(correctAnswer));
  const userHiragana = katakanaToHiragana(normalizeText(userAnswer));

  // 完全一致（カタカナ⇔ひらがな）
  if (correctHiragana === userHiragana) {
    return { match: true, confidence: 0.97 };
  }

  // 句読点を除いて一致
  const cleanCorrect = removePunctuation(correctHiragana);
  const cleanUser = removePunctuation(userHiragana);

  if (cleanCorrect === cleanUser) {
    return { match: true, confidence: 0.96 };
  }

  // 一方が漢字・もう一方がかなの場合（簡易的な読みチェック）
  // 例: 「東京」vs「とうきょう」, 「東京」vs「トウキョウ」
  if (hasKanji(correctAnswer) && isOnlyKana(userAnswer)) {
    // 正解が漢字含む、回答がかなのみ → 読みの可能性が高い
    // 漢字1文字は通常1.5-4文字のかなになる(例: 「日」→「に」1文字、「本」→「ほん」2文字)
    const kanjiCount = (correctAnswer.match(/[\u4E00-\u9FFF]/g) || []).length;
    const kanaCount = cleanUser.length;

    // 条件: 漢字数 * 1.5 以上、かつ漢字数 * 5 以下
    // 例: 漢字2文字 → 3-10文字のかなが妥当
    if (kanaCount >= Math.floor(kanjiCount * 1.5) && kanaCount <= kanjiCount * 5) {
      return { match: true, confidence: 0.85 };
    }
  }

  if (isOnlyKana(correctAnswer) && hasKanji(userAnswer)) {
    // 正解がかな、回答が漢字 → 逆パターン（例: りんご vs 林檎）
    const kanjiCount = (userAnswer.match(/[\u4E00-\u9FFF]/g) || []).length;
    const kanaCount = cleanCorrect.length;

    // かな数が漢字数 * 1.5 以上、かつ漢字数 * 5 以下なら可能性あり
    if (kanaCount >= Math.floor(kanjiCount * 1.5) && kanaCount <= kanjiCount * 5) {
      return { match: true, confidence: 0.85 };
    }
  }

  return { match: false, confidence: 0.0 };
}

/**
 * 選択肢記号の先頭プレフィックスを除去（例: "A. 東京" → "東京", "A) answer" → "answer"）
 */
function stripOptionPrefix(text: string): string {
  return text.replace(/^[A-Za-z\uFF21-\uFF3A\uFF41-\uFF5A\u30A2\u30A4\u30A6\u30A8\u30AA]\s*[.):\s、．）]\s*/, '').trim();
}

/**
 * 一方が他方を含んでいるかチェック
 */
function containsMatch(correctAnswer: string, userAnswer: string): { match: boolean; confidence: number } {
  const cleanCorrect = removePunctuation(normalizeText(correctAnswer));
  const cleanUser = removePunctuation(normalizeText(userAnswer));

  if (!cleanCorrect || !cleanUser) return { match: false, confidence: 0 };

  if (cleanCorrect.includes(cleanUser) || cleanUser.includes(cleanCorrect)) {
    const shorter = Math.min(cleanCorrect.length, cleanUser.length);
    const longer = Math.max(cleanCorrect.length, cleanUser.length);
    const ratio = shorter / longer;
    if (ratio >= 0.5) {
      return { match: true, confidence: 0.85 };
    }
  }

  return { match: false, confidence: 0 };
}

/**
 * 選択肢記号としてのマッチ（"A" → "A. 東京" の先頭記号と一致）
 */
function optionLabelMatch(correctAnswer: string, userAnswer: string): { match: boolean; confidence: number } {
  const normUser = normalizeText(userAnswer);
  if (normUser.length > 3) return { match: false, confidence: 0 };

  const normCorrect = normalizeText(correctAnswer);
  const optionPattern = /^([a-z\uFF41-\uFF5A\u30A2\u30A4\u30A6\u30A8\u30AA])\s*[.):\s、．）]/;
  const m = normCorrect.match(optionPattern);
  if (m && m[1] === normUser) {
    return { match: true, confidence: 0.92 };
  }
  return { match: false, confidence: 0 };
}

/**
 * 単語レベルの一致をチェック（英語向け）
 */
function wordOverlapMatch(correctAnswer: string, userAnswer: string): { match: boolean; confidence: number } {
  const correctWords = normalizeText(correctAnswer).split(/\s+/).filter(w => w.length > 0);
  const userWords = normalizeText(userAnswer).split(/\s+/).filter(w => w.length > 0);

  if (correctWords.length === 0 || userWords.length === 0) return { match: false, confidence: 0 };

  const correctSet = new Set(correctWords);
  const userSet = new Set(userWords);
  const intersection = correctWords.filter((w, i, arr) => arr.indexOf(w) === i && userSet.has(w));

  const precision = intersection.length / userSet.size;
  const recall = intersection.length / correctSet.size;

  if (precision === 0 || recall === 0) return { match: false, confidence: 0 };
  const f1 = 2 * (precision * recall) / (precision + recall);

  if (f1 >= 0.7) {
    return { match: true, confidence: Math.min(0.9, f1) };
  }

  return { match: false, confidence: f1 };
}

/**
 * 意味的類似度を評価
 */
function evaluateSemanticSimilarity(correctAnswer: string, userAnswer: string, lang: 'en' | 'ja' = 'en'): {
  isCorrect: boolean;
  confidence: number;
  feedback: string;
} {
  const normCorrect = normalizeText(correctAnswer);
  const normUser = normalizeText(userAnswer);

  if (normCorrect === normUser) {
    return {
      isCorrect: true,
      confidence: 1.0,
      feedback: lang === 'ja' ? '完全一致！正解です。' : 'Perfect match!',
    };
  }

  const cleanCorrect = removePunctuation(normCorrect);
  const cleanUser = removePunctuation(normUser);

  if (cleanCorrect === cleanUser) {
    return {
      isCorrect: true,
      confidence: 0.98,
      feedback: lang === 'ja' ? '表現は少し異なりますが、正解です！' : 'Correct! Slightly different expression.',
    };
  }

  const numNormCorrect = normalizeNumbers(cleanCorrect);
  const numNormUser = normalizeNumbers(cleanUser);

  if (numNormCorrect === numNormUser) {
    return {
      isCorrect: true,
      confidence: 0.95,
      feedback: lang === 'ja' ? '数字表現が正解です！' : 'Correct number!',
    };
  }

  const { match: isReadingMatch, confidence: readingConfidence } = readingMatch(correctAnswer, userAnswer);
  if (isReadingMatch) {
    return {
      isCorrect: true,
      confidence: readingConfidence,
      feedback: lang === 'ja' ? '読みが正解です！' : 'Correct reading!',
    };
  }

  const { match: isNumberMatch, confidence: numConfidence } = numbersMatch(correctAnswer, userAnswer);
  if (isNumberMatch) {
    return {
      isCorrect: true,
      confidence: numConfidence,
      feedback: lang === 'ja' ? '数値が正解です！' : 'Correct number!',
    };
  }

  // 選択肢記号マッチ（"A" → "A. 東京" の先頭ラベル一致）
  const { match: isOptionLabel, confidence: optionConf } = optionLabelMatch(correctAnswer, userAnswer);
  if (isOptionLabel) {
    return {
      isCorrect: true,
      confidence: optionConf,
      feedback: lang === 'ja' ? '正解です！' : 'Correct!',
    };
  }

  // プレフィックスを除去して再比較（"A. 東京" vs "東京" → 一致）
  const strippedCorrect = stripOptionPrefix(normalizeText(correctAnswer));
  const strippedUser = stripOptionPrefix(normalizeText(userAnswer));
  if (strippedCorrect && strippedUser && strippedCorrect === strippedUser) {
    return {
      isCorrect: true,
      confidence: 0.93,
      feedback: lang === 'ja' ? '正解です！' : 'Correct!',
    };
  }

  // 包含チェック（一方がもう一方を含む）
  const { match: isContains, confidence: containsConf } = containsMatch(correctAnswer, userAnswer);
  if (isContains) {
    return {
      isCorrect: true,
      confidence: containsConf,
      feedback: lang === 'ja' ? '正解です！' : 'Correct!',
    };
  }

  // 単語レベル一致（英語等スペース区切り言語向け）
  const { match: isWordMatch, confidence: wordConf } = wordOverlapMatch(correctAnswer, userAnswer);
  if (isWordMatch) {
    return {
      isCorrect: true,
      confidence: wordConf,
      feedback: lang === 'ja' ? '正解です！表現が少し異なります。' : 'Correct! Slightly different wording.',
    };
  }

  const similarity = calculateSimilarity(cleanCorrect, cleanUser);

  if (similarity >= 0.85) {
    return {
      isCorrect: true,
      confidence: 0.9,
      feedback: lang === 'ja' ? 'ほぼ正解です！わずかな表現の違いがあります。' : 'Almost perfect! Minor differences.',
    };
  } else if (similarity >= 0.7) {
    return {
      isCorrect: true,
      confidence: 0.8,
      feedback: lang === 'ja' ? '正解です！表現が少し異なりますが、意味は合っています。' : 'Correct! Slightly different but same meaning.',
    };
  } else if (similarity >= 0.55) {
    return {
      isCorrect: true,
      confidence: 0.7,
      feedback: lang === 'ja' ? '概ね正解です！細かい表現に違いがあります。' : 'Mostly correct! Some differences but right meaning.',
    };
  } else if (similarity >= 0.4) {
    return {
      isCorrect: false,
      confidence: 0.4,
      feedback: lang === 'ja' ? '惜しい！部分的に正しいですが、違いがあります。' : 'Close! Partially correct but some differences.',
    };
  } else {
    return {
      isCorrect: false,
      confidence: 0.2,
      feedback: lang === 'ja' ? '残念ながら不正解です。正解と大きく異なります。' : 'Incorrect. Very different from the answer.',
    };
  }
}

/**
 * text_input問題の回答を意味的に評価（クライアントサイド版）
 */
export function evaluateTextAnswer(correctAnswer: string, userAnswer: string, lang: 'en' | 'ja' = 'en'): EvaluationResult {
  console.log('[evaluateTextAnswer] Called with:', {
    correctAnswer,
    userAnswer,
  });

  // 改行で分割し、最初の行を正解として使用（例文などを除外）
  const firstLine = correctAnswer.split('\n')[0].trim();

  // 「/」で区切られた複数の正解パターンに対応
  const basePatterns = firstLine.split('/').map(s => s.trim());

  // プレフィックス除去版も候補に追加（重複排除）
  const correctAnswerPatterns = basePatterns.slice();
  for (const p of basePatterns) {
    const stripped = stripOptionPrefix(p);
    if (stripped && stripped !== p.toLowerCase() && correctAnswerPatterns.indexOf(stripped) === -1) {
      correctAnswerPatterns.push(stripped);
    }
  }
  console.log('[evaluateTextAnswer] Patterns:', correctAnswerPatterns);

  let bestResult: EvaluationResult = {
    is_correct: false,
    confidence: 0,
    feedback: lang === 'ja' ? '残念ながら不正解です。正解と大きく異なります。' : 'Incorrect. Very different from the answer.',
    exact_match: false,
  };

  // すべての正解パターンを試して、最も高い信頼度のものを採用
  for (const pattern of correctAnswerPatterns) {
    console.log('[evaluateTextAnswer] Evaluating pattern:', pattern);

    // 完全一致チェック（正規化前）
    const exactMatch = pattern.trim() === userAnswer.trim();
    console.log('[evaluateTextAnswer] Exact match check:', exactMatch);

    if (exactMatch) {
      const result = {
        is_correct: true,
        confidence: 1.0,
        feedback: lang === 'ja' ? '完全一致！正解です。' : 'Perfect match!',
        exact_match: true,
      };
      console.log('[evaluateTextAnswer] Result (exact match):', result);
      return result;
    }

    // 意味的類似度評価
    const { isCorrect, confidence, feedback } = evaluateSemanticSimilarity(pattern, userAnswer, lang);
    console.log('[evaluateTextAnswer] Semantic evaluation result:', { isCorrect, confidence, feedback });

    // より高い信頼度の結果を保持
    if (confidence > bestResult.confidence) {
      bestResult = {
        is_correct: isCorrect,
        confidence,
        feedback,
        exact_match: false,
      };
      console.log('[evaluateTextAnswer] Updated best result:', bestResult);
    }

    // 正解と判定されたら即座に返す（最適化）
    if (isCorrect && confidence >= 0.7) {
      console.log('[evaluateTextAnswer] Early return with result:', bestResult);
      return bestResult;
    }
  }

  console.log('[evaluateTextAnswer] Final result:', bestResult);
  return bestResult;
}
