import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/contexts/AuthContext';
import { answersApi, LocalAnswerData, LocalQuestionSetData } from '../../src/api/answers';
import { subscriptionsApi } from '../../src/api/subscriptions';

const BASE_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://ai-practice-book.com';
const PLAN_PRICE_JPY = 550;
const PLAN_CREDIT_JPY = 200;

export default function PremiumUpgradeScreen() {
  const [isMigrating, setIsMigrating] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleUpgradeToPremium = async () => {
    if (!user) {
      Alert.alert('ログインが必要です', 'アップグレードにはログインしてください。');
      return;
    }

    setIsCheckingOut(true);
    try {
      const successUrl = `${BASE_WEB_URL}/premium-success`;
      const cancelUrl = `${BASE_WEB_URL}/premium-cancel`;

      const { checkout_url } = await subscriptionsApi.createPremiumCheckout(
        successUrl,
        cancelUrl,
      );

      if (Platform.OS === 'web') {
        window.location.href = checkout_url;
      } else {
        // モバイル: expo-web-browser で Stripe Checkout を開く
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { openBrowserAsync } = require('expo-web-browser');
          await openBrowserAsync(checkout_url);
        } catch {
          Alert.alert('外部ブラウザが必要です', `以下の URL をブラウザで開いてください:\n${checkout_url}`);
        }
      }
    } catch (error: any) {
      Alert.alert(
        'エラー',
        error?.response?.data?.detail || '決済の開始に失敗しました。しばらく経ってからお試しください。',
      );
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleMigrateData = async () => {
    if (!user) return;

    if (!user.is_premium) {
      Alert.alert(
        'プレミアムが必要です',
        'データを移行するには先にプレミアムにアップグレードしてください。',
        [{ text: 'OK' }],
      );
      return;
    }

    Alert.alert(
      'クラウドへ移行',
      'ローカルに保存されているデータ（回答・問題集）をクラウドにアップロードします。続けますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '移行する',
          onPress: async () => {
            setIsMigrating(true);
            try {
              const answersKey = `answers_${user.id}`;
              const questionSetsKey = `question_sets_${user.id}`;

              const [answersData, questionSetsData] = await Promise.all([
                AsyncStorage.getItem(answersKey),
                AsyncStorage.getItem(questionSetsKey),
              ]);

              const localAnswers: LocalAnswerData[] = answersData ? JSON.parse(answersData) : [];
              const localQuestionSets: LocalQuestionSetData[] = questionSetsData
                ? JSON.parse(questionSetsData)
                : [];

              if (localAnswers.length === 0 && localQuestionSets.length === 0) {
                Alert.alert('データなし', '移行するローカルデータが見つかりませんでした。');
                setIsMigrating(false);
                return;
              }

              const result = await answersApi.migrateLocalData({
                answers: localAnswers,
                question_sets: localQuestionSets,
              });

              await Promise.all([
                AsyncStorage.removeItem(answersKey),
                AsyncStorage.removeItem(questionSetsKey),
              ]);

              setMigrationComplete(true);

              Alert.alert(
                '移行完了！',
                `移行しました:\n- 回答 ${result.migrated_counts.answers} 件\n- 問題集 ${result.migrated_counts.question_sets} 件\n- 問題 ${result.migrated_counts.questions} 件\n\nデータはクラウドに同期されました！`,
                [{ text: 'OK', onPress: () => router.back() }],
              );
            } catch (error: any) {
              Alert.alert(
                '移行失敗',
                error.response?.data?.detail || 'データの移行に失敗しました。',
              );
            } finally {
              setIsMigrating(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>プレミアムプラン</Text>

        {/* 価格カード */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>月額</Text>
          <Text style={styles.priceValue}>¥{PLAN_PRICE_JPY.toLocaleString()}</Text>
          <Text style={styles.priceNote}>（税込）</Text>
          <View style={styles.creditBadge}>
            <Text style={styles.creditBadgeText}>
              ¥{PLAN_CREDIT_JPY} クレジット付与
            </Text>
          </View>
        </View>

        {/* 特典一覧 */}
        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>広告なし</Text>
          <Text style={styles.featureDescription}>
            アプリ内のすべての広告が非表示になります
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>¥{PLAN_CREDIT_JPY} クレジット付与</Text>
          <Text style={styles.featureDescription}>
            購入時に¥{PLAN_CREDIT_JPY}分のアプリ内クレジットをプレゼント。問題集の購入にお使いいただけます
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>クラウド同期</Text>
          <Text style={styles.featureDescription}>
            すべてのデバイスで回答履歴・問題集を共有できます
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>無制限ストレージ</Text>
          <Text style={styles.featureDescription}>
            問題集を無制限に作成・保存できます
          </Text>
        </View>

        {!user?.is_premium ? (
          <TouchableOpacity
            style={[styles.upgradeButton, isCheckingOut && styles.buttonDisabled]}
            onPress={handleUpgradeToPremium}
            disabled={isCheckingOut}
          >
            {isCheckingOut ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.upgradeButtonText}>
                ¥{PLAN_PRICE_JPY} でプレミアムにアップグレード
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>プレミアム会員です</Text>
            </View>

            {/* クレジット残高表示 */}
            <View style={styles.creditDisplay}>
              <Text style={styles.creditDisplayLabel}>クレジット残高</Text>
              <Text style={styles.creditDisplayValue}>
                ¥{(user.account_credit_jpy ?? 0).toLocaleString()}
              </Text>
            </View>

            {!migrationComplete && (
              <View style={styles.migrationSection}>
                <Text style={styles.migrationTitle}>ローカルデータをクラウドへ移行</Text>
                <Text style={styles.migrationDescription}>
                  端末に保存されている回答・問題集をクラウドにアップロードしてマルチデバイス同期を有効にします。
                </Text>

                <TouchableOpacity
                  style={[styles.migrateButton, isMigrating && styles.buttonDisabled]}
                  onPress={handleMigrateData}
                  disabled={isMigrating}
                >
                  {isMigrating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.migrateButtonText}>データを移行する</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>戻る</Text>
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
  priceCard: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  priceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  priceValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '800',
  },
  priceNote: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginBottom: 12,
  },
  creditBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  creditBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '700',
  },
  premiumBadge: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  premiumBadgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  creditDisplay: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  creditDisplayLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  creditDisplayValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
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
