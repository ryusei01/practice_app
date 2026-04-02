import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '../../../src/contexts/LanguageContext';
import AdBanner from '../../../src/components/AdBanner';

interface AnswerResult {
  question_id: string;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  answer_time_sec: number;
  category?: string;
}

export default function QuizResultScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams();

  // URLパラメータから結果データを取得
  const score = parseInt(params.score as string) || 0;
  const total = parseInt(params.total as string) || 0;
  const totalTime = parseInt(params.totalTime as string) || 0;
  const answersJson = params.answers as string || '[]';
  const questionSetId = params.questionSetId as string | undefined;
  const answers: AnswerResult[] = JSON.parse(answersJson);

  const correctAnswers = answers.filter(a => a.is_correct);
  const incorrectAnswers = answers.filter(a => !a.is_correct);
  const accuracy = total > 0 ? (score / total) * 100 : 0;
  const averageTime = total > 0 ? totalTime / total : 0;

  // カテゴリ別の統計
  const categoryStats = answers.reduce((acc, answer) => {
    const category = answer.category || t('Uncategorized', '未分類');
    if (!acc[category]) {
      acc[category] = { correct: 0, total: 0 };
    }
    acc[category].total += 1;
    if (answer.is_correct) {
      acc[category].correct += 1;
    }
    return acc;
  }, {} as Record<string, { correct: number; total: number }>);

  const getPerformanceMessage = () => {
    if (accuracy >= 90) return { emoji: '🏆', message: t('Excellent!', '素晴らしい！') };
    if (accuracy >= 70) return { emoji: '🎉', message: t('Great Job!', 'よくできました！') };
    if (accuracy >= 50) return { emoji: '👍', message: t('Good Effort!', 'よく頑張りました！') };
    return { emoji: '📚', message: t('Keep Practicing!', '頑張りましょう！') };
  };

  const performance = getPerformanceMessage();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}${t('m', '分')} ${secs}${t('s', '秒')}` : `${secs}${t('s', '秒')}`;
  };

  return (
    <ScrollView style={styles.container}>
      <AdBanner />
      {/* 総合結果カード */}
      <View style={styles.summaryCard}>
        <Text style={styles.performanceEmoji}>{performance.emoji}</Text>
        <Text style={styles.performanceMessage}>{performance.message}</Text>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>{t('Your Score', 'あなたのスコア')}</Text>
          <Text style={styles.scoreValue}>
            {score} / {total}
          </Text>
          <Text style={styles.accuracyText}>
            {t('Accuracy', '正解率')}: {accuracy.toFixed(1)}%
          </Text>
        </View>

        {/* 統計情報 */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{correctAnswers.length}</Text>
            <Text style={styles.statLabel}>{t('Correct', '正解')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{incorrectAnswers.length}</Text>
            <Text style={styles.statLabel}>{t('Incorrect', '不正解')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatTime(totalTime)}</Text>
            <Text style={styles.statLabel}>{t('Total Time', '合計時間')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatTime(Math.floor(averageTime))}</Text>
            <Text style={styles.statLabel}>{t('Avg Time', '平均時間')}</Text>
          </View>
        </View>
      </View>

      {/* カテゴリ別統計 */}
      {Object.keys(categoryStats).length > 1 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {t('Performance by Category', 'カテゴリ別成績')}
          </Text>
          {Object.entries(categoryStats).map(([category, stats]) => {
            const categoryAccuracy = (stats.correct / stats.total) * 100;
            return (
              <View key={category} style={styles.categoryRow}>
                <Text style={styles.categoryName}>{category}</Text>
                <View style={styles.categoryStats}>
                  <Text style={styles.categoryScore}>
                    {stats.correct}/{stats.total}
                  </Text>
                  <Text
                    style={[
                      styles.categoryAccuracy,
                      categoryAccuracy >= 70 ? styles.goodAccuracy : styles.poorAccuracy,
                    ]}
                  >
                    {categoryAccuracy.toFixed(0)}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* 不正解の問題 */}
      {incorrectAnswers.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {t('Questions to Review', '復習が必要な問題')} ({incorrectAnswers.length})
          </Text>
          {incorrectAnswers.map((answer, index) => (
            <View key={answer.question_id} style={styles.questionReview}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewNumber}>Q{index + 1}</Text>
                <Text style={styles.reviewTime}>⏱ {formatTime(answer.answer_time_sec)}</Text>
              </View>
              <Text style={styles.reviewQuestion}>{answer.question_text}</Text>
              <View style={styles.answerComparison}>
                <View style={styles.answerBlock}>
                  <Text style={styles.answerLabel}>{t('Your Answer', 'あなたの回答')}:</Text>
                  <Text style={styles.wrongAnswer}>{answer.user_answer}</Text>
                </View>
                <View style={styles.answerBlock}>
                  <Text style={styles.answerLabel}>{t('Correct Answer', '正解')}:</Text>
                  <Text style={styles.correctAnswerText}>{answer.correct_answer}</Text>
                </View>
              </View>
              {answer.category && (
                <View style={styles.reviewCategoryBadge}>
                  <Text style={styles.reviewCategoryText}>{answer.category}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* 正解した問題（折りたたみ可能） */}
      {correctAnswers.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            ✓ {t('Correct Answers', '正解した問題')} ({correctAnswers.length})
          </Text>
          {correctAnswers.map((answer, index) => (
            <View key={answer.question_id} style={styles.correctQuestionRow}>
              <Text style={styles.correctQuestionText} numberOfLines={2}>
                {index + 1}. {answer.question_text}
              </Text>
              <Text style={styles.correctTime}>⏱ {formatTime(answer.answer_time_sec)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* アクションボタン */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            if (questionSetId) {
              router.replace(`/(app)/question-sets/${questionSetId}`);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(app)/dashboard");
            }
          }}
        >
          <Text style={styles.primaryButtonText}>
            {t('Back to Question Sets', '問題集に戻る')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            if (questionSetId) {
              router.replace(`/(app)/question-sets/${questionSetId}`);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(app)/dashboard");
            }
          }}
        >
          <Text style={styles.secondaryButtonText}>
            {t('Try Again', 'もう一度挑戦')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  performanceEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  performanceMessage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  accuracyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  statBox: {
    width: '48%',
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  sectionCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryScore: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  categoryAccuracy: {
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 50,
    textAlign: 'right',
  },
  goodAccuracy: {
    color: '#4CAF50',
  },
  poorAccuracy: {
    color: '#F44336',
  },
  questionReview: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  reviewTime: {
    fontSize: 12,
    color: '#666',
  },
  reviewQuestion: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    fontWeight: '600',
  },
  answerComparison: {
    gap: 8,
  },
  answerBlock: {
    marginBottom: 8,
  },
  answerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  wrongAnswer: {
    fontSize: 15,
    color: '#F44336',
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  correctAnswerText: {
    fontSize: 15,
    color: '#4CAF50',
    fontWeight: '600',
  },
  reviewCategoryBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  reviewCategoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  correctQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  correctQuestionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  correctTime: {
    fontSize: 12,
    color: '#666',
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
