import { useId, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type Point = {
  label: string;
  value: number;
};

type LineTrendChartProps = {
  points: Point[];
  color?: string;
  title: string;
  subtitle: string;
  formatValue?: (value: number) => string;
  compact?: boolean;
  latestLabel?: string;
};

export function LineTrendChart({
  points,
  color = '#1d5f55',
  title,
  subtitle,
  formatValue = (value) => `${value}`,
  compact = false,
  latestLabel = '最新值',
}: LineTrendChartProps) {
  const [width, setWidth] = useState(320);
  const height = compact ? 104 : 144;
  const horizontalPadding = 4;
  const drawableWidth = Math.max(width - horizontalPadding * 2, 1);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const range = Math.max(maxValue - minValue, 1);
  const gradientId = `trendFill-${useId().replace(/:/g, '')}`;

  const line = points
    .map((point, index) => {
      const x = horizontalPadding + (index / Math.max(points.length - 1, 1)) * drawableWidth;
      const y = height - ((point.value - minValue) / range) * (height - 18) - 12;

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const area = `${line} L ${width - horizontalPadding} ${height} L ${horizontalPadding} ${height} Z`;
  const latest = points[points.length - 1]?.value ?? 0;
  const maxTicks = width < 420 ? 4 : compact ? 6 : 7;
  const tickCount = Math.min(points.length, maxTicks);
  const tickIndexes = Array.from({ length: tickCount }, (_, index) => (
    Math.round((index / Math.max(tickCount - 1, 1)) * Math.max(points.length - 1, 0))
  ));
  const tickLabelWidth = compact ? 44 : 52;

  return (
    <View className="rounded-[18px] bg-[#fbf8f2] p-4">
      <Text className="text-xs uppercase tracking-[1.6px] text-[#7d7468]">{title}</Text>
      <View className="mt-1 flex-row items-baseline gap-2">
        <Text className={`font-bold text-[#16181a] ${compact ? 'text-[22px]' : 'text-[28px]'}`}>{formatValue(latest)}</Text>
        <Text className="text-[11px] text-[#8a8072]">{latestLabel}</Text>
      </View>
      <Text numberOfLines={1} className="mt-1 text-xs text-[#8a8072]">{subtitle}</Text>

      <View className={`overflow-hidden rounded-[14px] bg-[#f4efe4] p-3 ${compact ? 'mt-3' : 'mt-4'}`}>
        <View
          style={{ width: '100%', height }}
          onLayout={(event) => {
            const nextWidth = Math.max(Math.round(event.nativeEvent.layout.width), 1);
            setWidth((current) => (current === nextWidth ? current : nextWidth));
          }}
        >
          <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0%" stopColor={color} stopOpacity="0.28" />
                <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>
            <Path d={area} fill={`url(#${gradientId})`} />
            <Path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        </View>

        <View className="mt-2 h-4" style={{ position: 'relative', width: '100%' }}>
          {tickIndexes.map((pointIndex) => {
            const point = points[pointIndex];
            const x = horizontalPadding + (pointIndex / Math.max(points.length - 1, 1)) * drawableWidth;
            const left = Math.min(Math.max(x - tickLabelWidth / 2, 0), Math.max(width - tickLabelWidth, 0));

            return (
              <Text
                key={`${point.label}-${pointIndex}`}
                numberOfLines={1}
                className={`text-center text-[#7d7468] ${compact ? 'text-[10px]' : 'text-xs'}`}
                style={{ position: 'absolute', left, width: tickLabelWidth }}
              >
                {point.label}
              </Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}
