import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkline } from './Sparkline';
import type { QuotePoint } from '../data/types';

export function QuoteRow({ q }: { q: QuotePoint }) {
  const up = q.pctChangeDay >= 0;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{q.name}</Text>
        <Text style={styles.symbol}>{q.symbol}</Text>
      </View>
      <Sparkline data={q.spark ?? []} width={70} height={24} />
      <View style={{ alignItems: 'flex-end', marginLeft: 10, minWidth: 90 }}>
        <Text style={styles.price}>{formatPrice(q.priceClose)}</Text>
        <Text style={[styles.pct, { color: up ? '#16a34a' : '#dc2626' }]}>
          {up ? '+' : ''}{q.pctChangeDay.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

function formatPrice(p: number): string {
  if (p >= 1_000_000) return p.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return p.toFixed(4);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
  symbol: { fontSize: 11, color: '#9ca3af' },
  price: { fontSize: 14, fontWeight: '600', color: '#111827' },
  pct: { fontSize: 12, fontWeight: '600' },
});
