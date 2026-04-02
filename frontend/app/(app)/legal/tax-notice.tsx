import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';

type QA = {
  question: string;
  answer: string;
};

const FAQ: QA[] = [
  {
    question: '確定申告が必要になるのはいつですか？',
    answer:
      '給与所得者（会社員等）の場合、給与所得以外の所得（副業収入）が年間20万円を超えると確定申告が必要になります。\n\n専業主婦・学生・フリーランスの場合は、基礎控除額（48万円）を超える所得がある場合に申告が必要です。\n\n※2024年分以降の基礎控除は48万円（所得金額によって変動）',
  },
  {
    question: '収益はどのように計算されますか？',
    answer:
      '販売価格の90%が販売者の収益となります（プラットフォーム手数料10%を除いた金額）。\n\n例：販売価格1,000円 × 3件 = 売上3,000円\n　プラットフォーム手数料 300円\n　販売者の収益 2,700円',
  },
  {
    question: '収益の証明はどうすれば取得できますか？',
    answer:
      '販売者ダッシュボードの「売上CSVダウンロード」機能から、全取引の明細（日時・金額・手数料）をCSV形式でダウンロードできます。\n\n確定申告の際はこのデータをご活用ください。\n\nまた、Stripeから年間取引明細書が発行されます（Stripeダッシュボードよりダウンロード可能）。',
  },
  {
    question: '消費税はどうなりますか？',
    answer:
      '課税売上高が年間1,000万円を超える事業者は消費税の申告・納付義務が生じます。多くの個人販売者はこの基準を下回るため、消費税の申告義務は発生しません。\n\nインボイス制度（適格請求書等保存方式）については、税理士や税務署にご確認ください。',
  },
  {
    question: '所得の種類は何になりますか？',
    answer:
      '一般的には「雑所得」または「事業所得」として扱われます。\n\n・副業として継続的に販売している場合：雑所得\n・本業として組織的・継続的に販売している場合：事業所得\n\n具体的な判断は税理士または税務署にご相談ください。',
  },
];

export default function TaxNoticeScreen() {
  const router = useRouter();

  const openNTA = () => {
    Linking.openURL('https://www.nta.go.jp/');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>税務に関するご案内</Text>
        <Text style={styles.subtitle}>
          問題集の販売による収益は税務上の所得となる場合があります
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            本ページは一般的な情報提供を目的としており、税務上の法的アドバイスではありません。
            具体的な税務処理については、税理士または最寄りの税務署にご相談ください。
          </Text>
        </View>

        <View style={styles.keyPointBox}>
          <Text style={styles.keyPointTitle}>まず確認すること</Text>
          <View style={styles.keyPoint}>
            <Text style={styles.keyPointNumber}>1</Text>
            <Text style={styles.keyPointText}>
              年間の販売収益（プラットフォーム手数料控除後）を記録する
            </Text>
          </View>
          <View style={styles.keyPoint}>
            <Text style={styles.keyPointNumber}>2</Text>
            <Text style={styles.keyPointText}>
              給与所得者は年間20万円を超えたら確定申告が必要
            </Text>
          </View>
          <View style={styles.keyPoint}>
            <Text style={styles.keyPointNumber}>3</Text>
            <Text style={styles.keyPointText}>
              売上CSVをダウンロードして収益の記録を保管する
            </Text>
          </View>
        </View>

        <Text style={styles.faqTitle}>よくある質問</Text>

        {FAQ.map((item, index) => (
          <View key={index} style={styles.faqItem}>
            <View style={styles.questionRow}>
              <Text style={styles.questionMark}>Q</Text>
              <Text style={styles.question}>{item.question}</Text>
            </View>
            <View style={styles.answerRow}>
              <Text style={styles.answerMark}>A</Text>
              <Text style={styles.answer}>{item.answer}</Text>
            </View>
          </View>
        ))}

        <View style={styles.resourceBox}>
          <Text style={styles.resourceTitle}>参考リンク</Text>
          <TouchableOpacity onPress={openNTA} style={styles.linkButton}>
            <Text style={styles.linkText}>国税庁ウェブサイト（確定申告・税金の情報）</Text>
            <Text style={styles.linkArrow}>→</Text>
          </TouchableOpacity>
        </View>

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
    backgroundColor: '#FF9500',
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
    lineHeight: 18,
  },
  content: {
    padding: 16,
  },
  warningBox: {
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  warningIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#6d4c41',
    lineHeight: 18,
  },
  keyPointBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  keyPointTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 12,
  },
  keyPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  keyPointNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1976d2',
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 10,
    marginTop: 1,
  },
  keyPointText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  faqTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  questionMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF9500',
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 10,
  },
  question: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    lineHeight: 20,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  answerMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 10,
  },
  answer: {
    flex: 1,
    fontSize: 13,
    color: '#444',
    lineHeight: 21,
  },
  resourceBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  linkText: {
    fontSize: 13,
    color: '#007AFF',
    flex: 1,
  },
  linkArrow: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 8,
  },
  updatedAt: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 32,
  },
});
