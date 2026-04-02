import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

type Section = {
  title: string;
  content: string;
};

const SECTIONS: Section[] = [
  {
    title: '第1条（目的）',
    content:
      '本販売者利用規約（以下「本規約」）は、QuizMarketplace（以下「本サービス」）において問題集を販売するユーザー（以下「販売者」）が守るべきルールを定めるものです。販売者として登録した時点で本規約に同意したものとみなします。',
  },
  {
    title: '第2条（売上分配・手数料）',
    content:
      '・プラットフォーム手数料：販売価格の10%\n・販売者への支払額：販売価格の90%\n\n例：販売価格1,000円の場合\n　プラットフォーム手数料：100円\n　販売者受取額：900円\n\n手数料はStripe Connect経由で自動的に処理されます。売上はStripeアカウントへ送金されます。送金時期はStripeの規約に準じます。',
  },
  {
    title: '第3条（返金・キャンセルポリシー）',
    content:
      'デジタルコンテンツの性質上、購入完了後の返金は原則として行いません。\n\n【例外的に返金対応する場合】\n・問題集の内容に重大な欠陥がある（閲覧不能・内容が空等）\n・誤課金が発生した場合\n・その他、当プラットフォームが返金を適切と判断した場合\n\n返金が発生した場合、該当取引の販売者受取額から差し引かれます。購入者からの問い合わせに誠実に対応してください。',
  },
  {
    title: '第4条（著作権・コンテンツ責任）',
    content:
      '■ 著作権に関するルール\n\n販売者は投稿するすべてのコンテンツの著作権を自ら保有しているか、または適法な権限を持っていることを保証しなければなりません。\n\n【禁止されるコンテンツ】\n・市販の問題集・参考書からの無断転載\n・大学入試・センター試験・模擬試験等の過去問の全文または大部分のコピー\n・有料オンライン講座・教材の問題文の転用\n・他者が著作権を持つ文章・図表の無断使用\n\n■ AIによる著作権チェックについて\n\n本サービスでは、問題集の公開前にGPT-OSS（AI）を使用した著作権チェックが必須です。チェックの結果「高リスク」と判定されたコンテンツは公開できません。AIチェックはあくまで補助的な手段であり、最終的な著作権の責任は販売者が負うものとします。\n\n■ 通報・削除について\n\n著作権者または第三者からの著作権侵害の申告があった場合、当プラットフォームは通知なく問題集を非公開化・削除し、販売者アカウントを停止することがあります。',
  },
  {
    title: '第5条（禁止事項）',
    content:
      '販売者は以下の行為を行ってはなりません：\n\n① 他者の著作物を無断で使用した問題集の販売（第4条参照）\n② 虚偽・誇大な説明による販売\n③ 実態のない問題集（空・極端に品質が低い）の販売\n④ 他のユーザーへの迷惑行為\n⑤ 架空購入・自己購入による売上水増し\n⑥ 法令に違反するコンテンツの販売',
  },
  {
    title: '第6条（不正販売への対応）',
    content:
      '不正行為が確認された場合、当プラットフォームは事前通知なく以下の措置を取ることができます：\n\n・問題集の非公開化・削除\n・販売者アカウントの一時停止または永久停止\n・未払い売上の没収\n・法的措置の実施\n\n不正行為によって発生した損害は、販売者が全額負担するものとします。',
  },
  {
    title: '第7条（税務上の義務）',
    content:
      '販売者は自身の収益に関する税務上の義務を負います。\n\n・年間収益が20万円を超える場合は確定申告が必要になる可能性があります\n・副業所得として所得税の課税対象となる場合があります\n・詳細は税理士または税務署にご相談ください\n\n当プラットフォームは税務に関する法的アドバイスを提供しません。',
  },
  {
    title: '第8条（免責事項）',
    content:
      '当プラットフォームは、販売者が提供するコンテンツの内容について責任を負いません。販売者は自身が販売する問題集の品質・正確性・著作権等について責任を持ちます。\n\nシステム障害・通信障害等の不可抗力による販売機会の損失について、当プラットフォームは責任を負いません。',
  },
  {
    title: '第9条（規約の変更）',
    content:
      '当プラットフォームは、必要に応じて本規約を変更する場合があります。変更後も本サービスを利用し続けた場合、変更後の規約に同意したものとみなします。重要な変更の場合はアプリ内通知でお知らせします。',
  },
];

type Props = {
  onAccept?: () => void;
  showAcceptButton?: boolean;
};

export default function SellerTermsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const showAcceptButton = params.mode === 'onboarding';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>販売者向け利用規約</Text>
        <Text style={styles.subtitle}>
          問題集を販売するすべてのユーザーに適用されます
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>重要事項のまとめ</Text>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>💰</Text>
            <Text style={styles.summaryText}>
              手数料10%・販売者受取90%（Stripe Connect経由）
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>🚫</Text>
            <Text style={styles.summaryText}>
              購入後の返金は原則不可（重大な欠陥を除く）
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>🔍</Text>
            <Text style={styles.summaryText}>
              公開前にAI著作権チェック（GPT-OSS）が必須
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>⚠️</Text>
            <Text style={styles.summaryText}>
              著作権違反・不正販売はアカウント停止の対象
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryBullet}>📋</Text>
            <Text style={styles.summaryText}>
              年間20万円超の収益は確定申告が必要な場合があります
            </Text>
          </View>
        </View>

        {SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {showAcceptButton && (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => router.back()}
          >
            <Text style={styles.acceptButtonText}>内容を確認しました</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.updatedAt}>最終更新日：2026年4月</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#34C759',
    padding: 24,
    paddingTop: 40,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    opacity: 0.9,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.85,
  },
  content: {
    padding: 16,
  },
  summaryBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#a5d6a7',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  summaryBullet: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 10,
  },
  sectionContent: {
    fontSize: 13,
    color: '#444',
    lineHeight: 22,
  },
  acceptButton: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  updatedAt: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 32,
  },
});
