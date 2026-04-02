import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useLanguage } from "../../src/contexts/LanguageContext";

export default function TermsOfServiceScreen() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t("← Back", "← 戻る")}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: isSmallScreen ? 18 : 22 }]}>
          {t("Terms of Service", "利用規約")}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { maxWidth: 800, alignSelf: "center", width: "100%" },
        ]}
      >
        <Text style={styles.lastUpdated}>
          {t("Last updated: April 2026", "最終更新日：2026年4月")}
        </Text>

        <Section title={t("1. Introduction", "第1条（目的・適用）")}>
          <Text style={styles.body}>
            {t(
              "These Terms of Service (\"Terms\") govern your use of AI Practice Book (\"the Service\") operated by its developer (\"we\" or \"us\"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the Service.",
              "本利用規約（以下「本規約」）は、開発者（以下「当社」）が提供するAI Practice Book（以下「本サービス」）の利用条件を定めるものです。本サービスをご利用になる場合は、本規約に同意していただく必要があります。"
            )}
          </Text>
        </Section>

        <Section title={t("2. Account Registration", "第2条（アカウント登録）")}>
          <Text style={styles.body}>
            {t(
              "To use certain features of the Service, you must sign in with a Google account. By signing in, you represent that:",
              "本サービスの一部機能を利用するには、Googleアカウントによるログインが必要です。ログインすることにより、以下を表明・保証したものとみなします："
            )}
          </Text>
          <BulletItem
            text={t(
              "You are at least 13 years of age",
              "13歳以上であること"
            )}
          />
          <BulletItem
            text={t(
              "You will provide accurate and complete information",
              "正確かつ完全な情報を提供すること"
            )}
          />
          <BulletItem
            text={t(
              "You are responsible for maintaining the security of your account",
              "アカウントのセキュリティを維持する責任を負うこと"
            )}
          />
          <Text style={[styles.body, styles.note]}>
            {t(
              "One person may not maintain more than one account.",
              "一人の方が複数のアカウントを作成・維持することはできません。"
            )}
          </Text>
        </Section>

        <Section title={t("3. Permitted Use and Prohibited Actions", "第3条（利用者の義務・禁止事項）")}>
          <Text style={styles.body}>
            {t(
              "You agree not to engage in any of the following:",
              "利用者は以下の行為を行ってはなりません："
            )}
          </Text>
          <BulletItem
            text={t(
              "Violating any applicable laws or regulations",
              "法令または本規約に違反する行為"
            )}
          />
          <BulletItem
            text={t(
              "Infringing on the intellectual property rights of others",
              "他者の著作権・知的財産権を侵害する行為"
            )}
          />
          <BulletItem
            text={t(
              "Uploading or transmitting harmful, offensive, or inappropriate content",
              "有害・不適切なコンテンツのアップロードまたは送信"
            )}
          />
          <BulletItem
            text={t(
              "Attempting to gain unauthorized access to any part of the Service",
              "本サービスへの不正アクセスを試みる行為"
            )}
          />
          <BulletItem
            text={t(
              "Using the Service for fraudulent purposes or to mislead other users",
              "不正目的または他のユーザーを誤解させる目的での利用"
            )}
          />
          <BulletItem
            text={t(
              "Reverse-engineering, decompiling, or disassembling any part of the Service",
              "本サービスのリバースエンジニアリング・逆コンパイル・逆アセンブル"
            )}
          />
        </Section>

        <Section title={t("4. Purchases and Digital Content", "第4条（問題集の購入・デジタルコンテンツ）")}>
          <Text style={styles.body}>
            {t(
              "The Service allows users to purchase question sets created by other users (\"Sellers\"). The following terms apply to all purchases:",
              "本サービスでは、他のユーザー（「販売者」）が作成した問題集を購入することができます。すべての購入に以下の条件が適用されます："
            )}
          </Text>
          <BulletItem
            text={t(
              "All prices are displayed in Japanese Yen (JPY) and include consumption tax",
              "価格は日本円（税込）で表示されます"
            )}
          />
          <BulletItem
            text={t(
              "Payment is processed via Stripe at the time of purchase",
              "決済はStripe経由で購入時に処理されます"
            )}
          />
          <BulletItem
            text={t(
              "Purchased content is available immediately after payment",
              "購入完了後、即時にコンテンツをご利用いただけます"
            )}
          />
          <Text style={[styles.body, { marginTop: 8 }]}>
            {t(
              "Refund Policy: Due to the nature of digital content, refunds are generally not available after purchase. Exceptions apply in the following cases:",
              "返金ポリシー：デジタルコンテンツの性質上、購入完了後の返金は原則として行いません。以下の場合は例外として対応いたします："
            )}
          </Text>
          <BulletItem
            text={t(
              "The purchased content has a critical defect (e.g., cannot be displayed)",
              "購入した問題集に重大な欠陥（表示不能等）がある場合"
            )}
          />
          <BulletItem
            text={t(
              "An erroneous charge has occurred",
              "誤課金が発生した場合"
            )}
          />
          <Text style={[styles.body, styles.note]}>
            {t(
              "For refund requests, please contact support@ai-practice-book.com within 7 days of purchase.",
              "返金のご要望は購入から7日以内にsupport@ai-practice-book.comまでご連絡ください。"
            )}
          </Text>
        </Section>

        <Section title={t("5. Intellectual Property", "第5条（著作権・知的財産権）")}>
          <Text style={styles.body}>
            {t(
              "The Service and its original content (excluding user-generated content) are the exclusive property of the developer and are protected by copyright and other intellectual property laws.",
              "本サービスおよびその独自コンテンツ（ユーザー生成コンテンツを除く）は当社の財産であり、著作権およびその他の知的財産法により保護されています。"
            )}
          </Text>
          <Text style={styles.body}>
            {t(
              "Users retain ownership of the content they create. By posting content to the Service, you grant us a non-exclusive, worldwide, royalty-free license to display and distribute that content solely for the purpose of operating the Service.",
              "ユーザーは自身が作成したコンテンツの所有権を保持します。コンテンツを本サービスに投稿することで、本サービスの運営目的のみに限り、コンテンツを表示・配信するための非独占的・全世界的・無償のライセンスを当社に付与するものとします。"
            )}
          </Text>
          <Text style={[styles.body, { marginTop: 10 }]}>
            {t(
              "You additionally agree to the following regarding user-posted question sets and similar content:",
              "問題集などユーザー投稿コンテンツについて、以下の点にあわせて同意するものとします。"
            )}
          </Text>
          <BulletItem
            text={t(
              "Copyright in content you post remains with you as the poster.",
              "投稿コンテンツの著作権は、投稿者であるあなたに帰属します。"
            )}
          />
          <BulletItem
            text={t(
              "You must not post content that infringes third-party copyrights, including wholesale copying of commercial question books, full past-exam reproductions, or unauthorized excerpts from paid courses.",
              "市販の問題集の丸写し、過去問の全文転載、有料教材からの無断の大量複製など、第三者の著作権を侵害するコンテンツを投稿してはなりません。"
            )}
          />
          <BulletItem
            text={t(
              "We may remove violating content or suspend accounts without prior notice where appropriate.",
              "違反が判明した場合、事前の通知なく当該コンテンツを削除したり、アカウントを停止することがあります。"
            )}
          />
        </Section>

        <Section title={t("6. Disclaimer of Warranties", "第6条（免責事項）")}>
          <Text style={styles.body}>
            {t(
              "The Service is provided \"as is\" without warranties of any kind. We do not guarantee that:",
              "本サービスは「現状のまま」提供されます。当社は以下について保証しません："
            )}
          </Text>
          <BulletItem
            text={t(
              "The Service will be uninterrupted or error-free",
              "本サービスが中断なく、またはエラーなく稼働すること"
            )}
          />
          <BulletItem
            text={t(
              "The accuracy or completeness of any content on the Service",
              "本サービス上のコンテンツの正確性・完全性"
            )}
          />
          <BulletItem
            text={t(
              "User-generated content (question sets) is accurate, complete, or appropriate",
              "ユーザー生成コンテンツ（問題集）の正確性・完全性・適切性"
            )}
          />
          <Text style={[styles.body, { marginTop: 8 }]}>
            {t(
              "We shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.",
              "当社は、本サービスの利用に起因する間接的・付随的・結果的損害について責任を負いません。"
            )}
          </Text>
        </Section>

        <Section title={t("7. Service Modifications and Termination", "第7条（サービスの変更・停止）")}>
          <Text style={styles.body}>
            {t(
              "We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuation of the Service.",
              "当社は、いつでも予告なく本サービスの内容を変更・一時停止・終了する権利を有します。これにより生じた損害について、当社は責任を負いません。"
            )}
          </Text>
        </Section>

        <Section title={t("8. Changes to Terms", "第8条（規約の変更）")}>
          <Text style={styles.body}>
            {t(
              "We may revise these Terms at any time. By continuing to use the Service after changes become effective, you agree to the revised Terms. We will notify you of significant changes via in-app notification.",
              "当社は、必要に応じて本規約を変更する場合があります。変更後も本サービスを利用し続けた場合、変更後の規約に同意したものとみなします。重要な変更の場合はアプリ内通知でお知らせします。"
            )}
          </Text>
        </Section>

        <Section title={t("9. Governing Law and Jurisdiction", "第9条（準拠法・管轄裁判所）")}>
          <Text style={styles.body}>
            {t(
              "These Terms are governed by the laws of Japan. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the Tokyo District Court as the court of first instance.",
              "本規約は日本法に準拠します。本規約に関して紛争が生じた場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。"
            )}
          </Text>
        </Section>

        <Section title={t("10. Contact", "第10条（お問い合わせ）")}>
          <Text style={styles.body}>
            {t(
              "If you have any questions about these Terms, please contact us:",
              "本規約に関するご質問は、以下までお問い合わせください："
            )}
          </Text>
          <Text style={[styles.body, styles.contactInfo]}>
            {t("Service Name: AI Practice Book", "サービス名：AI Practice Book")}
            {"\n"}
            {t("Email: support@ai-practice-book.com", "メール：support@ai-practice-book.com")}
          </Text>
        </Section>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backText: {
    color: "#4A90E2",
    fontSize: 15,
  },
  headerTitle: {
    fontWeight: "700",
    color: "#1a1a2e",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 13,
    color: "#888",
    marginBottom: 24,
    fontStyle: "italic",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  body: {
    fontSize: 14,
    color: "#444",
    lineHeight: 22,
    marginBottom: 8,
  },
  note: {
    marginTop: 8,
    color: "#666",
    fontStyle: "italic",
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 14,
    color: "#4A90E2",
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: "#444",
    lineHeight: 22,
  },
  contactInfo: {
    backgroundColor: "#f0f4ff",
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#4A90E2",
  },
  footer: {
    height: 40,
  },
});
