import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { collectReportData } from '../../src/data/normalize';
import { analyzeReport } from '../../src/llm/analyze';
import { createAnthropicClient } from '../../src/llm/client';
import { insertReport, listReports, type ReportRow } from '../../src/store/db';
import { getAnthropicKey } from '../../src/store/secrets';
import { loadSettings, saveSettings, type AppSettings } from '../../src/store/settings';
import type { AssetClass } from '../../src/data/types';

const ALL_CLASSES: { key: AssetClass; label: string }[] = [
  { key: 'crypto', label: '크립토' },
  { key: 'us', label: '미주' },
  { key: 'kr', label: '한주' },
];

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [recent, setRecent] = useState<ReportRow[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([loadSettings(), listReports(5)]).then(([s, r]) => {
        if (!active) return;
        setSettings(s);
        setRecent(r);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    if (!settings) void loadSettings().then(setSettings);
  }, [settings]);

  async function toggleClass(c: AssetClass) {
    if (!settings) return;
    const has = settings.enabledClasses.includes(c);
    const next: AppSettings = {
      ...settings,
      enabledClasses: has
        ? settings.enabledClasses.filter((x) => x !== c)
        : [...settings.enabledClasses, c],
    };
    setSettings(next);
    await saveSettings(next);
  }

  async function generate() {
    if (!settings) return;
    if (settings.enabledClasses.length === 0) {
      Alert.alert('자산군을 1개 이상 선택해주세요.');
      return;
    }
    const apiKey = await getAnthropicKey();
    if (!apiKey) {
      Alert.alert('API 키가 필요해요', '설정 탭에서 Anthropic API 키를 먼저 등록해주세요.');
      return;
    }
    setBusy(true);
    try {
      setStep('데이터 수집 중...');
      const data = await collectReportData({
        classes: settings.enabledClasses,
        onProgress: setStep,
      });
      setStep('AI 분석 중...');
      const client = createAnthropicClient({ apiKey });
      const report = await analyzeReport(data, {
        client,
        modelId: settings.modelId,
        toneStrength: settings.toneStrength,
      });
      setStep('저장 중...');
      const id = await insertReport(report);
      setStep('');
      router.push(`/report/${id}`);
    } catch (e) {
      Alert.alert('실패', (e as Error).message);
    } finally {
      setBusy(false);
      setStep('');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Text style={styles.title}>오늘의 시장 리포트</Text>
      <Text style={styles.subtitle}>버튼 한 번이면 비유로 풀어드려요.</Text>

      <View style={styles.toggleRow}>
        {ALL_CLASSES.map(({ key, label }) => {
          const on = settings?.enabledClasses.includes(key) ?? false;
          return (
            <Pressable
              key={key}
              onPress={() => toggleClass(key)}
              style={[styles.toggle, on && styles.toggleOn]}
            >
              <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={generate}
        style={[styles.bigBtn, busy && { opacity: 0.6 }]}
        disabled={busy}
      >
        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.bigBtnText, { marginLeft: 12 }]}>{step || '생성 중...'}</Text>
          </View>
        ) : (
          <Text style={styles.bigBtnText}>오늘 리포트 생성</Text>
        )}
      </Pressable>

      <Text style={styles.sectionTitle}>최근 리포트</Text>
      {recent.length === 0 ? (
        <Text style={styles.empty}>아직 없어요. 위 버튼을 눌러보세요.</Text>
      ) : (
        recent.map((r) => (
          <Pressable key={r.id} style={styles.recentCard} onPress={() => router.push(`/report/${r.id}`)}>
            <Text style={styles.recentDate}>{new Date(r.generatedAt).toLocaleString('ko-KR')}</Text>
            <Text style={styles.recentLine} numberOfLines={2}>{r.oneLiner}</Text>
            {r.costUsd != null && (
              <Text style={styles.recentMeta}>${r.costUsd.toFixed(4)} · {r.modelId}</Text>
            )}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggle: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e5e7eb' },
  toggleOn: { backgroundColor: '#2563eb' },
  toggleText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  toggleTextOn: { color: '#fff' },
  bigBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 8 },
  empty: { fontSize: 13, color: '#9ca3af', paddingVertical: 12 },
  recentCard: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8 },
  recentDate: { fontSize: 11, color: '#9ca3af' },
  recentLine: { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 4 },
  recentMeta: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});
