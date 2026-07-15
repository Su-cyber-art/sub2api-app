import {
  Button,
  ConfirmationDialog,
  Form,
  HStack,
  Host,
  Image,
  Label,
  Picker,
  Section,
  Spacer,
  Text,
  TextField,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  buttonStyle,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  lineLimit,
  listStyle,
  monospacedDigit,
  pickerStyle,
  refreshable,
  submitLabel,
  tag,
  textFieldStyle,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams } from 'expo-router';

import { getUserDetailErrorMessage, useUserDetail } from '@/src/features/users/use-user-detail';
import type { TrendRangeKey } from '@/src/lib/trend-range';
import { impactHaptic, selectionHaptic, successHaptic, warningHaptic } from '@/src/ui/ios/haptics';
import {
  SwiftUIBoundTextField,
  SwiftUIMetric,
  SwiftUIStateView,
  SwiftUIStatus,
  SwiftUITrendChart,
  SwiftUIValueRow,
} from '@/src/ui/ios/swiftui-primitives';
import { SwiftUIUserLimitsSections } from '@/src/ui/ios/swiftui-user-limits';
import type { AdminApiKey, BalanceOperation } from '@/src/types/admin';

const RANGE_OPTIONS: ReadonlyArray<{ label: string; value: TrendRangeKey }> = [
  { label: '24 小时', value: '24h' },
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
];

const BALANCE_OPTIONS: ReadonlyArray<{ label: string; value: BalanceOperation }> = [
  { label: '充值', value: 'add' },
  { label: '扣减', value: 'subtract' },
  { label: '设为', value: 'set' },
];

const SECONDARY = { type: 'hierarchical', style: 'secondary' } as const;
const TERTIARY = { type: 'hierarchical', style: 'tertiary' } as const;

function formatMoney(value?: number | null) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function formatUsageCost(stats?: { total_account_cost?: number | null; total_actual_cost?: number | null; total_cost?: number | null }) {
  const value = Number(stats?.total_account_cost ?? stats?.total_actual_cost ?? stats?.total_cost ?? 0);
  return `$${value.toFixed(4)}`;
}

function formatTokenValue(value?: number | null) {
  const number = Number(value ?? 0);
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(2)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(2)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(2)}K`;
  return new Intl.NumberFormat('en-US').format(number);
}

function formatTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatQuotaUsage(quotaUsed?: number | null, quota?: number | null) {
  const used = Number(quotaUsed ?? 0);
  const limit = Number(quota ?? 0);
  return limit <= 0 ? `${used} / 不限` : `${used} / ${limit}`;
}

function NativeApiKeyRow({ item, copied, onCopy }: { item: AdminApiKey; copied: boolean; onCopy: () => void }) {
  const isDisabled = item.status === 'inactive' || item.status === 'disabled';
  return (
    <Button
      onPress={onCopy}
      modifiers={[
        buttonStyle('plain'),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        accessibilityLabel(`复制 ${item.name || `Key ${item.id}`}`),
      ]}
    >
      <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <HStack spacing={8}>
          <VStack alignment="leading" spacing={1} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), lineLimit(1)]}>{item.name || `Key #${item.id}`}</Text>
            <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY), lineLimit(1)]}>{item.group?.name || '未分组'}</Text>
          </VStack>
          <SwiftUIStatus label={isDisabled ? '已停用' : '正常'} tone={isDisabled ? 'neutral' : 'success'} />
        </HStack>
        <HStack spacing={8}>
          <Text modifiers={[font({ textStyle: 'caption', design: 'monospaced' }), foregroundStyle(SECONDARY), lineLimit(2)]}>{item.key || '--'}</Text>
          <Spacer />
          <Image color={copied ? '#34C759' : '#007AFF'} size={16} systemName={copied ? 'checkmark.circle.fill' : 'doc.on.doc'} />
        </HStack>
        <HStack>
          <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(TERTIARY)]}>额度 {formatQuotaUsage(item.quota_used, item.quota)}</Text>
          <Spacer />
          <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(TERTIARY)]}>{formatTime(item.last_used_at || item.updated_at || item.created_at)}</Text>
        </HStack>
      </VStack>
    </Button>
  );
}

export default function IOSUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useUserDetail(Number(id));
  const {
    operation,
    setOperation,
    amount,
    setAmount,
    notes,
    setNotes,
    formError,
    statusError,
    deleteError,
    searchText,
    setSearchText,
    copiedKeyId,
    rangeKey,
    setRangeKey,
    range,
    userQuery,
    apiKeysQuery,
    usageStatsQuery,
    usageSnapshotQuery,
    balanceMutation,
    statusMutation,
    deleteMutation,
    user,
    filteredApiKeys,
    trendPoints,
    submitBalance,
    copyKey,
  } = state;

  const isDisabled = user?.status === 'inactive' || user?.status === 'disabled';
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const nextStatus: 'active' | 'disabled' = isDisabled ? 'active' : 'disabled';
  const statusAction = nextStatus === 'disabled' ? '停用' : '启用';

  async function refresh(): Promise<void> {
    await Promise.all([
      userQuery.refetch(),
      apiKeysQuery.refetch(),
      usageStatsQuery.refetch(),
      usageSnapshotQuery.refetch(),
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F2F2F7' },
          headerTintColor: '#007AFF',
          title: user?.username?.trim() || user?.email || '用户详情',
        }}
      />
      <Host seedColor="#007AFF" style={{ flex: 1 }} useViewportSizeMeasurement>
        <Form modifiers={[listStyle('insetGrouped'), refreshable(refresh)]}>
          {userQuery.isLoading ? (
            <Section>
              <SwiftUIStateView loading message="正在读取用户资料。" title="载入中" />
            </Section>
          ) : null}
          {userQuery.error ? (
            <Section>
              <SwiftUIStateView
                action={<Button label="重试" systemImage="arrow.clockwise" onPress={() => void refresh()} modifiers={[buttonStyle('borderedProminent')]} />}
                message={getUserDetailErrorMessage(userQuery.error)}
                systemImage="person.crop.circle.badge.exclamationmark"
                title="无法载入用户"
                tone="error"
              />
            </Section>
          ) : null}

          {user ? (
            <Section title="基本资料">
              <SwiftUIValueRow label="邮箱" systemImage="envelope" value={user.email} />
              <SwiftUIValueRow label="用户名" systemImage="person" value={user.username || '--'} />
              <SwiftUIValueRow label="余额" systemImage="wallet.pass" value={formatMoney(user.balance)} valueTone="green" />
              <SwiftUIValueRow label="最后使用" systemImage="clock" value={formatTime(user.last_used_at || user.updated_at || user.created_at)} />

              {isAdmin ? (
                <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                  <HStack>
                    <Label title="状态" systemImage="checkmark.shield" />
                    <Spacer />
                    <SwiftUIStatus label={isDisabled ? '已停用' : '正常'} tone={isDisabled ? 'neutral' : 'success'} />
                  </HStack>
                  <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>管理员账号不能被停用</Text>
                </VStack>
              ) : (
                <ConfirmationDialog title={`${statusAction}用户`}>
                  <ConfirmationDialog.Trigger>
                    <Button
                      modifiers={[
                        buttonStyle('plain'),
                        disabledModifier(statusMutation.isPending),
                        frame({ maxWidth: Infinity, alignment: 'leading' }),
                      ]}
                    >
                      <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
                        <Label title="状态" systemImage={isDisabled ? 'pause.circle' : 'checkmark.circle'} />
                        <Spacer />
                        <SwiftUIStatus
                          label={statusMutation.isPending ? '正在更新' : isDisabled ? '已停用' : '正常'}
                          tone={isDisabled ? 'neutral' : 'success'}
                        />
                        <Image color="#C7C7CC" size={13} systemName="chevron.forward" />
                      </HStack>
                    </Button>
                  </ConfirmationDialog.Trigger>
                  <ConfirmationDialog.Message>
                    <Text>{nextStatus === 'disabled' ? '停用后该用户将无法继续使用现有 API Key。' : '启用后该用户可恢复使用现有 API Key。'}</Text>
                  </ConfirmationDialog.Message>
                  <ConfirmationDialog.Actions>
                    <Button
                      label={`确认${statusAction}`}
                      role={nextStatus === 'disabled' ? 'destructive' : 'default'}
                      onPress={() => {
                        warningHaptic();
                        statusMutation.mutate(nextStatus);
                      }}
                    />
                    <Button label="取消" role="cancel" />
                  </ConfirmationDialog.Actions>
                </ConfirmationDialog>
              )}
              {statusError ? <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle('red')]}>{statusError}</Text> : null}
            </Section>
          ) : null}

          {user ? <SwiftUIUserLimitsSections user={user} /> : null}

          <Section title="用量">
            <Picker
              label="时间范围"
              onSelectionChange={(value) => {
                selectionHaptic();
                setRangeKey(value);
              }}
              selection={rangeKey}
              modifiers={[pickerStyle('segmented')]}
            >
              {RANGE_OPTIONS.map((option) => (
                <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>
              ))}
            </Picker>
            <HStack spacing={12}>
              <SwiftUIMetric label="请求" tint="green" value={formatTokenValue(usageStatsQuery.data?.total_requests)} />
              <SwiftUIMetric label="Token" value={formatTokenValue(usageStatsQuery.data?.total_tokens)} />
              <SwiftUIMetric label="成本" tint="indigo" value={formatUsageCost(usageStatsQuery.data)} />
            </HStack>
            {usageStatsQuery.error ? <Text modifiers={[foregroundStyle('red')]}>{getUserDetailErrorMessage(usageStatsQuery.error)}</Text> : null}
          </Section>

          {!usageSnapshotQuery.isLoading && Boolean(usageSnapshotQuery.data?.trend?.length) && trendPoints.length > 1 ? (
            <Section footer={<Text>{range.query.start_date} 至 {range.query.end_date}</Text>} title="Token 趋势">
              <SwiftUITrendChart points={trendPoints} />
            </Section>
          ) : null}
          {usageSnapshotQuery.error ? (
            <Section title="趋势载入失败">
              <Text modifiers={[foregroundStyle('red')]}>{getUserDetailErrorMessage(usageSnapshotQuery.error)}</Text>
            </Section>
          ) : null}

          <Section title="API Keys">
            <TextField
              onTextChange={setSearchText}
              placeholder="搜索名称、Key 或分组"
              modifiers={[
                textFieldStyle('roundedBorder'),
                keyboardType('web-search'),
                textInputAutocapitalization('never'),
                autocorrectionDisabled(),
                submitLabel('search'),
              ]}
            />
            {apiKeysQuery.isLoading ? <SwiftUIStateView loading message="正在读取 API Keys。" title="载入中" /> : null}
            {apiKeysQuery.error ? <Text modifiers={[foregroundStyle('red')]}>{getUserDetailErrorMessage(apiKeysQuery.error)}</Text> : null}
            {!apiKeysQuery.isLoading && !apiKeysQuery.error ? filteredApiKeys.map((item) => (
              <NativeApiKeyRow
                key={item.id}
                copied={copiedKeyId === item.id}
                item={item}
                onCopy={() => {
                  void copyKey(item).then(successHaptic);
                }}
              />
            )) : null}
            {!apiKeysQuery.isLoading && !apiKeysQuery.error && filteredApiKeys.length === 0 ? (
              <Text modifiers={[foregroundStyle(SECONDARY)]}>{searchText ? '没有匹配的 API Key。' : '该用户还没有 API Key。'}</Text>
            ) : null}
          </Section>

          <Section footer={<Text>金额必须大于或等于 0；备注可选。</Text>} title="余额操作">
            <Picker
              label="操作类型"
              onSelectionChange={(value) => {
                selectionHaptic();
                setOperation(value);
              }}
              selection={operation}
              modifiers={[pickerStyle('segmented')]}
            >
              {BALANCE_OPTIONS.map((option) => (
                <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>
              ))}
            </Picker>
            <HStack spacing={12}>
              <Text>金额</Text>
              <Spacer />
              <SwiftUIBoundTextField keyboard="decimal-pad" onTextChange={setAmount} placeholder="例如 10" value={amount} />
            </HStack>
            <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
              <Text>备注</Text>
              <SwiftUIBoundTextField multiline onTextChange={setNotes} placeholder="可选" value={notes} />
            </VStack>
            {formError ? <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle('red')]}>{formError}</Text> : null}
            <Button
              label={balanceMutation.isPending ? '正在提交' : '确认提交'}
              systemImage="checkmark.circle"
              onPress={() => {
                impactHaptic();
                submitBalance();
              }}
              modifiers={[
                buttonStyle('borderedProminent'),
                disabledModifier(balanceMutation.isPending),
                frame({ maxWidth: Infinity, alignment: 'center' }),
              ]}
            />
          </Section>

          {user ? (
            <Section footer={<Text>删除后，现有 API Key 将立即失效，此操作无法撤销。</Text>} title="危险操作">
              <ConfirmationDialog title="删除用户">
                <ConfirmationDialog.Trigger>
                  <Button
                    label={deleteMutation.isPending ? '正在删除' : '删除用户'}
                    role="destructive"
                    systemImage="trash"
                    modifiers={[
                      buttonStyle('plain'),
                      disabledModifier(isAdmin || deleteMutation.isPending),
                      frame({ maxWidth: Infinity, alignment: 'leading' }),
                    ]}
                  />
                </ConfirmationDialog.Trigger>
                <ConfirmationDialog.Message>
                  <Text>确认删除用户“{user.email}”吗？该操作无法撤销。</Text>
                </ConfirmationDialog.Message>
                <ConfirmationDialog.Actions>
                  <Button
                    label="确认删除"
                    role="destructive"
                    onPress={() => {
                      warningHaptic();
                      deleteMutation.mutate();
                    }}
                  />
                  <Button label="取消" role="cancel" />
                </ConfirmationDialog.Actions>
              </ConfirmationDialog>
              {isAdmin ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(SECONDARY)]}>管理员用户不能删除</Text> : null}
              {deleteError ? <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle('red')]}>{deleteError}</Text> : null}
            </Section>
          ) : null}
        </Form>
      </Host>
    </>
  );
}
