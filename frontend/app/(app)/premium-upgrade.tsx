import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/contexts/AuthContext';
import { answersApi, LocalAnswerData, LocalQuestionSetData } from '../../src/api/answers';

export default function PremiumUpgradeScreen() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleMigrateData = async () => {
    if (!user) return;

    if (!user.is_premium) {
      Alert.alert(
        'Premium Required',
        'You need to upgrade to premium before migrating your data.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Migrate to Cloud',
      'This will upload all your local data (answers and question sets) to the cloud. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Migrate',
          onPress: async () => {
            setIsMigrating(true);
            try {
              // ローカルデータを取得
              const answersKey = `answers_${user.id}`;
              const questionSetsKey = `question_sets_${user.id}`;

              const [answersData, questionSetsData] = await Promise.all([
                AsyncStorage.getItem(answersKey),
                AsyncStorage.getItem(questionSetsKey),
              ]);

              const localAnswers: LocalAnswerData[] = answersData
                ? JSON.parse(answersData)
                : [];
              const localQuestionSets: LocalQuestionSetData[] = questionSetsData
                ? JSON.parse(questionSetsData)
                : [];

              if (localAnswers.length === 0 && localQuestionSets.length === 0) {
                Alert.alert('No Data', 'No local data found to migrate.');
                setIsMigrating(false);
                return;
              }

              // マイグレーション実行
              const result = await answersApi.migrateLocalData({
                answers: localAnswers,
                question_sets: localQuestionSets,
              });

              // ローカルデータを削除（バックアップとして残すこともできる）
              await Promise.all([
                AsyncStorage.removeItem(answersKey),
                AsyncStorage.removeItem(questionSetsKey),
              ]);

              setMigrationComplete(true);

              Alert.alert(
                'Migration Complete!',
                `Successfully migrated:\n` +
                  `- ${result.migrated_counts.answers} answers\n` +
                  `- ${result.migrated_counts.question_sets} question sets\n` +
                  `- ${result.migrated_counts.questions} questions\n\n` +
                  `Your data is now synced to the cloud!`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error: any) {
              console.error('Migration failed:', error);
              Alert.alert(
                'Migration Failed',
                error.response?.data?.detail || 'Failed to migrate data to cloud'
              );
            } finally {
              setIsMigrating(false);
            }
          },
        },
      ]
    );
  };

  const handleUpgradeToPremium = () => {
    Alert.alert(
      'Upgrade to Premium',
      'Premium subscription features:\n\n' +
        '- Cloud sync across all devices\n' +
        '- Unlimited storage\n' +
        '- Priority support\n' +
        '- Advanced analytics\n\n' +
        'Integration with payment system coming soon!',
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Premium Features</Text>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Cloud Sync</Text>
          <Text style={styles.featureDescription}>
            Access your question sets and progress from any device
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Unlimited Storage</Text>
          <Text style={styles.featureDescription}>
            Create unlimited question sets and store all your answers
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Advanced Analytics</Text>
          <Text style={styles.featureDescription}>
            Detailed insights into your learning progress
          </Text>
        </View>

        {!user?.is_premium ? (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={handleUpgradeToPremium}
          >
            <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>You are Premium!</Text>
            </View>

            {!migrationComplete && (
              <View style={styles.migrationSection}>
                <Text style={styles.migrationTitle}>
                  Migrate Local Data to Cloud
                </Text>
                <Text style={styles.migrationDescription}>
                  Upload your locally stored answers and question sets to the cloud
                  for multi-device sync.
                </Text>

                <TouchableOpacity
                  style={[styles.migrateButton, isMigrating && styles.buttonDisabled]}
                  onPress={handleMigrateData}
                  disabled={isMigrating}
                >
                  {isMigrating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.migrateButtonText}>
                      Migrate Data to Cloud
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back</Text>
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
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  premiumBadge: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  premiumBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  migrationSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  migrationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  migrationDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  migrateButton: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  migrateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  backButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
