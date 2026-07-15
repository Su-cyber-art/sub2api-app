import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

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

export const USER_QUOTA_PLATFORMS: UserPlatformQuotaPlatform[] = ['anthropic', 'openai', 'gemini', 'antigravity', 'grok'];

export const USER_QUOTA_WINDOW_LABELS: Record<UserPlatformQuotaWindow, string> = {
  daily: '日',
  weekly: '周',
  monthly: '月',
};

export type UserQuotaDraft = {
  platform: UserPlatformQuotaPlatform;
  daily: string;
  weekly: string;
  monthly: string;
  dailyUsage: number;
  weeklyUsage: number;
  monthlyUsage: number;
};

export type UserLimitsFeedback = { message: string; tone: 'success' | 'error' };

function emptyDraft(platform: UserPlatformQuotaPlatform): UserQuotaDraft {
  return { platform, daily: '', weekly: '', monthly: '', dailyUsage: 0, weeklyUsage: 0, monthlyUsage: 0 };
}

function quotaDrafts(items: UserPlatformQuota[]) {
  const byPlatform = new Map(items.map((item) => [item.platform, item]));
  return USER_QUOTA_PLATFORMS.map((platform) => {
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

export function useUserLimits(user: AdminUser) {
  const config = useSnapshot(adminConfigState);
  const queryClient = useQueryClient();
  const serverScope = `${config.baseUrl}|${config.activeAccountId}`;
  const [concurrency, setConcurrency] = useState('1');
  const [rpmLimit, setRpmLimit] = useState('0');
  const [restrictGroups, setRestrictGroups] = useState(false);
  const [allowedGroupIds, setAllowedGroupIds] = useState<number[]>([]);
  const [limitsFeedback, setLimitsFeedback] = useState<UserLimitsFeedback | null>(null);
  const [quotaRows, setQuotaRows] = useState<UserQuotaDraft[]>(USER_QUOTA_PLATFORMS.map(emptyDraft));
  const [quotaFeedback, setQuotaFeedback] = useState<UserLimitsFeedback | null>(null);

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
    onError: (error) => setLimitsFeedback({
      message: getAdminRequestErrorMessage(error, '用户限制更新失败。'),
      tone: 'error',
    }),
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
    onError: (error) => setQuotaFeedback({
      message: getAdminRequestErrorMessage(error, '平台额度更新失败。'),
      tone: 'error',
    }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ platform, window }: { platform: UserPlatformQuotaPlatform; window: UserPlatformQuotaWindow }) =>
      resetUserPlatformQuotaWindow(user.id, platform, window),
    onSuccess: (result, variables) => {
      setQuotaRows(quotaDrafts(result.platform_quotas ?? []));
      setQuotaFeedback({ message: `${variables.platform} ${USER_QUOTA_WINDOW_LABELS[variables.window]}用量已重置。`, tone: 'success' });
    },
    onError: (error) => setQuotaFeedback({
      message: getAdminRequestErrorMessage(error, '重置平台用量失败。'),
      tone: 'error',
    }),
  });

  function toggleAllowedGroup(groupId: number) {
    setAllowedGroupIds((current) => current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]);
  }

  function updateQuotaRow(platform: UserPlatformQuotaPlatform, window: UserPlatformQuotaWindow, value: string) {
    setQuotaRows((current) => current.map((row) => row.platform === platform ? { ...row, [window]: value } : row));
  }

  function saveLimits() {
    setLimitsFeedback(null);
    limitsMutation.mutate();
  }

  function saveQuotas() {
    setQuotaFeedback(null);
    quotasMutation.mutate();
  }

  function resetQuota(platform: UserPlatformQuotaPlatform, window: UserPlatformQuotaWindow) {
    setQuotaFeedback(null);
    resetMutation.mutate({ platform, window });
  }

  return {
    concurrency,
    setConcurrency,
    rpmLimit,
    setRpmLimit,
    restrictGroups,
    setRestrictGroups,
    allowedGroupIds,
    limitsFeedback,
    quotaRows,
    quotaFeedback,
    groupsQuery,
    quotasQuery,
    limitsMutation,
    quotasMutation,
    resetMutation,
    toggleAllowedGroup,
    updateQuotaRow,
    saveLimits,
    saveQuotas,
    resetQuota,
  };
}

export type UserLimitsState = ReturnType<typeof useUserLimits>;
