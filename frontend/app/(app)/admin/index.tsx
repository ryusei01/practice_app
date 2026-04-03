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
import { adminApi, SellerApplication, AdminUser, CreateAdminRequest } from '../../../src/api/admin';
import { reportsApi, ContentReport, ReportStatus } from '../../../src/api/reports';
import Header from '../../../src/components/Header';

type SectionType = 'sellers' | 'users' | 'reports';

// ============================================================
// Seller Applications Tab
// ============================================================

function SellerApplicationsTab() {
  type SellerTabType = 'pending' | 'all';
  const [applications, setApplications] = useState<SellerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<SellerTabType>('pending');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SellerApplication | null>(null);
  const [modalMode, setModalMode] = useState<'approve' | 'reject'>('approve');
  const [adminNote, setAdminNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadApplications = useCallback(async () => {
    try {
      const statusFilter = activeTab === 'pending' ? 'pending' : undefined;
      const data = await adminApi.getSellerApplications(statusFilter);
      setApplications(data);
    } catch (error: any) {
      if (error.response?.status !== 403) {
        Alert.alert('エラー', '申請一覧の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setIsLoading(true);
    loadApplications();
  }, [loadApplications]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadApplications();
  };

  const openModal = (app: SellerApplication, mode: 'approve' | 'reject') => {
    setSelectedApp(app);
    setModalMode(mode);
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

  if (isLoading) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <View style={s.subTabBar}>
        {(['pending', 'all'] as SellerTabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.subTab, activeTab === tab && s.subTabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.subTabText, activeTab === tab && s.subTabTextActive]}>
              {tab === 'pending' ? '審査待ち' : '全件'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {applications.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>
              {activeTab === 'pending' ? '審査待ちの申請はありません' : '申請はありません'}
            </Text>
          </View>
        ) : (
          applications.map((app) => {
            const statusInfo = getStatusLabel(app.seller_application_status);
            return (
              <View key={app.id} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName}>{app.username}</Text>
                    <Text style={s.cardEmail}>{app.email}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusInfo.color }]}>
                    <Text style={s.statusBadgeText}>{statusInfo.label}</Text>
                  </View>
                </View>
                <Text style={s.cardMeta}>申請日: {formatDate(app.seller_application_submitted_at)}</Text>
                <Text style={s.cardMeta}>登録日: {formatDate(app.created_at)}</Text>

                {app.pending_question_sets.length > 0 && (
                  <View style={s.infoBox}>
                    <Text style={s.infoBoxLabel}>審査待ち問題集 ({app.pending_question_sets.length}件)</Text>
                    {app.pending_question_sets.map((qs) => (
                      <View key={qs.id} style={s.infoBoxItem}>
                        <Text style={s.infoBoxItemTitle}>{qs.title}</Text>
                        <Text style={s.infoBoxItemMeta}>
                          {qs.category} · {qs.total_questions}問 · {qs.content_language === 'en' ? 'English' : '日本語'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {app.seller_application_admin_note ? (
                  <View style={s.adminNoteBox}>
                    <Text style={s.adminNoteLabel}>管理者メモ:</Text>
                    <Text style={s.adminNoteText}>{app.seller_application_admin_note}</Text>
                  </View>
                ) : null}

                {app.seller_application_status === 'pending' && (
                  <View style={s.actionRow}>
                    <TouchableOpacity style={s.approveBtn} onPress={() => openModal(app, 'approve')}>
                      <Text style={s.actionBtnText}>承認</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.rejectBtn} onPress={() => openModal(app, 'reject')}>
                      <Text style={s.actionBtnText}>却下</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={s.listFooter} />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {modalMode === 'approve' ? '申請を承認する' : '申請を却下する'}
            </Text>
            {selectedApp && (
              <Text style={s.modalSubtitle}>{selectedApp.username}（{selectedApp.email}）</Text>
            )}
            <Text style={s.modalInputLabel}>
              {modalMode === 'approve' ? 'コメント（任意）' : '却下理由（必須）'}
            </Text>
            <TextInput
              style={s.modalInput}
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder={modalMode === 'approve' ? '承認に関するコメントを入力...' : '却下理由を入力してください...'}
              multiline
              numberOfLines={3}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setModalVisible(false)} disabled={isSubmitting}>
                <Text style={s.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalMode === 'approve' ? s.modalApproveBtn : s.modalRejectBtn, isSubmitting && s.btnDisabled]}
                onPress={handleSubmitReview}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.modalActionText}>{modalMode === 'approve' ? '承認する' : '却下する'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ============================================================
// Users Management Tab
// ============================================================

function UsersTab({ currentUserRole }: { currentUserRole: string }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const isSuperAdmin = currentUserRole === 'super_admin';

  const loadUsers = useCallback(async () => {
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch {
      Alert.alert('エラー', 'ユーザー一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadUsers();
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleToggleActive = async (user: AdminUser) => {
    const action = user.is_active ? 'deactivateUser' : 'activateUser';
    const actionLabel = user.is_active ? '無効化' : '有効化';

    Alert.alert(
      `ユーザーを${actionLabel}`,
      `${user.username}（${user.email}）を${actionLabel}しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: actionLabel,
          style: user.is_active ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await adminApi[action](user.id);
              Alert.alert('完了', `${user.username} を${actionLabel}しました`);
              loadUsers();
            } catch (error: any) {
              Alert.alert('エラー', error.response?.data?.detail || `${actionLabel}に失敗しました`);
            }
          },
        },
      ]
    );
  };

  const openRoleModal = (user: AdminUser) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setRoleModalVisible(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || selectedRole === selectedUser.role) {
      setRoleModalVisible(false);
      return;
    }
    setIsSubmitting(true);
    try {
      await adminApi.updateUserRole(selectedUser.id, selectedRole);
      Alert.alert('完了', `${selectedUser.username} のロールを${getRoleLabel(selectedRole)}に変更しました`);
      setRoleModalVisible(false);
      loadUsers();
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.detail || 'ロール変更に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminUsername.trim() || !newAdminPassword.trim()) {
      Alert.alert('入力エラー', 'すべての項目を入力してください');
      return;
    }
    if (newAdminPassword.length < 8) {
      Alert.alert('入力エラー', 'パスワードは8文字以上で入力してください');
      return;
    }
    setIsSubmitting(true);
    try {
      await adminApi.createAdmin({
        email: newAdminEmail,
        username: newAdminUsername,
        password: newAdminPassword,
        role: 'admin',
      });
      Alert.alert('完了', `管理者 ${newAdminUsername} を作成しました`);
      setCreateModalVisible(false);
      setNewAdminEmail('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      loadUsers();
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.detail || '管理者の作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return '最高管理者';
      case 'admin': return '管理者';
      default: return '一般ユーザー';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return '#FF2D55';
      case 'admin': return '#5856D6';
      default: return '#8E8E93';
    }
  };

  if (isLoading) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="ユーザー名またはメールで検索..."
          placeholderTextColor="#8E8E93"
        />
        {isSuperAdmin && (
          <TouchableOpacity style={s.createAdminBtn} onPress={() => setCreateModalVisible(true)}>
            <Text style={s.createAdminBtnText}>+ 管理者作成</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <Text style={s.resultCount}>{filteredUsers.length}件のユーザー</Text>
        {filteredUsers.map((u) => (
          <View key={u.id} style={[s.card, !u.is_active && s.cardInactive]}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.cardName}>{u.username}</Text>
                  {!u.is_active && (
                    <View style={[s.statusBadge, { backgroundColor: '#8E8E93' }]}>
                      <Text style={s.statusBadgeText}>無効</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardEmail}>{u.email}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: getRoleBadgeColor(u.role) }]}>
                <Text style={s.statusBadgeText}>{getRoleLabel(u.role)}</Text>
              </View>
            </View>

            <View style={s.userMetaRow}>
              {u.is_seller && <View style={s.tagBadge}><Text style={s.tagBadgeText}>出品者</Text></View>}
              {u.is_premium && <View style={[s.tagBadge, { backgroundColor: '#FF9500' }]}><Text style={s.tagBadgeText}>プレミアム</Text></View>}
            </View>

            <Text style={s.cardMeta}>
              登録日: {new Date(u.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
            </Text>

            {u.id !== currentUser?.id && (
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={[s.actionBtnSmall, u.is_active ? s.deactivateBtn : s.activateBtn]}
                  onPress={() => handleToggleActive(u)}
                >
                  <Text style={s.actionBtnSmallText}>{u.is_active ? '無効化' : '有効化'}</Text>
                </TouchableOpacity>
                {isSuperAdmin && (
                  <TouchableOpacity style={[s.actionBtnSmall, s.roleChangeBtn]} onPress={() => openRoleModal(u)}>
                    <Text style={s.actionBtnSmallText}>ロール変更</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
        <View style={s.listFooter} />
      </ScrollView>

      {/* ロール変更モーダル */}
      <Modal visible={roleModalVisible} transparent animationType="slide" onRequestClose={() => setRoleModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>ロールを変更</Text>
            {selectedUser && (
              <Text style={s.modalSubtitle}>{selectedUser.username}（{selectedUser.email}）</Text>
            )}
            <Text style={s.modalInputLabel}>新しいロール</Text>
            {(['user', 'admin'] as const).map((role) => (
              <TouchableOpacity
                key={role}
                style={[s.roleOption, selectedRole === role && s.roleOptionSelected]}
                onPress={() => setSelectedRole(role)}
              >
                <View style={[s.roleRadio, selectedRole === role && s.roleRadioSelected]} />
                <Text style={[s.roleOptionText, selectedRole === role && s.roleOptionTextSelected]}>
                  {getRoleLabel(role)}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setRoleModalVisible(false)} disabled={isSubmitting}>
                <Text style={s.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalApproveBtn, isSubmitting && s.btnDisabled]}
                onPress={handleUpdateRole}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.modalActionText}>変更する</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 管理者作成モーダル */}
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>管理者を作成</Text>
            <Text style={s.modalSubtitle}>新しい管理者アカウントを作成します</Text>

            <Text style={s.modalInputLabel}>ユーザー名</Text>
            <TextInput
              style={s.modalInputSingle}
              value={newAdminUsername}
              onChangeText={setNewAdminUsername}
              placeholder="ユーザー名を入力..."
            />
            <Text style={s.modalInputLabel}>メールアドレス</Text>
            <TextInput
              style={s.modalInputSingle}
              value={newAdminEmail}
              onChangeText={setNewAdminEmail}
              placeholder="メールアドレスを入力..."
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={s.modalInputLabel}>パスワード（8文字以上）</Text>
            <TextInput
              style={s.modalInputSingle}
              value={newAdminPassword}
              onChangeText={setNewAdminPassword}
              placeholder="パスワードを入力..."
              secureTextEntry
            />

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => { setCreateModalVisible(false); setNewAdminEmail(''); setNewAdminUsername(''); setNewAdminPassword(''); }}
                disabled={isSubmitting}
              >
                <Text style={s.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalApproveBtn, isSubmitting && s.btnDisabled]}
                onPress={handleCreateAdmin}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.modalActionText}>作成する</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ============================================================
// Reports Management Tab
// ============================================================

function ReportsTab() {
  type ReportTabType = 'pending' | 'reviewing' | 'all';
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTabType>('pending');

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [newStatus, setNewStatus] = useState<ReportStatus>('reviewing');
  const [adminNote, setAdminNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const statusParam = activeTab === 'all' ? undefined : activeTab;
      const data = await reportsApi.list({ status: statusParam as ReportStatus | undefined });
      setReports(data);
    } catch {
      Alert.alert('エラー', '通報一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setIsLoading(true);
    loadReports();
  }, [loadReports]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadReports();
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'copyright': return '著作権侵害';
      case 'spam': return 'スパム';
      case 'inappropriate': return '不適切コンテンツ';
      case 'other': return 'その他';
      default: return reason;
    }
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'copyright': return '#FF2D55';
      case 'spam': return '#FF9500';
      case 'inappropriate': return '#AF52DE';
      default: return '#8E8E93';
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { label: '未対応', color: '#FF9500' };
      case 'reviewing': return { label: '対応中', color: '#007AFF' };
      case 'resolved': return { label: '解決済み', color: '#34C759' };
      case 'rejected': return { label: '棄却', color: '#8E8E93' };
      default: return { label: status, color: '#8E8E93' };
    }
  };

  const openUpdateModal = (report: ContentReport) => {
    setSelectedReport(report);
    setNewStatus(report.status === 'pending' ? 'reviewing' : 'resolved');
    setAdminNote(report.admin_note || '');
    setModalVisible(true);
  };

  const handleUpdateReport = async () => {
    if (!selectedReport) return;
    setIsSubmitting(true);
    try {
      await reportsApi.update(selectedReport.id, { status: newStatus, admin_note: adminNote || undefined });
      Alert.alert('完了', '通報のステータスを更新しました');
      setModalVisible(false);
      loadReports();
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.detail || 'ステータス更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <View style={s.subTabBar}>
        {([
          { key: 'pending' as const, label: '未対応' },
          { key: 'reviewing' as const, label: '対応中' },
          { key: 'all' as const, label: '全件' },
        ]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[s.subTab, activeTab === key && s.subTabActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[s.subTabText, activeTab === key && s.subTabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {reports.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>通報はありません</Text>
          </View>
        ) : (
          reports.map((report) => {
            const statusInfo = getStatusInfo(report.status);
            return (
              <View key={report.id} style={s.card}>
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <View style={[s.statusBadge, { backgroundColor: getReasonColor(report.reason) }]}>
                        <Text style={s.statusBadgeText}>{getReasonLabel(report.reason)}</Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: statusInfo.color }]}>
                        <Text style={s.statusBadgeText}>{statusInfo.label}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <Text style={s.cardMeta}>問題集ID: {report.question_set_id.slice(0, 8)}...</Text>
                <Text style={s.cardMeta}>通報者ID: {report.reporter_id.slice(0, 8)}...</Text>
                <Text style={s.cardMeta}>
                  通報日: {new Date(report.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>

                {report.description && (
                  <View style={s.infoBox}>
                    <Text style={s.infoBoxLabel}>通報内容</Text>
                    <Text style={s.cardMeta}>{report.description}</Text>
                  </View>
                )}

                {report.admin_note && (
                  <View style={s.adminNoteBox}>
                    <Text style={s.adminNoteLabel}>管理者メモ:</Text>
                    <Text style={s.adminNoteText}>{report.admin_note}</Text>
                  </View>
                )}

                {report.status !== 'resolved' && report.status !== 'rejected' && (
                  <View style={s.actionRow}>
                    <TouchableOpacity style={[s.actionBtnSmall, { backgroundColor: '#007AFF' }]} onPress={() => openUpdateModal(report)}>
                      <Text style={s.actionBtnSmallText}>ステータス更新</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={s.listFooter} />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>通報のステータスを更新</Text>
            {selectedReport && (
              <Text style={s.modalSubtitle}>{getReasonLabel(selectedReport.reason)} - {selectedReport.question_set_id.slice(0, 8)}...</Text>
            )}

            <Text style={s.modalInputLabel}>新しいステータス</Text>
            {([
              { value: 'reviewing' as const, label: '対応中' },
              { value: 'resolved' as const, label: '解決済み' },
              { value: 'rejected' as const, label: '棄却' },
            ]).map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[s.roleOption, newStatus === value && s.roleOptionSelected]}
                onPress={() => setNewStatus(value)}
              >
                <View style={[s.roleRadio, newStatus === value && s.roleRadioSelected]} />
                <Text style={[s.roleOptionText, newStatus === value && s.roleOptionTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={[s.modalInputLabel, { marginTop: 16 }]}>管理者メモ（任意）</Text>
            <TextInput
              style={s.modalInput}
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder="対応内容などを入力..."
              multiline
              numberOfLines={3}
            />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setModalVisible(false)} disabled={isSubmitting}>
                <Text style={s.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalApproveBtn, isSubmitting && s.btnDisabled]}
                onPress={handleUpdateReport}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.modalActionText}>更新する</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ============================================================
// Main Admin Screen
// ============================================================

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionType>('sellers');

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('アクセス拒否', '管理者権限が必要です');
      router.back();
    }
  }, [isAdmin]);

  if (!isAdmin) return null;

  const sections: { key: SectionType; label: string; color: string }[] = [
    { key: 'sellers', label: '出品者申請', color: '#34C759' },
    { key: 'users', label: 'ユーザー管理', color: '#5856D6' },
    { key: 'reports', label: '通報管理', color: '#FF2D55' },
  ];

  return (
    <View style={s.container}>
      <Header title="管理者パネル" />

      <View style={s.mainTabBar}>
        {sections.map(({ key, label, color }) => (
          <TouchableOpacity
            key={key}
            style={[s.mainTab, activeSection === key && { borderBottomColor: color }]}
            onPress={() => setActiveSection(key)}
          >
            <Text style={[s.mainTabText, activeSection === key && { color, fontWeight: '700' }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeSection === 'sellers' && <SellerApplicationsTab />}
      {activeSection === 'users' && <UsersTab currentUserRole={user?.role || 'user'} />}
      {activeSection === 'reports' && <ReportsTab />}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  mainTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  mainTab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  mainTabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  subTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  subTabActive: {
    backgroundColor: '#007AFF',
  },
  subTabText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  subTabTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  },
  cardInactive: {
    opacity: 0.6,
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
  userMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  tagBadge: {
    backgroundColor: '#34C759',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 10,
  },
  infoBoxLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  infoBoxItem: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  infoBoxItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  infoBoxItemMeta: {
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
  approveBtn: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnSmall: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  actionBtnSmallText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  deactivateBtn: {
    backgroundColor: '#FF3B30',
  },
  activateBtn: {
    backgroundColor: '#34C759',
  },
  roleChangeBtn: {
    backgroundColor: '#5856D6',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 0,
    gap: 10,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  createAdminBtn: {
    backgroundColor: '#5856D6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  createAdminBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  resultCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  listFooter: {
    height: 32,
  },
  btnDisabled: {
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
    maxHeight: '80%',
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
  modalInputSingle: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
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
  modalApproveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  modalRejectBtn: {
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
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8F8F8',
    marginBottom: 8,
    gap: 12,
  },
  roleOptionSelected: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  roleOptionText: {
    fontSize: 15,
    color: '#3A3A3C',
  },
  roleOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  roleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7C7CC',
  },
  roleRadioSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
});
