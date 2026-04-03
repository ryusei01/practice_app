import React, { useState, useEffect, useCallback } from 'react';
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
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import { adminApi, SellerApplication } from '../../../src/api/admin';
import Header from '../../../src/components/Header';

type TabType = 'pending' | 'all';

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // 審査モーダル
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SellerApplication | null>(null);
  const [modalMode, setModalMode] = useState<'approve' | 'reject'>('approve');
  const [adminNote, setAdminNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const loadApplications = useCallback(async () => {
    try {
      const statusFilter = activeTab === 'pending' ? 'pending' : undefined;
      const data = await adminApi.getSellerApplications(statusFilter);
      setApplications(data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        Alert.alert('アクセス拒否', '管理者権限が必要です');
        router.back();
      } else {
        Alert.alert('エラー', '申請一覧の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('アクセス拒否', '管理者権限が必要です');
      router.back();
      return;
    }
    loadApplications();
  }, [isAdmin, loadApplications]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadApplications();
  };

  const openApproveModal = (app: SellerApplication) => {
    setSelectedApp(app);
    setModalMode('approve');
    setAdminNote('');
    setModalVisible(true);
  };

  const openRejectModal = (app: SellerApplication) => {
    setSelectedApp(app);
    setModalMode('reject');
    setAdminNote('');
    setModalVisible(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedApp) return;
    if (modalMode === 'reject' && !adminNote.trim()) {
      Alert.alert('入力エラー', '却下理由を入力してください');
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'approve') {
        await adminApi.approveSellerApplication(selectedApp.id, adminNote || undefined);
        Alert.alert('承認完了', `${selectedApp.username} の申請を承認しました`);
      } else {
        await adminApi.rejectSellerApplication(selectedApp.id, adminNote);
        Alert.alert('却下完了', `${selectedApp.username} の申請を却下しました`);
      }
      setModalVisible(false);
      loadApplications();
    } catch (error: any) {
      const msg = error.response?.data?.detail || '処理に失敗しました';
      Alert.alert('エラー', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return { label: '審査待ち', color: '#FF9500' };
      case 'approved': return { label: '承認済み', color: '#34C759' };
      case 'rejected': return { label: '却下', color: '#FF3B30' };
      default: return { label: '未申請', color: '#8E8E93' };
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '不明';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  if (!isAdmin) return null;

  return (
    <View style={styles.container}>
      <Header title="販売者申請 管理" />

      {/* タブ */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            審査待ち
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            全件
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        >
          {applications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'pending' ? '審査待ちの申請はありません' : '申請はありません'}
              </Text>
            </View>
          ) : (
            applications.map((app) => {
              const statusInfo = getStatusLabel(app.seller_application_status);
              return (
                <View key={app.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.cardName}>{app.username}</Text>
                      <Text style={styles.cardEmail}>{app.email}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                      <Text style={styles.statusBadgeText}>{statusInfo.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardMeta}>
                    申請日: {formatDate(app.seller_application_submitted_at)}
                  </Text>
                  <Text style={styles.cardMeta}>
                    登録日: {formatDate(app.created_at)}
                  </Text>

                  {/* 審査待ち問題集 */}
                  {app.pending_question_sets.length > 0 && (
                    <View style={styles.qsList}>
                      <Text style={styles.qsLabel}>審査待ち問題集 ({app.pending_question_sets.length}件)</Text>
                      {app.pending_question_sets.map((qs) => (
                        <View key={qs.id} style={styles.qsItem}>
                          <Text style={styles.qsTitle}>{qs.title}</Text>
                          <Text style={styles.qsMeta}>
                            {qs.category} · {qs.total_questions}問 ·{' '}
                            {qs.content_language === 'en' ? 'English' : '日本語'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 管理者メモ */}
                  {app.seller_application_admin_note ? (
                    <View style={styles.adminNoteBox}>
                      <Text style={styles.adminNoteLabel}>管理者メモ:</Text>
                      <Text style={styles.adminNoteText}>{app.seller_application_admin_note}</Text>
                    </View>
                  ) : null}

                  {/* 審査ボタン（審査待ちのみ） */}
                  {app.seller_application_status === 'pending' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => openApproveModal(app)}
                      >
                        <Text style={styles.approveButtonText}>承認</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => openRejectModal(app)}
                      >
                        <Text style={styles.rejectButtonText}>却下</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
          <View style={styles.listFooter} />
        </ScrollView>
      )}

      {/* 審査モーダル */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalMode === 'approve' ? '申請を承認する' : '申請を却下する'}
            </Text>
            {selectedApp && (
              <Text style={styles.modalSubtitle}>{selectedApp.username}（{selectedApp.email}）</Text>
            )}

            <Text style={styles.modalInputLabel}>
              {modalMode === 'approve' ? 'コメント（任意）' : '却下理由（必須）'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder={
                modalMode === 'approve'
                  ? '承認に関するコメントを入力...'
                  : '却下理由を入力してください...'
              }
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  modalMode === 'approve' ? styles.modalApproveButton : styles.modalRejectButton,
                  isSubmitting && styles.buttonDisabled,
                ]}
                onPress={handleSubmitReview}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalActionText}>
                    {modalMode === 'approve' ? '承認する' : '却下する'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...platformShadow({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    }),
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardEmail: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  qsList: {
    marginTop: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 10,
  },
  qsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  qsItem: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  qsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  qsMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  adminNoteBox: {
    marginTop: 10,
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  adminNoteLabel: {
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
    marginBottom: 3,
  },
  adminNoteText: {
    fontSize: 13,
    color: '#333',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  listFooter: {
    height: 32,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1C1C1E',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#3A3A3C',
    fontWeight: '500',
  },
  modalApproveButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#34C759',
  },
  modalRejectButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  },
  modalActionText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
});
