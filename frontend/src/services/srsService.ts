import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SRSState {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
  lastReviewDate: string;
  stability: number;
}

export type SRSMap = Record<string, SRSState>;

const SRS_KEY_PREFIX = "@srs_state_";
const FLASHCARD_KEY_PREFIX = "@flashcard_answers_";

function createDefaultState(): SRSState {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date().toISOString(),
    lastReviewDate: new Date().toISOString(),
    stability: 1,
  };
}

function qualityFromAnswer(isCorrect: boolean, answerTimeSec: number): number {
  if (!isCorrect) return 1;
  if (answerTimeSec > 30) return 3;
  if (answerTimeSec > 10) return 4;
  return 5;
}

function applySmTwo(prev: SRSState, quality: number): SRSState {
  const now = new Date().toISOString();
  let { easeFactor, interval, repetitions } = prev;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    easeFactor = Math.max(
      1.3,
      easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    );
    repetitions += 1;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  const stability = Math.max(1, interval * easeFactor);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewDate: nextDate.toISOString(),
    lastReviewDate: now,
    stability,
  };
}

function computeRetention(state: SRSState): number {
  const now = Date.now();
  const last = new Date(state.lastReviewDate).getTime();
  const elapsedDays = (now - last) / (1000 * 60 * 60 * 24);
  if (elapsedDays <= 0) return 1;
  const s = Math.max(1, state.stability);
  return Math.exp(-elapsedDays / s);
}

export const srsService = {
  async getSRSMap(setId: string): Promise<SRSMap> {
    try {
      const raw = await AsyncStorage.getItem(`${SRS_KEY_PREFIX}${setId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  async saveSRSMap(setId: string, map: SRSMap): Promise<void> {
    await AsyncStorage.setItem(
      `${SRS_KEY_PREFIX}${setId}`,
      JSON.stringify(map)
    );
  },

  async updateAfterAnswer(
    setId: string,
    questionId: string,
    isCorrect: boolean,
    answerTimeSec: number
  ): Promise<SRSState> {
    const map = await this.getSRSMap(setId);
    const prev = map[questionId] || createDefaultState();
    const quality = qualityFromAnswer(isCorrect, answerTimeSec);
    const next = applySmTwo(prev, quality);
    map[questionId] = next;
    await this.saveSRSMap(setId, map);
    return next;
  },

  getRetention(state: SRSState): number {
    return computeRetention(state);
  },

  async getDueQuestions(setId: string): Promise<string[]> {
    const map = await this.getSRSMap(setId);
    const now = Date.now();
    return Object.entries(map)
      .filter(([, s]) => new Date(s.nextReviewDate).getTime() <= now)
      .map(([id]) => id);
  },

  async getDueCount(setId: string): Promise<number> {
    const due = await this.getDueQuestions(setId);
    return due.length;
  },

  async getLowestRetentionQuestions(
    setId: string,
    n: number,
    questionIds: string[]
  ): Promise<string[]> {
    const targetN = Math.max(0, Math.floor(n));
    if (targetN === 0) return [];

    const map = await this.getSRSMap(setId);

    const scored = questionIds
      .filter(Boolean)
      .map((qid) => {
        const state = map[qid];
        // 未学習（状態なし）は保持率を最小として優先的に出す
        const retention = state ? computeRetention(state) : -1;
        return { qid, retention };
      });

    scored.sort((a, b) => a.retention - b.retention);
    return scored.slice(0, targetN).map((x) => x.qid);
  },

  async getMostIncorrectQuestions(
    setId: string,
    n: number,
    questionIds: string[]
  ): Promise<string[]> {
    const targetN = Math.max(0, Math.floor(n));
    if (targetN === 0) return [];

    try {
      const raw = await AsyncStorage.getItem(`${FLASHCARD_KEY_PREFIX}${setId}`);
      const answers: {
        question_id: string;
        is_correct: boolean;
      }[] = raw ? JSON.parse(raw) : [];

      const incorrectCount = new Map<string, number>();
      const attemptCount = new Map<string, number>();

      for (const a of answers) {
        const qid = a.question_id;
        attemptCount.set(qid, (attemptCount.get(qid) || 0) + 1);
        if (!a.is_correct) {
          incorrectCount.set(qid, (incorrectCount.get(qid) || 0) + 1);
        }
      }

      const scored = questionIds
        .filter(Boolean)
        .map((qid) => ({
          qid,
          incorrect: incorrectCount.get(qid) || 0,
          attempts: attemptCount.get(qid) || 0,
        }));

      // 間違いが多い順 → 同数なら試行回数が少ない順 → それでも同数ならidで安定ソート
      scored.sort((a, b) => {
        if (b.incorrect !== a.incorrect) return b.incorrect - a.incorrect;
        if (a.attempts !== b.attempts) return a.attempts - b.attempts;
        return a.qid.localeCompare(b.qid);
      });

      return scored.slice(0, targetN).map((x) => x.qid);
    } catch {
      return [];
    }
  },

  async initializeFromHistory(
    setId: string,
    questionIds: string[]
  ): Promise<SRSMap> {
    const existing = await this.getSRSMap(setId);
    if (Object.keys(existing).length > 0) return existing;

    try {
      const raw = await AsyncStorage.getItem(
        `${FLASHCARD_KEY_PREFIX}${setId}`
      );
      if (!raw) return {};

      const answers: {
        question_id: string;
        is_correct: boolean;
        answer_time_sec: number;
        answered_at: string;
      }[] = JSON.parse(raw);

      const grouped = new Map<string, typeof answers>();
      for (const a of answers) {
        if (!questionIds.includes(a.question_id)) continue;
        const list = grouped.get(a.question_id) || [];
        list.push(a);
        grouped.set(a.question_id, list);
      }

      const map: SRSMap = {};
      for (const [qid, list] of grouped.entries()) {
        list.sort(
          (a, b) =>
            new Date(a.answered_at).getTime() -
            new Date(b.answered_at).getTime()
        );
        let state = createDefaultState();
        for (const a of list) {
          const q = qualityFromAnswer(a.is_correct, a.answer_time_sec);
          state = applySmTwo(state, q);
          state.lastReviewDate = a.answered_at;
        }
        const nextDate = new Date(state.lastReviewDate);
        nextDate.setDate(nextDate.getDate() + state.interval);
        state.nextReviewDate = nextDate.toISOString();
        state.stability = Math.max(1, state.interval * state.easeFactor);
        map[qid] = state;
      }

      await this.saveSRSMap(setId, map);
      return map;
    } catch {
      return {};
    }
  },

  getNextReviewDate(map: SRSMap): string | null {
    const dates = Object.values(map).map((s) => s.nextReviewDate);
    if (dates.length === 0) return null;
    dates.sort();
    return dates[0];
  },

  formatRetention(retention: number): string {
    return `${Math.round(retention * 100)}%`;
  },

  formatNextReview(nextReviewDate: string, t: (en: string, ja: string) => string): string {
    const now = new Date();
    const next = new Date(nextReviewDate);
    const diffMs = next.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return t("Due now", "復習期限切れ");
    if (diffDays === 1) return t("Tomorrow", "明日");
    return `${diffDays}${t(" days later", "日後")}`;
  },
};
