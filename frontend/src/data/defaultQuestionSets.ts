// デフォルト問題セットのCSVデータを読み込む
import { loadAllCSVFiles } from '../services/csvLoaderService';

/**
 * デフォルト問題セットを読み込む
 * docs/csv ディレクトリ内の全CSVファイルが自動的に読み込まれます
 */
export async function loadDefaultQuestionSets(): Promise<void> {
  try {
    await loadAllCSVFiles();
    console.log('[DefaultQuestionSets] Default question sets loaded successfully');
  } catch (error) {
    console.error('[DefaultQuestionSets] Error loading default question sets:', error);
  }
}
