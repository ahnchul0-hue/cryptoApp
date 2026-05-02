import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { listReports, type ReportRow } from '../../src/store/db';

export default function History() {
  const router = useRouter();
  const [items, setItems] = useState<ReportRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listReports(50).then((rs) => {
        if (active) setItems(rs);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={items}
      keyExtractor={(r) => r.id}
      ListEmptyComponent={<Text style={styles.empty}>아직 저장된 리포트가 없어요.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/report/${item.id}`)}>
          <Text style={styles.date}>{new Date(item.generatedAt).toLocaleString('ko-KR')}</Text>
          <Text style={styles.line} numberOfLines={2}>{item.oneLiner}</Text>
          {item.costUsd != null && (
            <Text style={styles.meta}>${item.costUsd.toFixed(4)} · {item.modelId}</Text>
          )}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 60 },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8 },
  date: { fontSize: 11, color: '#9ca3af' },
  line: { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 4 },
  meta: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});
