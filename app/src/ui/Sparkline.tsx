import React from 'react';
import Svg, { Polyline } from 'react-native-svg';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

export function Sparkline({ data, width = 120, height = 36, stroke = '#2563eb' }: SparklineProps) {
  if (!data || data.length < 2) return <Svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`).join(' ');
  const trend = data[data.length - 1] >= data[0] ? '#16a34a' : '#dc2626';
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={stroke === '#2563eb' ? trend : stroke} strokeWidth={1.6} />
    </Svg>
  );
}
