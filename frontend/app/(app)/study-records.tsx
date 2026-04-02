import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useLanguage } from "../../src/contexts/LanguageContext";
import { studyRecordService, StudyAggregate, StudyRecord } from "../../src/services/studyRecordService";
import AdBanner from "../../src/components/AdBanner";

function formatDurationSec(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r}s`;
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function StatCard(props: {
  title: string;
  agg: StudyAggregate;
  width: number;
}) {
  const { title, agg, width } = props;
  const isSmall = width < 600;

  return (
    <View style={[styles.card, { padding: isSmall ? 14 : 16 }]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>解いた</Text>
        <Text style={styles.value}>{agg.count}問</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>正解</Text>
        <Text style={styles.value}>{agg.correct}問</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>正解率</Text>
        <Text style={styles.value}>{formatPercent(agg.correct, agg.count)}</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>時間</Text>
        <Text style={styles.value}>{formatDurationSec(agg.studyTime)}</Text>
      </View>
    </View>
  );
}

export default function StudyRecordsScreen() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [today, setToday] = useState<StudyAggregate>({ count: 0, correct: 0, studyTime: 0 });
  const [week, setWeek] = useState<StudyAggregate>({ count: 0, correct: 0, studyTime: 0 });
  const [month, setMonth] = useState<StudyAggregate>({ count: 0, correct: 0, studyTime: 0 });
  const [recent, setRecent] = useState<StudyRecord[]>([]);

  const load = useCallback(async () => {
    const now = new Date();
    const [tAgg, wAgg, mAgg, recent30] = await Promise.all([
      studyRecordService.getTodayAggregate(now),
      studyRecordService.getWeekAggregate(now),
      studyRecordService.getMonthAggregate(now),
      studyRecordService.getRecentDailyRecords(30, now),
    ]);
    setToday(tAgg);
    setWeek(wAgg);
    setMonth(mAgg);
    setRecent(recent30);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    (async () => {
      try {
        await load();
      } finally {
        setIsRefreshing(false);
      }
    })();
  }, [load]);

  const recentRows = useMemo(() => {
    // newest first
    return [...recent].reverse();
  }, [recent]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{t("Loading...", "読み込み中...")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t("Study Records", "学習記録")}</Text>

        <View style={styles.cards}>
          <StatCard title={t("Today", "今日")} agg={today} width={width} />
          <StatCard title={t("This Week (last 7 days)", "今週（直近7日）")} agg={week} width={width} />
          <StatCard title={t("This Month", "今月")} agg={month} width={width} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("Last 30 days", "過去30日")}</Text>
          {recentRows.every((r) => r.count === 0) ? (
            <Text style={styles.emptyText}>
              {t("No records yet. Solve a quiz to start tracking!", "まだ記録がありません。クイズを解くと自動で記録されます。")}
            </Text>
          ) : (
            <View style={styles.list}>
              {recentRows.map((r) => (
                <View key={r.date} style={styles.listRow}>
                  <Text style={styles.listDate}>{r.date}</Text>
                  <Text style={styles.listRight}>
                    {r.count}問 / {formatPercent(r.correct, r.count)} / {formatDurationSec(r.studyTime)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <AdBanner />
      </View>
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
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  cards: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  label: {
    fontSize: 14,
    color: "#666",
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  list: {
    gap: 10,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listDate: {
    fontSize: 13,
    color: "#555",
    fontWeight: "600",
  },
  listRight: {
    fontSize: 13,
    color: "#333",
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    color: "#666",
  },
});

