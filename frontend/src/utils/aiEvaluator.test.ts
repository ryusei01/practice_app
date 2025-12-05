/**
 * AI評価ユーティリティのテストケース
 *
 * 実行方法:
 * cd frontend
 * npx jest src/utils/aiEvaluator.test.ts
 */

import { evaluateTextAnswer } from './aiEvaluator';

describe('AI Text Answer Evaluator', () => {
  describe('完全一致', () => {
    test('完全に同じ文字列', () => {
      const result = evaluateTextAnswer('Tokyo', 'Tokyo');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.exact_match).toBe(true);
    });
  });

  describe('正規化後一致', () => {
    test('大文字小文字の違い', () => {
      const result = evaluateTextAnswer('python --version', 'Python --Version');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    test('全角半角の違い', () => {
      const result = evaluateTextAnswer('１２３', '123');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('句読点の違い', () => {
    test('句読点あり・なし', () => {
      const result = evaluateTextAnswer('東京です。', '東京です');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeCloseTo(0.98);
    });
  });

  describe('漢字の読み', () => {
    test('漢字 vs ひらがな', () => {
      const result = evaluateTextAnswer('東京', 'とうきょう');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    test('漢字 vs カタカナ', () => {
      const result = evaluateTextAnswer('日本', 'ニホン');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    test('ひらがな vs カタカナ', () => {
      const result = evaluateTextAnswer('とうきょう', 'トウキョウ');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.96);
    });
  });

  describe('数値問題', () => {
    test('数値のみ', () => {
      const result = evaluateTextAnswer('42', '42');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    test('数値が含まれる文章', () => {
      const result = evaluateTextAnswer('42', '答えは42です');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBe(0.95);
    });

    test('小数', () => {
      const result = evaluateTextAnswer('3.14', '円周率は3.14です');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('文字列類似度', () => {
    test('高い類似度（90%以上）', () => {
      const result = evaluateTextAnswer('The capital of Japan is Tokyo', 'The capital of Japan is tokyo');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    test('中程度の類似度（70-80%）', () => {
      const result = evaluateTextAnswer('日本の首都は東京です', '首都は東京です');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('低い類似度（不正解）', () => {
      const result = evaluateTextAnswer('東京', '大阪');
      expect(result.is_correct).toBe(false);
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('エッジケース', () => {
    test('空文字列', () => {
      const result = evaluateTextAnswer('answer', '');
      expect(result.is_correct).toBe(false);
    });

    test('空白のみ', () => {
      const result = evaluateTextAnswer('answer', '   ');
      expect(result.is_correct).toBe(false);
    });

    test('非常に長い文字列', () => {
      const longText = 'a'.repeat(1000);
      const result = evaluateTextAnswer(longText, longText);
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('複数の正解パターン（/区切り）', () => {
    test('スラッシュ区切りの正解パターン - 漢字とひらがな', () => {
      const result = evaluateTextAnswer('日本/にほん', 'ニホン');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    test('スラッシュ区切りの正解パターン - 英語と漢字', () => {
      const result = evaluateTextAnswer('Tokyo/東京', 'とうきょう');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    test('スラッシュ区切りの正解パターン - 完全一致', () => {
      const result = evaluateTextAnswer('apple/りんご/林檎', 'りんご');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.exact_match).toBe(true);
    });

    test('スラッシュ区切りで不一致', () => {
      const result = evaluateTextAnswer('東京/Tokyo', '大阪');
      expect(result.is_correct).toBe(false);
    });
  });

  describe('数字表現の正規化', () => {
    test('アラビア数字 vs 漢数字', () => {
      const result = evaluateTextAnswer('1つの', '一つの');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    test('アラビア数字 vs ひらがな', () => {
      const result = evaluateTextAnswer('1つの', 'ひとつの');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    test('漢数字 vs ひらがな', () => {
      const result = evaluateTextAnswer('一つの', 'ひとつの');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    test('複数の数字パターン', () => {
      const result = evaluateTextAnswer('1つの / ある', 'ひとつの');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    test('10までの数字', () => {
      const result = evaluateTextAnswer('10個', '十個');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    test('かな表記のバリエーション', () => {
      const result = evaluateTextAnswer('2つ', 'ふたつ');
      expect(result.is_correct).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });
  });
});
