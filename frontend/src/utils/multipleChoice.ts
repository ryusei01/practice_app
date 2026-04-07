export function getMultipleChoiceAnswerIndex(
  answer: string | null | undefined,
  options?: string[] | null,
): number | null {
  const trimmed = (answer || "").trim();
  if (!trimmed) return null;

  if (/^[1-4]$/.test(trimmed)) {
    const index = Number(trimmed) - 1;
    if (!options || index < options.length) return index;
  }

  if (/^[A-Da-d]$/.test(trimmed)) {
    const index = trimmed.toUpperCase().charCodeAt(0) - 65;
    if (!options || index < options.length) return index;
  }

  const stripped = trimmed.replace(/^([A-Da-d]|[1-4])[.)、:：]\s*/, "").trim();
  const candidates = [trimmed, stripped];

  if (options && options.length > 0) {
    for (const candidate of candidates) {
      const index = options.findIndex((option) => option.trim() === candidate);
      if (index >= 0) return index;
    }
  }

  return null;
}

export function normalizeMultipleChoiceAnswer(
  answer: string | null | undefined,
  options?: string[] | null,
): string | null {
  const index = getMultipleChoiceAnswerIndex(answer, options);
  return index === null ? null : String(index + 1);
}

export function getMultipleChoiceAnswerText(
  answer: string | null | undefined,
  options?: string[] | null,
): string {
  const index = getMultipleChoiceAnswerIndex(answer, options);
  if (index !== null && options && options[index]) {
    return options[index];
  }
  return (answer || "").trim();
}

export function isMultipleChoiceCorrect(
  userAnswer: string,
  correctAnswer: string,
  options?: string[] | null,
): boolean {
  const normalizedUser = normalizeMultipleChoiceAnswer(userAnswer, options);
  const normalizedCorrect = normalizeMultipleChoiceAnswer(correctAnswer, options);

  if (normalizedUser && normalizedCorrect) {
    return normalizedUser === normalizedCorrect;
  }

  return userAnswer.trim() === correctAnswer.trim();
}
