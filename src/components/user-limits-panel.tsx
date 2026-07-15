import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, Save } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { getAdminRequestErrorMessage } from '@/src/lib/admin-error-message';
import {
  getUserPlatformQuotas,
  listGroups,
  resetUserPlatformQuotaWindow,
  updateUser,
  updateUserPlatformQuotas,
} from '@/src/services/admin';
import { adminConfigState } from '@/src/store/admin-config';
import type {
  AdminUser,
  UserPlatformQuota,
  UserPlatformQuotaPlatform,
  UserPlatformQuotaWindow,
} from '@/src/types/admin';

const { useSnapshot } = require('valtio/react');

const colors = {
  card: '#fbf8f2',
  text: '#16181a',
  subtext: '#6f665c',
  border: '#e7dfcf',
  primary: '#1d5f55',
  muted: '#f1ece2',
  dangerBg: '#fbebe4',
  danger: '#b45131',
};

const platforms: UserPlatformQuotaPlatform[] = ['anthropic', 'openai', 'gemini', 'antigravity', 'grok'];
const windowLabels: Record<UserPlatformQuotaWindow, string> = { daily: '日', weekly: '周', monthly: '月' };

type QuotaDraft = {
  platform: UserPlatformQuotaPlatform;
  daily: string;
  weekly: string;
  monthly: string;
  dailyUsage: number;
  weeklyUsage: number;
  monthlyUsage: number;
};

type Feedback = { message: string; tone: 'success' | 'error' };

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 15, marginBottom: 12 }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: colors.subtext, fontSize: 11, lineHeight: 17, marginTop: 4 }}>{subtitle}</Text>
      <View style={{ marginTop: 14 }}>{children}</View>
    </View>
  );
}

function NumericField({ label, value, onChangeText, placeholder, decimal = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  decimal?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: '700' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9b9081"
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        style={{ minHeight: 42, borderRadius: 8, backgroundColor: colors.muted, paddingHorizontal: 11, color: colors.text, fontSize: 13 }}
      />
    </View>
  );
}

function emptyDraft(platform: UserPlatformQuotaPlatform): QuotaDraft {
  return { platform, daily: '', weekly: '', monthly: '', dailyUsage: 0, weeklyUsage: 0, monthlyUsage: 0 };
}

function quotaDrafts(items: UserPlatformQuota[]) {
  const byPlatform = new Map(items.map((item) => [item.platform, item]));
  return platforms.map((platform) => {
    const item = byPlatform.get(platform);
    if (!item) return emptyDraft(platform);
    return {
      platform,
      daily: item.daily_limit_usd == null ? '' : String(item.daily_limit_usd),
      weekly: item.weekly_limit_usd == null ? '' : String(item.weekly_limit_usd),
      monthly: item.monthly_limit_usd == null ? '' : String(item.monthly_limit_usd),
      dailyUsage: Number(item.daily_usage_usd ?? 0),
      weeklyUsage: Number(item.weekly_usage_usd ?? 0),
      monthlyUsage: Number(item.monthly_usage_usd ?? 0),
    };
  });
}

function parseOptionalLimit(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

async function confirmQuotaReset(platform: UserPlatformQuotaPlatform, window: UserPlatformQuotaWindow) {
  const message = `确认重置 ${platform} 的${windowLabels[window]}用量吗？额度限制本身不会改变。`;
  if (Platform.OS === 'web') {
    return typeof globalThis.confirm === 'function' ? globalThis.confirm(`重置平台用量\n\n${message}`) : false;
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert('重置平台用量', message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '确认重置', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function UserLimitsPanel({ user }: { user: AdminUser }) {
  const config = useSnapshot(adminConfigState);
  const queryClient = useQueryClient();
  const serverScope = `${config.baseUrl}|${config.activeAccountId}`;
  const [concurrency, setConcurrency] = useState('1');
  const [rpmLimit, setRpmLimit] = useState('0');
  const [restrictGroups, setRestrictGroups] = useState(false);
  const [allowedGroupIds, setAllowedGroupIds] = useState<number[]>([]);
  const [limitsFeedback, setLimitsFeedback] = useState<Feedback | null>(null);
  const [quotaRows, setQuotaRows] = useState<QuotaDraft[]>(platforms.map(emptyDraft));
  const [quotaFeedback, setQuotaFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    setConcurrency(String(user.concurrency ?? 1));
    setRpmLimit(String(user.rpm_limit ?? 0));
    setRestrictGroups(Array.isArray(user.allowed_groups));
    setAllowedGroupIds(Array.isArray(user.allowed_groups) ? user.allowed_groups : []);
    setLimitsFeedback(null);
  }, [user.allowed_groups, user.concurrency, user.id, user.rpm_limit]);

  const groupsQuery = useQuery({
    queryKey: ['groups', serverScope, 'user-limits'],
    queryFn: () => listGroups('', 1, 100),
    staleTime: 60_000,
  });

  const quotasQuery = useQuery({
    queryKey: ['user-platform-quotas', serverScope, user.id],
    queryFn: () => getUserPlatformQuotas(user.id),
  });

  useEffect(() => {
    if (quotasQuery.data) setQuotaRows(quotaDrafts(quotasQuery.data.platform_quotas ?? []));
  }, [quotasQuery.data]);

  const limitsMutation = useMutation({
    mutationFn: () => {
      const parsedConcurrency = Number(concurrency);
      const parsedRpmLimit = Number(rpmLimit);
      if (!Number.isInteger(parsedConcurrency) || parsedConcurrency < 1) {
        throw new Error('并发数必须是大于或等于 1 的整数。');
      }
      if (!Number.isInteger(parsedRpmLimit) || parsedRpmLimit < 0) {
        throw new Error('RPM 必须是大于或等于 0 的整数。');
      }
      return updateUser(user.id, {
        concurrency: parsedConcurrency,
        rpm_limit: parsedRpmLimit,
        allowed_groups: restrictGroups ? allowedGroupIds : null,
      });
    },
    onSuccess: async () => {
      setLimitsFeedback({ message: '用户并发、RPM 与分组权限已更新。', tone: 'success' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user', user.id] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);
    },
    onError: (error) => setLimitsFeedback({ message: getAdminRequestErrorMessage(error, '用户限制更新失败。'), tone: 'error' }),
  });

  const quotasMutation = useMutation({
    mutationFn: () => {
      const quotas = quotaRows.map((row) => ({
        platform: row.platform,
        daily_limit_usd: parseOptionalLimit(row.daily),
        weekly_limit_usd: parseOptionalLimit(row.weekly),
        monthly_limit_usd: parseOptionalLimit(row.monthly),
      }));
      if (quotas.some((row) => [row.daily_limit_usd, row.weekly_limit_usd, row.monthly_limit_usd].some(Number.isNaN))) {
        throw new Error('平台额度必须是大于或等于 0 的数字，留空表示不限。');
      }
      return updateUserPlatformQuotas(user.id, quotas);
    },
    onSuccess: async (result) => {
      setQuotaRows(quotaDrafts(result.platform_quotas ?? []));
      setQuotaFeedback({ message: '平台额度已更新。', tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['user-platform-quotas', serverScope, user.id] });
    },
    onError: (error) => setQuotaFeedback({ message: getAdminRequestErrorMessage(error, '平台额度更新失败。'), tone: 'error' }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ platform, window }: { platform: UserPlatformQuotaPlatform; window: UserPlatformQuotaWindow }) =>
      resetUserPlatformQuotaWindow(user.id, platform, window),
    onSuccess: (result, variables) => {
      setQuotaRows(quotaDrafts(result.platform_quotas ?? []));
      setQuotaFeedback({ message: `${variables.platform} ${windowLabels[variables.window]}用量已重置。`, tone: 'success' });
    },
    onError: (error) => setQuotaFeedback({ message: getAdminRequestErrorMessage(error, '重置平台用量失败。'), tone: 'error' }),
  });

  function toggleAllowedGroup(groupId: number) {
    setAllowedGroupIds((current) => current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]);
  }

  function updateQuotaRow(platform: UserPlatformQuotaPlatform, window: UserPlatformQuotaWindow, value: string) {
    setQuotaRows((current) => current.map((row) => row.platform === platform ? { ...row, [window]: value } : row));
  }

  async function handleReset(platform: UserPlatformQuotaPlatform, window: UserPlatformQuotaWindow) {
    setQuotaFeedback(null);
    if (await confirmQuotaReset(platform, window)) resetMutation.mutate({ platform, window });
  }

  return (
    <>
      <Panel title="访问与并发" subtitle="0 RPM 表示不限制；关闭分组限制时可访问所有非独占分组。">
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <NumericField label="并发数" value={concurrency} onChangeText={setConcurrency} />
          <NumericField label="RPM（0 为不限）" value={rpmLimit} onChangeText={setRpmLimit} />
        </View>

        <View style={{ marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 13 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>限制允许分组</Text>
            <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 3 }}>{restrictGroups ? `已选择 ${allowedGroupIds.length} 个分组` : '允许所有非独占分组'}</Text>
          </View>
          <Switch value={restrictGroups} onValueChange={setRestrictGroups} trackColor={{ false: '#d2c8b8', true: '#8db9ae' }} thumbColor={restrictGroups ? colors.primary : colors.card} />
        </View>

        {restrictGroups ? (
          <View style={{ marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {groupsQuery.isLoading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
            {(groupsQuery.data?.items ?? []).map((group) => {
              const selected = allowedGroupIds.includes(group.id);
              return (
                <Pressable
                  key={group.id}
                  onPress={() => toggleAllowedGroup(group.id)}
                  style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, backgroundColor: selected ? colors.primary : colors.muted }}
                >
                  {selected ? <Check color="#fff" size={13} /> : null}
                  <Text style={{ color: selected ? '#fff' : colors.subtext, fontSize: 11, fontWeight: '800' }}>{group.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {groupsQuery.error && restrictGroups ? (
          <Text style={{ marginTop: 10, borderRadius: 8, backgroundColor: colors.dangerBg, padding: 10, color: colors.danger, fontSize: 11 }}>
            {getAdminRequestErrorMessage(groupsQuery.error, '分组列表加载失败。')}
          </Text>
        ) : null}

        {limitsFeedback ? (
          <Text style={{ marginTop: 11, borderRadius: 8, backgroundColor: limitsFeedback.tone === 'success' ? '#e6f4ee' : colors.dangerBg, padding: 10, color: limitsFeedback.tone === 'success' ? colors.primary : colors.danger, fontSize: 11 }}>
            {limitsFeedback.message}
          </Text>
        ) : null}

        <Pressable
          disabled={limitsMutation.isPending || (restrictGroups && groupsQuery.isLoading)}
          onPress={() => {
            setLimitsFeedback(null);
            limitsMutation.mutate();
          }}
          style={{ marginTop: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: limitsMutation.isPending ? '#8bada6' : colors.primary }}
        >
          {limitsMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Save color="#fff" size={16} />}
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{limitsMutation.isPending ? '保存中' : '保存访问限制'}</Text>
        </Pressable>
      </Panel>

      <Panel title="平台额度" subtitle="分别控制各平台的日、周、月美元额度；留空表示不限。">
        {quotasQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {quotasQuery.error ? (
          <View style={{ gap: 9 }}>
            <Text style={{ borderRadius: 8, backgroundColor: colors.dangerBg, padding: 10, color: colors.danger, fontSize: 11 }}>
              {getAdminRequestErrorMessage(quotasQuery.error, '平台额度加载失败。')}
            </Text>
            <Pressable onPress={() => void quotasQuery.refetch()} style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.muted }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>重试</Text>
            </Pressable>
          </View>
        ) : null}

        {!quotasQuery.isLoading && !quotasQuery.error ? (
          <View>
            {quotaRows.map((row, index) => (
              <View key={row.platform} style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border, paddingVertical: 13 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{row.platform}</Text>
                  <Text style={{ color: colors.subtext, fontSize: 10 }}>用量 ${row.dailyUsage.toFixed(2)} / ${row.weeklyUsage.toFixed(2)} / ${row.monthlyUsage.toFixed(2)}</Text>
                </View>
                <View style={{ marginTop: 9, flexDirection: 'row', gap: 7 }}>
                  <NumericField label="每日额度" value={row.daily} onChangeText={(value) => updateQuotaRow(row.platform, 'daily', value)} placeholder="不限" decimal />
                  <NumericField label="每周额度" value={row.weekly} onChangeText={(value) => updateQuotaRow(row.platform, 'weekly', value)} placeholder="不限" decimal />
                  <NumericField label="每月额度" value={row.monthly} onChangeText={(value) => updateQuotaRow(row.platform, 'monthly', value)} placeholder="不限" decimal />
                </View>
                <View style={{ marginTop: 8, flexDirection: 'row', gap: 7 }}>
                  {(['daily', 'weekly', 'monthly'] as const).map((window) => {
                    const pending = resetMutation.isPending && resetMutation.variables?.platform === row.platform && resetMutation.variables?.window === window;
                    return (
                      <Pressable
                        key={window}
                        disabled={resetMutation.isPending}
                        onPress={() => void handleReset(row.platform, window)}
                        accessibilityLabel={`重置 ${row.platform} ${windowLabels[window]}用量`}
                        style={{ minHeight: 36, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, backgroundColor: colors.muted, opacity: resetMutation.isPending && !pending ? 0.5 : 1 }}
                      >
                        {pending ? <ActivityIndicator color={colors.subtext} size="small" /> : <RotateCcw color={colors.subtext} size={13} />}
                        <Text style={{ color: colors.subtext, fontSize: 10, fontWeight: '800' }}>重置{windowLabels[window]}用量</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {quotaFeedback ? (
              <Text style={{ marginTop: 2, borderRadius: 8, backgroundColor: quotaFeedback.tone === 'success' ? '#e6f4ee' : colors.dangerBg, padding: 10, color: quotaFeedback.tone === 'success' ? colors.primary : colors.danger, fontSize: 11 }}>
                {quotaFeedback.message}
              </Text>
            ) : null}

            <Pressable
              disabled={quotasMutation.isPending || resetMutation.isPending}
              onPress={() => {
                setQuotaFeedback(null);
                quotasMutation.mutate();
              }}
              style={{ marginTop: 12, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: quotasMutation.isPending ? '#8bada6' : colors.primary }}
            >
              {quotasMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Save color="#fff" size={16} />}
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{quotasMutation.isPending ? '保存中' : '保存平台额度'}</Text>
            </Pressable>
          </View>
        ) : null}
      </Panel>
    </>
  );
}
