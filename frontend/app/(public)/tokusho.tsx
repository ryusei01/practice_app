import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";

const DEFAULT_SUPPORT_EMAIL = "support@ai-practice-book.com";

const PLACEHOLDER_SELLER = "[事業者名をここに記載してください]";
const PLACEHOLDER_OPERATOR = "[運営責任者氏名をここに記載してください]";
const PLACEHOLDER_ADDRESS = "[住所をここに記載してください]";
const PLACEHOLDER_PHONE =
  "[電話番号をここに記載してください]\n（お問い合わせはメールにて承ります）";

type SectionItem = {
  label: string;
  value: string;
};

function buildTokushoItems(): SectionItem[] {
  const seller =
    process.env.EXPO_PUBLIC_TOKUSHO_SELLER_NAME?.trim() || PLACEHOLDER_SELLER;
  const operator =
    process.env.EXPO_PUBLIC_TOKUSHO_OPERATOR_NAME?.trim() ||
    PLACEHOLDER_OPERATOR;
  const address =
    process.env.EXPO_PUBLIC_TOKUSHO_ADDRESS?.trim() || PLACEHOLDER_ADDRESS;
  const phoneRaw = process.env.EXPO_PUBLIC_TOKUSHO_PHONE?.trim();
  const phone = phoneRaw
    ? `${phoneRaw}\n（お問い合わせはメールにて承ります）`
    : PLACEHOLDER_PHONE;
  const email =
    process.env.EXPO_PUBLIC_TOKUSHO_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;

  return [
    { label: "販売業者", value: seller },
    { label: "運営責任者", value: operator },
    { label: "所在地", value: address },
    { label: "電話番号", value: phone },
    { label: "メールアドレス", value: email },
    { label: "サービス名", value: "AI Practice Book" },
    {
      label: "商品の販売価格",
      value:
        "各問題集の販売ページに表示された価格（円）\n※価格は消費税込みで表示されます",
    },
    {
      label: "商品代金以外に必要となる費用",
      value:
        "インターネット接続料、通信費等はお客様のご負担となります。\nモバイルアプリを利用する場合、App Store または Google Play の定める方法・条件に従い、アプリの入手または利用に関する料金が発生することがあります。",
    },
    {
      label: "支払方法",
      value:
        "クレジットカード（Stripe経由）\n・Visa / Mastercard / American Express / JCB",
    },
    {
      label: "支払時期",
      value: "購入手続き完了時に決済されます",
    },
    {
      label: "商品の引渡時期",
      value: "購入手続き完了後、即時にアプリ内でご利用いただけます",
    },
    {
      label: "返品・キャンセルについて",
      value:
        "デジタルコンテンツの性質上、購入完了後の返品・キャンセルは原則として承っておりません。\n\n例外として、下記の場合は対応いたします：\n・購入した問題集に重大な欠陥（内容が表示されない等）がある場合\n・誤課金が発生した場合\n\nこれらの場合は購入から7日以内にサポートへご連絡ください。",
    },
    {
      label: "動作環境",
      value: "iOS 15以降 / Android 10以降",
    },
  ];
}

export default function TokushoScreen() {
  const items = useMemo(() => buildTokushoItems(), []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>特定商取引法に基づく表記</Text>
        <Text style={styles.subtitle}>
          特定商取引に関する法律第11条に基づき、以下の通り表示します。
        </Text>
      </View>

      <View style={styles.content}>
        {items.map((item, index) => (
          <View key={index} style={styles.row}>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>{item.label}</Text>
            </View>
            <View style={styles.valueContainer}>
              <Text style={styles.value}>{item.value}</Text>
            </View>
          </View>
        ))}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>【プラットフォーム利用について】</Text>
          <Text style={styles.noticeText}>
            本サービスは、ユーザーが作成した問題集を他のユーザーへ販売できるプラットフォームです。
            有料の問題集を購入する際の代金決済は、本サービスの運営者が Stripe
            を通じて処理します（表示上の販売者は各問題集の出品ユーザーです）。
          </Text>
          <Text style={styles.noticeText}>
            課金・決済・誤課金・返金に関するお問い合わせは、上記メールアドレス（サポート）までご連絡ください。
            問題集の内容そのものに関するお問い合わせは、各問題集の販売者へ直接ご連絡ください。
            不正な販売や問題のある内容を発見した場合は、サポートまでご報告ください。
          </Text>
        </View>

        <Text style={styles.updatedAt}>最終更新日：2026年4月</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#007AFF",
    padding: 24,
    paddingTop: 40,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    opacity: 0.9,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#fff",
    opacity: 0.85,
    lineHeight: 18,
  },
  content: {
    padding: 16,
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  labelContainer: {
    width: 120,
    backgroundColor: "#f0f0f0",
    padding: 14,
    justifyContent: "flex-start",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
    lineHeight: 18,
  },
  valueContainer: {
    flex: 1,
    padding: 14,
  },
  value: {
    fontSize: 13,
    color: "#333",
    lineHeight: 20,
  },
  notice: {
    backgroundColor: "#fff9e6",
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#f0a500",
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 13,
    color: "#555",
    lineHeight: 20,
    marginBottom: 8,
  },
  updatedAt: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 16,
    marginBottom: 32,
  },
});
