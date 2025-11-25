import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { aiApi, CategoryPrediction, ImprovementSuggestion } from '../../src/api/ai';

export default function AIDashboardScreen() {
  const { user } = useAuth();
  const [categoryPredictions, setCategoryPredictions] = useState<CategoryPrediction[]>([]);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      const [predictions, improvementSuggestions] = await Promise.all([
        aiApi.getCategoryPredictions(user.id),
        aiApi.getImprovementSuggestions(user.id),
      ]);
      setCategoryPredictions(predictions);
      setSuggestions(improvementSuggestions);
    } catch (error) {
      console.error('Failed to load AI data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>AI Dashboard</Text>
        <Text style={styles.subtitle}>Personalized learning insights</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Score Predictions by Category</Text>
        {categoryPredictions.length > 0 ? (
          categoryPredictions.map((prediction, index) => (
            <View key={index} style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <Text style={styles.categoryName}>{prediction.category}</Text>
                <Text style={styles.scoreText}>
                  {prediction.predicted_score.toFixed(0)}/{prediction.max_score}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${(prediction.predicted_score / prediction.max_score) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.confidenceText}>
                Confidence: {(prediction.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No predictions available yet. Start answering questions to get AI insights!
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Improvement Suggestions</Text>
        {suggestions.length > 0 ? (
          suggestions.map((suggestion, index) => (
            <View key={index} style={styles.suggestionCard}>
              <View style={styles.suggestionHeader}>
                <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
                <View
                  style={[
                    styles.priorityBadge,
                    {
                      backgroundColor:
                        suggestion.priority >= 8
                          ? '#FF3B30'
                          : suggestion.priority >= 5
                          ? '#FF9500'
                          : '#34C759',
                    },
                  ]}
                >
                  <Text style={styles.priorityText}>P{suggestion.priority}</Text>
                </View>
              </View>
              <Text style={styles.suggestionText}>{suggestion.suggestion}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No suggestions available yet. Keep practicing to get personalized tips!
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Features</Text>
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Adaptive Learning</Text>
          <Text style={styles.featureDescription}>
            AI automatically adjusts question difficulty based on your performance
          </Text>
        </View>
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Smart Recommendations</Text>
          <Text style={styles.featureDescription}>
            Get personalized question recommendations to maximize learning efficiency
          </Text>
        </View>
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Score Prediction</Text>
          <Text style={styles.featureDescription}>
            See your estimated score before taking tests based on your practice history
          </Text>
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
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  predictionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 14,
    color: '#666',
  },
  suggestionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  priorityBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priorityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  suggestionText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyCard: {
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
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});
