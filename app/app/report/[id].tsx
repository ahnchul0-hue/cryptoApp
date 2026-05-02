import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getReport } from '../../src/store/db';
import type { FinalReport } from '../../src/llm/types';
import { CategoryCard } from '../../src/ui/CategoryCard';

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<FinalReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void getReport(id).then((r) => {
      if (active) {
        setReport(r);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!report) {
    return (
      <View style={styles.center}>
        <Text>리포트를 찾을 수 없어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={styles.header}>
        <Text style={styles.date}>{new Date(report.generatedAt).toLocaleString('ko-KR')}</Text>
        <Text style={styles.oneLiner}>{report.oneLiner}</Text>
      </View>

      {report.categories.map((c) => (
        <CategoryCard key={c.category} data={c} />
      ))}

      {report.news.length > 0 && (
        <View style={styles.newsBox}>
          <Text style={styles.newsTitle}>📰 오늘의 뉴스 헤드라인</Text>
          {report.news.slice(0, 6).map((n, i) => (
            <View key={i} style={styles.newsItem}>
              <Text style={styles.newsText} numberOfLines={2}>{n.title}</Text>
              <Text style={styles.newsSource}>{n.source}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.conclusion}>
        <Text style={styles.conclusionTitle}>오늘의 결론</Text>
        <Text style={styles.conclusionLine}>{report.conclusion.oneLiner}</Text>
        <Text style={styles.investHeader}>👍 사볼만한 것</Text>
        {report.conclusion.fitForUser.invest.map((s, i) => (
          <Text key={i} style={styles.bullet}>• {s}</Text>
        ))}
        <Text style={styles.avoidHeader}>⚠️ 피할 것</Text>
        {report.conclusion.fitForUser.avoid.map((s, i) => (
          <Text key={i} style={styles.bullet}>• {s}</Text>
        ))}
        <Text style={styles.rationale}>{report.conclusion.rationale}</Text>
        <Text style={styles.usage}>
          tokens in/out: {report.usage.inputTokens}/{report.usage.outputTokens}
          {report.usage.cacheReadInputTokens > 0 ? ` (cache hit ${report.usage.cacheReadInputTokens})` : ''}
          {' · '}≈ ${report.usage.estimatedUsd.toFixed(4)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingVertical: 8, paddingHorizontal: 4, marginBottom: 12 },
  date: { fontSize: 11, color: '#9ca3af' },
  oneLiner: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 6, lineHeight: 28 },
  newsBox: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12 },
  newsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#111827' },
  newsItem: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  newsText: { fontSize: 13, color: '#1f2937' },
  newsSource: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  conclusion: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  conclusionTitle: { color: '#f9fafb', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  conclusionLine: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, lineHeight: 24 },
  investHeader: { color: '#86efac', fontSize: 13, fontWeight: '700', marginTop: 8 },
  avoidHeader: { color: '#fca5a5', fontSize: 13, fontWeight: '700', marginTop: 12 },
  bullet: { color: '#e5e7eb', fontSize: 13, marginTop: 4, lineHeight: 18 },
  rationale: { color: '#d1d5db', fontSize: 13, marginTop: 14, lineHeight: 20 },
  usage: { color: '#6b7280', fontSize: 11, marginTop: 14 },
});
