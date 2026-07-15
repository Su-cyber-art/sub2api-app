import {
  Button,
  Form,
  HStack,
  Host,
  Picker,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  listStyle,
  monospacedDigit,
  pickerStyle,
  refreshable,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { router } from 'expo-router';

import { useMonitorDashboard } from '@/src/features/monitor/use-monitor-dashboard';
import { formatTokenValue } from '@/src/lib/formatters';
import type { TrendRangeKey } from '@/src/lib/trend-range';
import { impactHaptic, selectionHaptic } from '@/src/ui/ios/haptics';
import {
  SwiftUIMetric,
  SwiftUINavigationRow,
  SwiftUIPageTitle,
  SwiftUIStateView,
  SwiftUITrendChart,
  SwiftUIValueRow,
} from '@/src/ui/ios/swiftui-primitives';

const RANGE_OPTIONS: ReadonlyArray<{ label: string; value: TrendRangeKey }> = [
  { value: '24h', label: '24 小时' },
  { value: '7d', label: '7 天' },
  { value: '30d', label: '30 天' },
];

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;

function formatNumber(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatMoney(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return `$${value.toFixed(2)}`;
}

function formatCompactNumber(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatTokens(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return formatTokenValue(value);
}

export default function IOSMonitorScreen() {
  const dashboard = useMonitorDashboard();
  const {
    hasAccount,
    rangeKey,
    range,
    stats,
    siteName,
    topModels,
    errorMessage,
    currentPageLimitedAccounts,
    currentPageBusyAccounts,
    totalAccounts,
    errorAccounts,
    healthyAccounts,
    latestTrendPoints,
    selectedTokenTotal,
    selectedCostTotal,
    selectedOutputTotal,
    rangeTitle,
    hasTrendData,
    isLoading,
    hasError,
    throughputPoints,
    requestPoints,
    costPoints,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    refetchAll,
  } = dashboard;

  const tokenValue = formatTokens(rangeKey === '24h' ? selectedTokenTotal || stats?.today_tokens : selectedTokenTotal);
  const outputValue = formatTokens(rangeKey === '24h' ? selectedOutputTotal || stats?.today_output_tokens : selectedOutputTotal);
  const costValue = formatMoney(rangeKey === '24h' ? selectedCostTotal || stats?.today_cost : selectedCostTotal);
  const requestTotal = requestPoints.reduce((sum, point) => sum + point.value, 0);

  function changeRange(value: TrendRangeKey) {
    selectionHaptic();
    dashboard.setRangeKey(value);
  }

  function openAccounts() {
    impactHaptic();
    router.push('/accounts/overview');
  }

  return (
    <Host seedColor="#007AFF" style={{ flex: 1 }} useViewportSizeMeasurement>
      <Form modifiers={[listStyle('insetGrouped'), refreshable(refetchAll)]}>
        <Section>
          <SwiftUIPageTitle title="概览" subtitle={`${siteName} 的当前运行状态`} />
          <Picker
            label="统计时间范围"
            onSelectionChange={changeRange}
            selection={rangeKey}
            modifiers={[pickerStyle('segmented')]}
          >
            {RANGE_OPTIONS.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>
            ))}
          </Picker>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY), frame({ maxWidth: Infinity, alignment: 'center' })]}>
            {range.query.start_date} 至 {range.query.end_date}
          </Text>
        </Section>

        {!hasAccount ? (
          <Section>
            <SwiftUIStateView
              action={<Button label="前往服务器设置" systemImage="server.rack" onPress={() => router.push('/settings')} modifiers={[buttonStyle('borderedProminent')]} />}
              message="请先添加服务器地址和 Admin Token。"
              systemImage="externaldrive.badge.questionmark"
              title="尚未连接服务器"
            />
          </Section>
        ) : isLoading ? (
          <Section>
            <SwiftUIStateView loading message="正在读取概览、模型和账号状态。" title="载入中" />
          </Section>
        ) : hasError ? (
          <Section>
            <SwiftUIStateView
              action={(
                <HStack spacing={10}>
                  <Button label="重试" systemImage="arrow.clockwise" onPress={() => void refetchAll()} modifiers={[buttonStyle('borderedProminent')]} />
                  <Button label="检查服务器" systemImage="server.rack" onPress={() => router.push('/settings')} modifiers={[buttonStyle('bordered')]} />
                </HStack>
              )}
              message={errorMessage}
              systemImage="wifi.exclamationmark"
              title="无法载入概览"
              tone="error"
            />
          </Section>
        ) : (
          <>
            <Section title={`${rangeTitle} 摘要`}>
              <HStack spacing={20}>
                <SwiftUIMetric detail={`输出 ${outputValue}`} label="Token" value={tokenValue} />
                <SwiftUIMetric detail={`TPM ${formatNumber(stats?.tpm)}`} label="成本" tint="indigo" value={costValue} />
              </HStack>
            </Section>

            <Section
              footer={<Text>限流和繁忙状态来自当前账号列表。</Text>}
              title="账号概览"
            >
              <SwiftUINavigationRow label="账号清单" value={formatNumber(totalAccounts)} systemImage="person.2" onPress={openAccounts} />
              <SwiftUIValueRow label="健康" systemImage="checkmark.circle" value={formatNumber(healthyAccounts)} valueTone="green" />
              <SwiftUIValueRow label="繁忙" systemImage="hourglass" value={formatNumber(currentPageBusyAccounts)} valueTone="orange" />
              <SwiftUIValueRow label="限流" systemImage="speedometer" value={formatNumber(currentPageLimitedAccounts)} valueTone="orange" />
              <SwiftUIValueRow label="异常" systemImage="exclamationmark.triangle" value={formatNumber(errorAccounts)} valueTone="red" />
            </Section>

            {hasTrendData && throughputPoints.length > 1 ? (
              <Section footer={<Text>当前时间范围内的 Token 变化。</Text>} title="Token 吞吐">
                <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), monospacedDigit()]}>{formatTokens(selectedTokenTotal)}</Text>
                <SwiftUITrendChart color="#C14E2D" points={throughputPoints} />
              </Section>
            ) : null}

            {hasTrendData && requestPoints.length > 1 ? (
              <Section footer={<Text>当前时间范围内的请求变化。</Text>} title="请求趋势">
                <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), monospacedDigit()]}>{formatCompactNumber(requestTotal)}</Text>
                <SwiftUITrendChart color="#16816D" points={requestPoints} />
              </Section>
            ) : null}

            {hasTrendData && costPoints.length > 1 ? (
              <Section footer={<Text>当前时间范围内的成本变化。</Text>} title="成本趋势">
                <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), monospacedDigit()]}>{formatMoney(selectedCostTotal)}</Text>
                <SwiftUITrendChart color="#6D5BDD" points={costPoints} />
              </Section>
            ) : null}

            <Section title="Token 结构">
              <SwiftUIValueRow label="输入 Token" systemImage="arrow.down.circle" value={formatTokens(totalInputTokens)} />
              <SwiftUIValueRow label="输出 Token" systemImage="arrow.up.circle" value={formatTokens(totalOutputTokens)} />
              <SwiftUIValueRow label="缓存读取 Token" systemImage="bolt.circle" value={formatTokens(totalCacheReadTokens)} />
            </Section>

            <Section footer={<Text>按当前时间范围内的 Token 使用量排序。</Text>} title="热点模型">
              {topModels.length > 0 ? topModels.map((model) => (
                <VStack key={model.model} alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                  <HStack>
                    <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{model.model}</Text>
                    <Spacer />
                    <Text modifiers={[foregroundStyle(SECONDARY), monospacedDigit()]}>{formatTokens(model.total_tokens)}</Text>
                  </HStack>
                  <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>
                    {formatNumber(model.requests)} 次请求 · {formatMoney(model.cost)}
                  </Text>
                </VStack>
              )) : <Text modifiers={[foregroundStyle(SECONDARY)]}>暂无模型数据</Text>}
            </Section>

            <Section title="最近统计点">
              {latestTrendPoints.length > 0 ? latestTrendPoints.map((point) => (
                <VStack key={point.date} alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                  <HStack>
                    <Text>{point.date}</Text>
                    <Spacer />
                    <Text modifiers={[foregroundStyle(SECONDARY), monospacedDigit()]}>{formatTokens(point.total_tokens)}</Text>
                  </HStack>
                  <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>
                    请求 {formatCompactNumber(point.requests)} · 成本 {formatMoney(point.cost)}
                  </Text>
                </VStack>
              )) : <Text modifiers={[foregroundStyle(SECONDARY)]}>当前范围暂无趋势数据</Text>}
            </Section>
          </>
        )}
      </Form>
    </Host>
  );
}
