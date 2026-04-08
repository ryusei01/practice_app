import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import axios from "axios";

import { useLanguage } from "../../src/contexts/LanguageContext";
import aiService, { LearningPlanResponse } from "../../src/services/aiService";
import { studyRecordService, StudyAggregate } from "../../src/services/studyRecordService";
import AdBanner from "../../src/components/AdBanner";

function buildShareText(
  plan: LearningPlanResponse,
  today: StudyAggregate,
  week: StudyAggregate,
  month: StudyAggregate,
  language: "en" | "ja"
): string {
  const n = plan.weeks?.length ?? 0;
  const header =
    language === "ja"
      ? `📚 AIが作った学習プラン（${n}週間）`
      : `📚 AI study plan (${n} weeks)`;
  const goalLine = language === "ja" ? `目標: ${plan.goal}` : `Goal: ${plan.goal}`;
  const statsLine =
    language === "ja"
      ? `今日解いた: ${today.count}問 / 今週: ${week.count}問 / 今月: ${month.count}問`
      : `Today: ${today.count} Q / This week: ${week.count} Q / This month: ${month.count} Q`;
  const sep = "---";
  const slice = (plan.weeks ?? []).slice(0, 2);
  const weekLines = slice.map((w) =>
    language === "ja"
      ? `第${w.week}週: ${w.theme}（${w.milestone}）`
      : `Week ${w.week}: ${w.theme} (${w.milestone})`
  );
  const more =
    n > 2
      ? language === "ja"
        ? "…（以降はアプリ内のプランを参照）"
        : "… (see full plan in the app)"
      : "";
  const tags = language === "ja" ? "#AI練習帳 #学習記録" : "#AIQuiz #StudyLog";
  return [header, goalLine, statsLine, sep, ...weekLines, more, tags].filter(Boolean).join("\n");
}

function parseApiDetail(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { detail?: unknown } | undefined;
    const detail = d?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x)))
        .join("\n");
    }
  }
  return "";
}

export default function LearningPlanScreen() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [goal, setGoal] = useState("");
  const [weeksStr, setWeeksStr] = useState("4");
  const [hoursStr, setHoursStr] = useState("1");
  const [weakStr, setWeakStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<LearningPlanResponse | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const [todayAgg, setTodayAgg] = useState<StudyAggregate>({ count: 0, correct: 0, studyTime: 0 });
  const [weekAgg, setWeekAgg] = useState<StudyAggregate>({ count: 0, correct: 0, studyTime: 0 });
  const [monthAgg, setMonthAgg] = useState<StudyAggregate>({ count: 0, correct: 0, studyTime: 0 });

  const loadStats = useCallback(async () => {
    const now = new Date();
    const [a, b, c] = await Promise.all([
      studyRecordService.getTodayAggregate(now),
      studyRecordService.getWeekAggregate(now),
      studyRecordService.getMonthAggregate(now),
    ]);
    setTodayAgg(a);
    setWeekAgg(b);
    setMonthAgg(c);
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const shareText = useMemo(() => {
    if (!plan) return "";
    return buildShareText(plan, todayAgg, weekAgg, monthAgg, language === "ja" ? "ja" : "en");
  }, [plan, todayAgg, weekAgg, monthAgg, language]);

  const toggleWeek = (weekNum: number) => {
    setExpanded((prev) => ({ ...prev, [weekNum]: !prev[weekNum] }));
  };

  const openUrl = async (url: string) => {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  };

  const shareNativeFileOrSheet = async (text: string) => {
    if (Platform.OS === "web") return;
    try {
      const file = new File(Paths.cache, `learning-plan-share-${Date.now()}.txt`);
      if (!file.exists) {
        file.create({ intermediates: true, overwrite: true });
      }
      file.write(text, { encoding: "utf8" });
      const ok = await Sharing.isAvailableAsync();
      if (ok) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/plain",
          UTI: "public.plain-text",
          dialogTitle: t("Share", "共有"),
        });
      } else {
        await Share.share({ message: text });
      }
    } catch (e) {
      console.error(e);
      await Share.share({ message: text });
    }
  };

  const onShareSystem = async () => {
    if (!shareText) return;
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? navigator : undefined;
      if (nav?.share) {
        try {
          await nav.share({ text: shareText });
          return;
        } catch {
          // user cancelled or unsupported
        }
      }
      Alert.alert(t("Share", "共有"), t("Copy links below or use Twitter / LINE / Facebook buttons.", "下のSNSボタンを使うか、テキストをコピーしてください。"));
      return;
    }
    await shareNativeFileOrSheet(shareText);
  };

  const onGenerate = async () => {
    setError(null);
    const w = parseInt(weeksStr, 10);
    const h = parseFloat(hoursStr);
    if (!goal.trim()) {
      setError(t("Please enter a goal.", "目標を入力してください。"));
      return;
    }
    if (!Number.isFinite(w) || w < 1 || w > 24) {
      setError(t("Weeks must be between 1 and 24.", "週数は1〜24で入力してください。"));
      return;
    }
    if (!Number.isFinite(h) || h < 0.25 || h > 24) {
      setError(t("Daily hours must be between 0.25 and 24.", "1日の学習時間は0.25〜24時間で入力してください。"));
      return;
    }
    const weak_categories = weakStr
      .split(/[,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      const data = await aiService.generateLearningPlan({
        goal: goal.trim(),
        weeks: w,
        daily_hours: h,
        weak_categories,
      });
      setPlan(data);
      setExpanded({});
      await loadStats();
    } catch (e) {
      const detail = parseApiDetail(e);
      setError(detail || t("Failed to generate plan.", "プランの生成に失敗しました。"));
    } finally {
      setLoading(false);
    }
  };

  const encoded = encodeURIComponent(shareText);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(app)/dashboard"))}
        style={styles.backBtn}
      >
        <Text style={styles.backText}>← {t("Back", "戻る")}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t("AI Learning Plan", "AI学習プラン")}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{t("Goal", "目標")}</Text>
        <TextInput
          style={styles.input}
          value={goal}
          onChangeText={setGoal}
          placeholder={t("e.g. Pass the final exam", "例: 期末テストで80点以上")}
          placeholderTextColor="#999"
          multiline
        />
        <Text style={styles.label}>{t("Weeks", "週数")}</Text>
        <TextInput
          style={styles.inputSingle}
          value={weeksStr}
          onChangeText={setWeeksStr}
          keyboardType="number-pad"
        />
        <Text style={styles.label}>{t("Daily study hours (approx.)", "1日の学習時間（目安・時間）")}</Text>
        <TextInput
          style={styles.inputSingle}
          value={hoursStr}
          onChangeText={setHoursStr}
          keyboardType="decimal-pad"
        />
        <Text style={styles.label}>{t("Weak areas (optional, comma-separated)", "苦手分野（任意・カンマ区切り）")}</Text>
        <TextInput
          style={styles.input}
          value={weakStr}
          onChangeText={setWeakStr}
          placeholder={t("e.g. reading, listening", "例: 読解, リスニング")}
          placeholderTextColor="#999"
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={onGenerate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{t("Generate plan", "プランを生成")}</Text>
          )}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {plan?.fallback ? (
          <Text style={styles.fallbackNote}>
            {t("Used a built-in template because the model output could not be parsed.", "モデル出力を解析できなかったため、テンプレートで表示しています。")}
          </Text>
        ) : null}
      </View>

      {plan ? (
        <>
          <View style={styles.card}>
            <Text style={styles.planGoal}>
              {t("Plan goal", "プランの目標")}: {plan.goal}
            </Text>
            {(plan.weeks ?? []).map((wk) => (
              <View key={wk.week} style={styles.weekBlock}>
                <TouchableOpacity style={styles.weekHeader} onPress={() => toggleWeek(wk.week)}>
                  <Text style={styles.weekTitle}>
                    {language === "ja"
                      ? `第${wk.week}週: ${wk.theme}`
                      : `Week ${wk.week}: ${wk.theme}`}
                  </Text>
                  <Text style={styles.chevron}>{expanded[wk.week] ? "▼" : "▶"}</Text>
                </TouchableOpacity>
                {expanded[wk.week] ? (
                  <View style={styles.weekBody}>
                    <Text style={styles.milestone}>{wk.milestone}</Text>
                    {(wk.days ?? []).map((d) => (
                      <View key={`${wk.week}-${d.day}`} style={styles.dayBlock}>
                        <Text style={styles.dayTitle}>
                          {language === "ja" ? `${d.day}日目` : `Day ${d.day}`}
                        </Text>
                        {(d.tasks ?? []).map((task, idx) => (
                          <Text key={idx} style={styles.taskItem}>
                            • {task}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.shareTitle}>{t("Share", "共有")}</Text>
            <Text style={styles.sharePreview} selectable>
              {shareText}
            </Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onShareSystem}>
              <Text style={styles.secondaryBtnText}>{t("Share (system)", "共有（シート）")}</Text>
            </TouchableOpacity>
            <View style={styles.snsRow}>
              <TouchableOpacity
                style={styles.snsBtn}
                onPress={() => openUrl(`https://twitter.com/intent/tweet?text=${encoded}`)}
              >
                <Text style={styles.snsBtnText}>X / Twitter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.snsBtn}
                onPress={() => openUrl(`https://line.me/R/msg/text/?${encoded}`)}
              >
                <Text style={styles.snsBtnText}>LINE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.snsBtn}
                onPress={() =>
                  openUrl(`https://www.facebook.com/sharer/sharer.php?quote=${encoded}`)
                }
              >
                <Text style={styles.snsBtnText}>Facebook</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : null}

      <AdBanner />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    minHeight: 44,
    textAlignVertical: "top",
  },
  inputSingle: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  primaryBtn: {
    backgroundColor: "#8E44AD",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: "#C62828",
    marginTop: 12,
    fontSize: 14,
  },
  fallbackNote: {
    marginTop: 10,
    color: "#666",
    fontSize: 13,
  },
  planGoal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  weekBlock: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  weekTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
    paddingRight: 8,
  },
  chevron: {
    fontSize: 14,
    color: "#666",
  },
  weekBody: {
    paddingBottom: 8,
  },
  milestone: {
    fontSize: 14,
    color: "#555",
    marginBottom: 10,
  },
  dayBlock: {
    marginBottom: 10,
    paddingLeft: 4,
  },
  dayTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#007AFF",
    marginBottom: 4,
  },
  taskItem: {
    fontSize: 14,
    color: "#333",
    marginLeft: 4,
    lineHeight: 20,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#333",
  },
  sharePreview: {
    fontSize: 12,
    color: "#555",
    backgroundColor: "#f8f8f8",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    lineHeight: 18,
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: "#8E44AD",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryBtnText: {
    color: "#8E44AD",
    fontWeight: "700",
    fontSize: 15,
  },
  snsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  snsBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  snsBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
