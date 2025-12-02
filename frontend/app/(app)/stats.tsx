import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { answersApi, UserStats } from '../../src/api/answers';

export default function StatsScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!user) return;

    try {
      const data = await answersApi.getUserStats(user.id);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadStats();
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No statistics available yet</Text>
        <Text style={styles.emptySubtext}>Start solving quizzes to see your progress!</Text>
      </View>
    );
  }

  const accuracyPercentage = stats.total_answers > 0
    ? ((stats.correct_answers / stats.total_answers) * 100).toFixed(1)
    : '0.0';

  const incorrectAnswers = stats.total_answers - stats.correct_answers;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>Your Statistics</Text>

        {/* Overall Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Performance</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total_answers}</Text>
              <Text style={styles.statLabel}>Total Answers</Text>
            </View>

            <View style={[styles.statCard, styles.successCard]}>
              <Text style={[styles.statValue, styles.successText]}>
                {stats.correct_answers}
              </Text>
              <Text style={styles.statLabel}>Correct</Text>
            </View>

            <View style={[styles.statCard, styles.errorCard]}>
              <Text style={[styles.statValue, styles.errorText]}>
                {incorrectAnswers}
              </Text>
              <Text style={styles.statLabel}>Incorrect</Text>
            </View>

            <View style={[styles.statCard, styles.accuracyCard]}>
              <Text style={[styles.statValue, styles.accuracyText]}>
                {accuracyPercentage}%
              </Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
          </View>
        </View>

        {/* Time Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time & Effort</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Average Answer Time:</Text>
              <Text style={styles.infoValue}>
                {stats.average_answer_time.toFixed(1)}s
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Study Time:</Text>
              <Text style={styles.infoValue}>
                {Math.floor(stats.total_study_time / 60)}m {Math.floor(stats.total_study_time % 60)}s
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Categories Studied:</Text>
              <Text style={styles.infoValue}>{stats.categories_studied}</Text>
            </View>

            {stats.last_activity && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Activity:</Text>
                <Text style={styles.infoValue}>
                  {new Date(stats.last_activity).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress Message */}
        <View style={styles.messageCard}>
          {stats.accuracy_rate >= 0.8 ? (
            <>
              <Text style={styles.messageEmoji}>🎉</Text>
              <Text style={styles.messageTitle}>Excellent Work!</Text>
              <Text style={styles.messageText}>
                You're doing great with {accuracyPercentage}% accuracy!
              </Text>
            </>
          ) : stats.accuracy_rate >= 0.6 ? (
            <>
              <Text style={styles.messageEmoji}>👍</Text>
              <Text style={styles.messageTitle}>Good Progress!</Text>
              <Text style={styles.messageText}>
                Keep practicing to improve your {accuracyPercentage}% accuracy!
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.messageEmoji}>💪</Text>
              <Text style={styles.messageTitle}>Keep Going!</Text>
              <Text style={styles.messageText}>
                Practice makes perfect. You've got {incorrectAnswers} questions to review!
              </Text>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successCard: {
    backgroundColor: '#E8F5E9',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
  },
  accuracyCard: {
    backgroundColor: '#E3F2FD',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  successText: {
    color: '#2E7D32',
  },
  errorText: {
    color: '#C62828',
  },
  accuracyText: {
    color: '#1565C0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
