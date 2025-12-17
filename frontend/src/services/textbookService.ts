/**
 * 教科書サービス
 * docs/textbook配下のファイルを管理
 */

import { textbooksApi } from "../api/textbooks";

export type TextbookType = "markdown" | "pdf";

/**
 * 教科書タイプを正規化
 * - API/URL パラメータ等から来る表記揺れ（"Markdown", " md " 等）を吸収する
 */
export function normalizeTextbookType(
  type: unknown,
  fallback: TextbookType = "markdown"
): TextbookType {
  const v = String(type ?? "")
    .trim()
    .toLowerCase();
  if (v === "markdown" || v === "md") return "markdown";
  if (v === "pdf") return "pdf";
  return fallback;
}

export interface Textbook {
  path: string;
  name: string;
  type: TextbookType;
}

/**
 * フォールバック用の手動リスト（APIが使えない場合）
 */
const FALLBACK_TEXTBOOKS: Textbook[] = [
  {
    path: "決定木・ランダムフォレスト超入門教科書.md",
    name: "決定木・ランダムフォレスト超入門教科書",
    type: "markdown",
  },
  {
    // docs/textbook 配下の実ファイル名に合わせる（表示名は日本語のままでもOK）
    path: "Machine Learning & Deep Learning for Practical Engineers.md",
    name: "機械学習・深層学習 教科書（基礎〜実装）",
    type: "markdown",
  },
];

// キャッシュ用
let cachedTextbooks: Textbook[] | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分

/**
 * 利用可能な教科書のリストを取得（バックエンドAPIから動的に取得）
 */
export async function getAvailableTextbooks(): Promise<Textbook[]> {
  // キャッシュが有効な場合はそれを返す
  const now = Date.now();
  if (cachedTextbooks && now - lastFetchTime < CACHE_DURATION) {
    return cachedTextbooks;
  }

  try {
    // バックエンドAPIから教科書リストを取得
    const apiTextbooks = await textbooksApi.getAvailable();
    cachedTextbooks = apiTextbooks.map((tb) => ({
      path: tb.path,
      name: tb.name,
      type: normalizeTextbookType(tb.type),
    }));
    lastFetchTime = now;
    console.log(
      `[TextbookService] Loaded ${cachedTextbooks.length} textbooks from API`
    );
    return cachedTextbooks;
  } catch (error) {
    console.error(
      "[TextbookService] Failed to load textbooks from API, using fallback:",
      error
    );
    // APIが使えない場合はフォールバックリストを返す
    return FALLBACK_TEXTBOOKS;
  }
}

/**
 * 同期版（既存コードとの互換性のため）
 * 注意: この関数は非推奨です。getAvailableTextbooks()を使用してください。
 */
export function getAvailableTextbooksSync(): Textbook[] {
  return FALLBACK_TEXTBOOKS;
}

/**
 * 旧ファイル名/表示名 → 実ファイル名 へのマッピング（互換性のため）
 * - DB/ローカルストレージに残っている古いパスや、日本語表示名を受け取っても
 *   docs/textbook 配下の実ファイルへ解決できるようにする
 */
const PATH_MAPPING: Record<string, string> = {
  // Decision tree: 旧名 → 新名
  "Decision Trees and Random Forests Textbook.md":
    "Decision Trees and Random Forests.md",

  // Machine learning: 旧名/日本語名 → 実ファイル名
  "Machine Learning and Deep Learning Textbook.md":
    "Machine Learning & Deep Learning for Practical Engineers.md",
  "機械学習・深層学習 教科書（基礎〜実装）.md":
    "Machine Learning & Deep Learning for Practical Engineers.md",
};

/**
 * パスを正規化（英語名を日本語名に変換）
 */
export function normalizeTextbookPath(path: string): string {
  return PATH_MAPPING[path] || path;
}

/**
 * 教科書ファイル名から教科書情報を取得
 */
export async function getTextbookByPath(
  path: string
): Promise<Textbook | null> {
  // まず正規化されたパスで検索
  const normalizedPath = normalizeTextbookPath(path);
  const textbooks = await getAvailableTextbooks();
  return textbooks.find((tb) => tb.path === normalizedPath) || null;
}

/**
 * 新しい教科書を追加（キャッシュに追加）
 * 注意: この関数はキャッシュに追加するだけで、バックエンドAPIには反映されません
 */
export async function addTextbook(textbook: Textbook): Promise<void> {
  const textbooks = await getAvailableTextbooks();
  if (!textbooks.find((tb) => tb.path === textbook.path)) {
    // キャッシュに追加
    if (cachedTextbooks) {
      cachedTextbooks.push(textbook);
      console.log(
        `[TextbookService] Added textbook to cache: ${textbook.path}`
      );
    }
  }
}
