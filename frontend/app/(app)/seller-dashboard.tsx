import React, { useState, useEffect } from 'react';
import { platformShadow } from "@/src/styles/platformShadow";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { paymentsApi, SellerDashboard } from '../../src/api/payments';
import { authApi } from '../../src/api/auth';
import Header from '../../src/components/Header';

export default function SellerDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<SellerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [localUser, setLocalUser] = useState(user);

  // 同意フロー状態
  const [termsChecked, setTermsChecked] = useState(false);
  const [tokushoChecked, setTokushoChecked] = useState(false);
  const [taxChecked, setTaxChecked] = useState(false);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

  const allChecked = termsChecked && tokushoChecked && taxChecked;

  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user]);

  const loadDashboard = async () => {
    try {
      const data = await paymentsApi.getSellerDashboard();
      setDashboard(data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        // 販売者未登録 — 同意フローを表示するために空のダッシュボードをセット
        setDashboard({
          is_connected: false,
          stripe_account_id: null,
          total_sales: 0,
          total_earnings: 0,
          total_orders: 0,
          question_sets_count: 0,
        });
      } else {
        console.error('Failed to load seller dashboard:', error);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDashboard();
  };

  const handleAcceptTermsAndConnect = async () => {
    if (!allChecked) return;
    setIsAcceptingTerms(true);
    try {
      await paymentsApi.acceptSellerTerms();
      await handleConnectStripe();
    } catch (error) {
      Alert.alert('エラー', '同意の記録に失敗しました。もう一度お試しください。');
    } finally {
      setIsAcceptingTerms(false);
    }
  };

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      const returnUrl = 'exp://localhost:8081';
      const refreshUrl = 'exp://localhost:8081';
      await paymentsApi.createConnectAccountLink(returnUrl, refreshUrl);

      Alert.alert(
        'Stripe Connect',
        '販売者登録が完了しました。本番環境ではStripe Connectのオンボーディングページへ遷移します。',
        [{ text: 'OK', onPress: () => loadDashboard() }]
      );
    } catch (error) {
      Alert.alert('エラー', 'Stripe Connect の設定に失敗しました。');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleApplyAsSeller = async () => {
    Alert.alert(
      '販売者申請',
      '管理者が問題集・教科書を審査します。承認後に販売が開始できます。申請しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '申請する',
          onPress: async () => {
            setIsApplying(true);
            try {
              const updated = await authApi.submitSellerApplication();
              setLocalUser({ ...localUser!, ...updated });
              Alert.alert(
                '申請完了',
                '販売者申請を送信しました。管理者の審査をお待ちください。'
              );
            } catch (error: any) {
              const msg = error.response?.data?.detail || '申請に失敗しました。もう一度お試しください。';
              Alert.alert('エラー', msg);
            } finally {
              setIsApplying(false);
            }
          },
        },
      ]
    );
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const csvData = await paymentsApi.exportSellerRevenue();

      if (Platform.OS === 'web') {
        // Web: BOMつきCSVをダウンロード
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.href = url;
        a.download = `revenue_${today}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // モバイル: Shareシートで共有
        await Share.share({
          title: '売上データ（税務申告用）',
          message: csvData,
        });
      }
    } catch (error) {
      Alert.alert('エラー', 'CSVのエクスポートに失敗しました。');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>ダッシュボードの読み込みに失敗しました</Text>
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <Header title="販売者ダッシュボード" />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >

      {!localUser?.is_seller ? (
        // 販売者未登録 — 申請フロー
        <View style={styles.section}>
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>販売者として申請する</Text>

            {localUser?.seller_application_status === 'pending' ? (
              // 審査中
              <>
                <View style={styles.statusBadgePending}>
                  <Text style={styles.statusBadgeText}>🕐 審査中</Text>
                </View>
                <Text style={styles.onboardingDescription}>
                  申請を受け付けました。管理者が問題集・教科書を審査中です。{'\n'}
                  承認されると販売者として登録されます。
                </Text>
              </>
            ) : localUser?.seller_application_status === 'rejected' ? (
              // 却下
              <>
                <View style={styles.statusBadgeRejected}>
                  <Text style={styles.statusBadgeText}>✗ 申請却下</Text>
                </View>
                {localUser.seller_application_admin_note ? (
                  <View style={styles.adminNoteBox}>
                    <Text style={styles.adminNoteLabel}>管理者からのメッセージ：</Text>
                    <Text style={styles.adminNoteText}>{localUser.seller_application_admin_note}</Text>
                  </View>
                ) : null}
                <Text style={styles.onboardingDescription}>
                  申請が却下されました。内容を修正の上、再度申請してください。
                </Text>
                <TouchableOpacity
                  style={[styles.applyButton, isApplying && styles.buttonDisabled]}
                  onPress={handleApplyAsSeller}
                  disabled={isApplying}
                >
                  {isApplying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.applyButtonText}>再申請する</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              // 未申請
              <>
                <Text style={styles.onboardingDescription}>
                  問題集・教科書を販売するには、管理者による審査が必要です。{'\n'}
                  申請後、管理者がコンテンツを確認し、承認後に販売を開始できます。
                </Text>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={[styles.applyButton, isApplying && styles.buttonDisabled]}
                  onPress={handleApplyAsSeller}
                  disabled={isApplying}
                >
                  {isApplying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.applyButtonText}>販売者として申請する</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ) : !dashboard.is_connected ? (
        // 販売者登録前 — 同意フロー
        <View style={styles.section}>
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>販売者として登録する</Text>
            <Text style={styles.onboardingDescription}>
              問題集を販売するには、以下の規約・法令表示を確認の上、Stripe Connectアカウントを接続してください。
            </Text>

            <View style={styles.divider} />

            {/* 各規約確認項目 */}
            <CheckItem
              checked={termsChecked}
              onToggle={() => setTermsChecked(!termsChecked)}
              label="販売者向け利用規約を確認しました"
              linkLabel="利用規約を読む"
              onLinkPress={() => router.push('/(app)/legal/seller-terms')}
            />

            <CheckItem
              checked={tokushoChecked}
              onToggle={() => setTokushoChecked(!tokushoChecked)}
              label="特定商取引法に基づく表記を確認しました"
              linkLabel="特商法表記を読む"
              onLinkPress={() => router.push('/(public)/tokusho')}
            />

            <CheckItem
              checked={taxChecked}
              onToggle={() => setTaxChecked(!taxChecked)}
              label="税務に関するご案内を確認しました"
              linkLabel="税務案内を読む"
              onLinkPress={() => router.push('/(app)/legal/tax-notice')}
            />

            <View style={styles.divider} />

            <View style={styles.feeInfoBox}>
              <Text style={styles.feeInfoTitle}>手数料について</Text>
              <Text style={styles.feeInfoText}>
                販売価格の <Text style={styles.feeHighlight}>10%</Text> がプラットフォーム手数料となり、
                <Text style={styles.feeHighlight}> 90%</Text> が販売者の収益となります。
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.connectButton,
                (!allChecked || isAcceptingTerms || isConnecting) && styles.buttonDisabled,
              ]}
              onPress={handleAcceptTermsAndConnect}
              disabled={!allChecked || isAcceptingTerms || isConnecting}
            >
              {isAcceptingTerms || isConnecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>
                  {allChecked ? 'Stripeアカウントを接続する' : 'すべての項目を確認してください'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // 登録済み — ダッシュボード表示
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>¥{dashboard.total_sales.toLocaleString()}</Text>
              <Text style={styles.statLabel}>総売上</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>¥{dashboard.total_earnings.toLocaleString()}</Text>
              <Text style={styles.statLabel}>あなたの収益</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dashboard.total_orders}</Text>
              <Text style={styles.statLabel}>総注文数</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dashboard.question_sets_count}</Text>
              <Text style={styles.statLabel}>問題集数</Text>
            </View>
          </View>

          {/* Stripe接続情報 */}
          <View style={styles.section}>
            <View style={styles.connectedCard}>
              <View style={styles.connectedHeader}>
                <Text style={styles.connectedTitle}>Stripe接続済み</Text>
                <View style={styles.connectedBadge}>
                  <Text style={styles.connectedBadgeText}>有効</Text>
                </View>
              </View>
              <Text style={styles.connectedText}>
                アカウントID: {dashboard.stripe_account_id}
              </Text>
            </View>
          </View>

          {/* 手数料説明 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>手数料</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                各販売から <Text style={styles.bold}>10%</Text> がプラットフォーム手数料として差し引かれ、
                残り <Text style={styles.bold}>90%</Text> がStripeアカウントへ送金されます。
              </Text>
            </View>
          </View>

          {/* 税務・売上エクスポート */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>税務申告用データ</Text>
            <View style={styles.exportCard}>
              <Text style={styles.exportDescription}>
                確定申告や収益管理のために、全取引の明細をCSV形式でダウンロードできます。
              </Text>
              <TouchableOpacity
                style={[styles.exportButton, isExporting && styles.buttonDisabled]}
                onPress={handleExportCSV}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.exportButtonText}>売上CSVをダウンロード</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(app)/legal/tax-notice')}
                style={styles.taxLinkButton}
              >
                <Text style={styles.taxLinkText}>税務に関するご案内を読む →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 法的リンク */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>法令関連</Text>
            <View style={styles.legalLinksCard}>
              <TouchableOpacity
                style={styles.legalLink}
                onPress={() => router.push('/(app)/legal/seller-terms')}
              >
                <Text style={styles.legalLinkText}>販売者向け利用規約</Text>
                <Text style={styles.legalLinkArrow}>→</Text>
              </TouchableOpacity>
              <View style={styles.linkDivider} />
              <TouchableOpacity
                style={styles.legalLink}
                onPress={() => router.push('/(public)/tokusho')}
              >
                <Text style={styles.legalLinkText}>特定商取引法に基づく表記</Text>
                <Text style={styles.legalLinkArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </ScrollView>
    </View>
  );
}

type CheckItemProps = {
  checked: boolean;
  onToggle: () => void;
  label: string;
  linkLabel: string;
  onLinkPress: () => void;
};

function CheckItem({ checked, onToggle, label, linkLabel, onLinkPress }: CheckItemProps) {
  return (
    <View style={checkStyles.container}>
      <TouchableOpacity onPress={onToggle} style={checkStyles.checkRow}>
        <View style={[checkStyles.checkbox, checked && checkStyles.checkboxChecked]}>
          {checked && <Text style={checkStyles.checkmark}>✓</Text>}
        </View>
        <Text style={[checkStyles.label, checked && checkStyles.labelChecked]}>{label}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onLinkPress} style={checkStyles.link}>
        <Text style={checkStyles.linkText}>{linkLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const checkStyles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  labelChecked: {
    color: '#222',
    fontWeight: '500',
  },
  link: {
    marginLeft: 32,
  },
  linkText: {
    fontSize: 13,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  onboardingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    ...platformShadow({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  onboardingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 10,
  },
  onboardingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  feeInfoBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  feeInfoTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 6,
  },
  feeInfoText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
  },
  feeHighlight: {
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  connectButton: {
    backgroundColor: '#635BFF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 0,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    ...platformShadow({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  connectedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...platformShadow({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  connectedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  connectedText: {
    fontSize: 13,
    color: '#666',
  },
  connectedBadge: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  connectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...platformShadow({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  infoText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
    color: '#222',
  },
  exportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...platformShadow({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 3,
  },
  exportDescription: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    marginBottom: 14,
  },
  exportButton: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  taxLinkButton: {
    alignItems: 'flex-end',
  },
  taxLinkText: {
    fontSize: 13,
    color: '#007AFF',
  },
  legalLinksCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    ...platformShadow({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    }),
    elevation: 3,
    marginBottom: 24,
  },
  legalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  legalLinkText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  legalLinkArrow: {
    fontSize: 14,
    color: '#999',
  },
  linkDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadgePending: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF9500',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  statusBadgeRejected: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  adminNoteBox: {
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  adminNoteLabel: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
    marginBottom: 4,
  },
  adminNoteText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
});
