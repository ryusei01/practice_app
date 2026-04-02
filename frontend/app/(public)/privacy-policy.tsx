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

export default function PrivacyPolicyScreen() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  return (
    <View style={styles.container}>
      <View style={[styles.header]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t("← Back", "← 戻る")}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: isSmallScreen ? 18 : 22 }]}>
          {t("Privacy Policy", "プライバシーポリシー")}
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
          {t("Last updated: April 2025", "最終更新日：2025年4月")}
        </Text>

        <Section title={t("1. Introduction", "1. はじめに")}>
          <Text style={styles.body}>
            {t(
              "AI Practice Book (hereinafter \"the Service\") is operated by its developer (hereinafter \"we\" or \"us\"). We respect your privacy and are committed to protecting your personal information in accordance with Japan's Act on the Protection of Personal Information (個人情報保護法).",
              "AI Practice Book（以下「本サービス」）は、開発者（以下「当社」）が運営しています。当社は、個人情報保護法に基づき、お客様の個人情報を適切に取り扱うことをお約束します。"
            )}
          </Text>
        </Section>

        <Section title={t("2. Information We Collect", "2. 取得する情報")}>
          <Text style={styles.body}>
            {t(
              "When you sign in with Google OAuth, we receive and store the following information from your Google account:",
              "Googleアカウントでログインする際、Googleから以下の情報を取得・保存します："
            )}
          </Text>
          <BulletItem text={t("Email address", "メールアドレス")} />
          <BulletItem text={t("Display name", "表示名（お名前）")} />
          <BulletItem
            text={t(
              "Google Account ID (sub) — used as a unique identifier",
              "GoogleアカウントID（sub）— 本人確認のための識別子として使用"
            )}
          />
          <Text style={[styles.body, styles.note]}>
            {t(
              "We do not collect passwords. Authentication is handled entirely by Google.",
              "パスワードは収集しません。認証はGoogleが全て担います。"
            )}
          </Text>
        </Section>

        <Section title={t("3. Purpose of Use", "3. 利用目的")}>
          <Text style={styles.body}>
            {t(
              "The information collected is used solely for the following purposes:",
              "取得した情報は、以下の目的のみに使用します："
            )}
          </Text>
          <BulletItem text={t("Providing and maintaining the Service", "本サービスの提供・維持")} />
          <BulletItem text={t("User authentication and account management", "ユーザー認証およびアカウント管理")} />
          <BulletItem text={t("Displaying your name within the Service", "サービス内での表示名として使用")} />
          <BulletItem text={t("Responding to inquiries", "お問い合わせへの対応")} />
          <BulletItem text={t("Improving the Service", "サービスの改善")} />
        </Section>

        <Section title={t("4. Third-Party Disclosure", "4. 第三者への提供")}>
          <Text style={styles.body}>
            {t(
              "We do not sell, trade, or otherwise transfer your personal information to third parties, except in the following cases:",
              "以下の場合を除き、お客様の個人情報を第三者に販売・提供・開示しません："
            )}
          </Text>
          <BulletItem
            text={t(
              "When required by law or government authority",
              "法令または政府機関の要求がある場合"
            )}
          />
          <BulletItem
            text={t(
              "With your explicit consent",
              "お客様の明示的な同意がある場合"
            )}
          />
          <Text style={[styles.body, styles.note]}>
            {t(
              "Note: We use Google OAuth for authentication. Google's privacy policy applies to the authentication process. Please review Google's Privacy Policy at https://policies.google.com/privacy",
              "注：認証にGoogle OAuthを使用しています。認証処理にはGoogleのプライバシーポリシーが適用されます。詳細は https://policies.google.com/privacy をご確認ください。"
            )}
          </Text>
        </Section>

        <Section title={t("5. Data Retention", "5. 保存期間")}>
          <Text style={styles.body}>
            {t(
              "Your personal information is retained for as long as your account remains active. If you request account deletion, your personal information will be deleted within 30 days.",
              "お客様の個人情報は、アカウントが有効である間、保存されます。アカウント削除を申請した場合、30日以内に個人情報を削除します。"
            )}
          </Text>
        </Section>

        <Section title={t("6. Data Security", "6. データの安全管理")}>
          <Text style={styles.body}>
            {t(
              "We implement appropriate technical and organizational measures to protect your personal information, including:",
              "個人情報の保護のため、以下の技術的・組織的対策を講じています："
            )}
          </Text>
          <BulletItem text={t("HTTPS encryption for all communications", "全通信のHTTPS暗号化")} />
          <BulletItem text={t("JWT-based authentication with short-lived tokens", "有効期限付きJWTによる認証")} />
          <BulletItem
            text={t(
              "Secure hashing of session tokens stored in the database",
              "データベースに保存するセッショントークンのハッシュ化"
            )}
          />
        </Section>

        <Section title={t("7. Your Rights", "7. お客様の権利")}>
          <Text style={styles.body}>
            {t(
              "Under Japan's Act on the Protection of Personal Information, you have the right to:",
              "個人情報保護法に基づき、お客様は以下の権利を有します："
            )}
          </Text>
          <BulletItem text={t("Access your personal information", "保有個人情報の開示を求める権利")} />
          <BulletItem text={t("Request correction of inaccurate information", "不正確な情報の訂正を求める権利")} />
          <BulletItem text={t("Request deletion of your account and data", "アカウントおよびデータの削除を求める権利")} />
          <Text style={styles.body}>
            {t(
              "To exercise these rights, please contact us at the email address below.",
              "これらの権利を行使するには、以下のメールアドレスまでご連絡ください。"
            )}
          </Text>
        </Section>

        <Section title={t("8. Cookies and Analytics", "8. Cookie・解析ツール")}>
          <Text style={styles.body}>
            {t(
              "We use Google Analytics (Google Tag Manager) to analyze usage of the Service. This may involve the use of cookies. You can opt out of Google Analytics by installing the Google Analytics Opt-out Browser Add-on.",
              "本サービスでは、利用状況の分析のためにGoogle Analytics（Googleタグマネージャー）を使用しています。これにはCookieの使用が含まれる場合があります。Google Analytics オプトアウトアドオンを利用することで、データ収集を拒否できます。"
            )}
          </Text>
        </Section>

        <Section title={t("9. Changes to This Policy", "9. プライバシーポリシーの変更")}>
          <Text style={styles.body}>
            {t(
              "We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the \"Last updated\" date at the top of this page.",
              "本プライバシーポリシーは予告なく変更する場合があります。重要な変更がある場合は、ページ上部の「最終更新日」を更新してお知らせします。"
            )}
          </Text>
        </Section>

        <Section title={t("10. Contact", "10. お問い合わせ")}>
          <Text style={styles.body}>
            {t(
              "If you have any questions or requests regarding this Privacy Policy or the handling of your personal information, please contact us:",
              "本プライバシーポリシーまたは個人情報の取り扱いに関するご質問・ご要望は、以下までお問い合わせください："
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
