import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CategoryAnalysis } from '../llm/types';

const LABEL: Record<CategoryAnalysis['category'], string> = {
  crypto: '암호화폐',
  us: '미국 주식',
  kr: '한국 주식 / ETF',
  macro: '거시 · 뉴스',
};

export function CategoryCard({ data }: { data: CategoryAnalysis }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{LABEL[data.category]}</Text>
      <Text style={styles.headline}>{data.headline}</Text>
      <Text style={styles.metaphor}>💡 {data.metaphor}</Text>
      {data.evidence.length > 0 && (
        <View style={styles.evidenceBox}>
          {data.evidence.map((e, i) => (
            <View key={i} style={styles.evidenceRow}>
              <Text style={styles.evidenceLabel}>{e.label}</Text>
              <Text style={styles.evidenceValue}>{e.value}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.kid}>{data.kidExplain}</Text>
      {data.actions.length > 0 && (
        <View style={styles.actionsBox}>
          {data.actions.map((a, i) => (
            <Text key={i} style={styles.action}>• {a}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: '600' },
  headline: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  metaphor: { fontSize: 14, color: '#374151', marginBottom: 10, fontStyle: 'italic' },
  evidenceBox: { backgroundColor: '#f3f4f6', borderRadius: 10, padding: 10, marginBottom: 10 },
  evidenceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  evidenceLabel: { fontSize: 13, color: '#4b5563' },
  evidenceValue: { fontSize: 13, color: '#111827', fontWeight: '600' },
  kid: { fontSize: 14, color: '#1f2937', lineHeight: 20, marginBottom: 8 },
  actionsBox: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 },
  action: { fontSize: 13, color: '#2563eb', paddingVertical: 2 },
});
