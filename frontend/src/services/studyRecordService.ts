import AsyncStorage from "@react-native-async-storage/async-storage";

export type StudyRecordDateKey = `${number}-${number}-${number}`; // YYYY-MM-DD (local)

export interface StudyRecord {
  date: StudyRecordDateKey;
  count: number;
  correct: number;
  studyTime: number; // seconds
}

export interface StudyAggregate {
  count: number;
  correct: number;
  studyTime: number; // seconds
}

const STORAGE_KEY = "study_records_v1";

function clampNonNegativeInt(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function toLocalDateKey(d: Date): StudyRecordDateKey {
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` as StudyRecordDateKey;
}

function parseDateKey(key: StudyRecordDateKey): Date {
  // Interpreting as local date at 00:00.
  const [y, m, d] = key.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function sumAggregate(records: StudyRecord[]): StudyAggregate {
  return records.reduce<StudyAggregate>(
    (acc, r) => {
      acc.count += r.count;
      acc.correct += r.correct;
      acc.studyTime += r.studyTime;
      return acc;
    },
    { count: 0, correct: 0, studyTime: 0 }
  );
}

export const studyRecordService = {
  async getRecords(): Promise<StudyRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(parsed)) return [];

      const cleaned: StudyRecord[] = [];
      for (const item of parsed) {
        if (
          item &&
          typeof item === "object" &&
          typeof (item as any).date === "string" &&
          typeof (item as any).count === "number" &&
          typeof (item as any).correct === "number" &&
          typeof (item as any).studyTime === "number"
        ) {
          cleaned.push({
            date: (item as any).date,
            count: clampNonNegativeInt((item as any).count),
            correct: clampNonNegativeInt((item as any).correct),
            studyTime: clampNonNegativeInt((item as any).studyTime),
          });
        }
      }

      cleaned.sort((a, b) => a.date.localeCompare(b.date));
      return cleaned;
    } catch {
      return [];
    }
  },

  async setRecords(records: StudyRecord[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  },

  async addRecord(input: {
    count: number;
    correct: number;
    studyTimeSec: number;
    date?: Date;
  }): Promise<void> {
    const count = clampNonNegativeInt(input.count);
    const correct = clampNonNegativeInt(input.correct);
    const studyTime = clampNonNegativeInt(input.studyTimeSec);
    if (count === 0 && correct === 0 && studyTime === 0) return;

    const dateKey = toLocalDateKey(input.date ?? new Date());

    const records = await this.getRecords();
    const idx = records.findIndex((r) => r.date === dateKey);
    if (idx >= 0) {
      records[idx] = {
        date: dateKey,
        count: records[idx].count + count,
        correct: records[idx].correct + correct,
        studyTime: records[idx].studyTime + studyTime,
      };
    } else {
      records.push({ date: dateKey, count, correct, studyTime });
      records.sort((a, b) => a.date.localeCompare(b.date));
    }

    await this.setRecords(records);
  },

  async getTodayAggregate(now: Date = new Date()): Promise<StudyAggregate> {
    const records = await this.getRecords();
    const todayKey = toLocalDateKey(now);
    const rec = records.find((r) => r.date === todayKey);
    return rec ? { count: rec.count, correct: rec.correct, studyTime: rec.studyTime } : { count: 0, correct: 0, studyTime: 0 };
  },

  async getWeekAggregate(now: Date = new Date()): Promise<StudyAggregate> {
    // "今週"は複雑な週開始曜日に依存せず、直近7日（今日含む）で定義する。
    const records = await this.getRecords();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const filtered = records.filter((r) => {
      const d = parseDateKey(r.date);
      return d >= start && d <= end;
    });
    return sumAggregate(filtered);
  },

  async getMonthAggregate(now: Date = new Date()): Promise<StudyAggregate> {
    const records = await this.getRecords();
    const filtered = records.filter((r) => isSameMonth(parseDateKey(r.date), now));
    return sumAggregate(filtered);
  },

  async getRecentDailyRecords(days: number, now: Date = new Date()): Promise<StudyRecord[]> {
    const n = clampNonNegativeInt(days);
    const records = await this.getRecords();

    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (n - 1));

    const map = new Map<StudyRecordDateKey, StudyRecord>();
    for (const r of records) map.set(r.date, r);

    const out: StudyRecord[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toLocalDateKey(d);
      const existing = map.get(key);
      out.push(
        existing ?? {
          date: key,
          count: 0,
          correct: 0,
          studyTime: 0,
        }
      );
    }

    return out;
  },
};

