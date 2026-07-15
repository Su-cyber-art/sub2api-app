import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getAdminRequestErrorMessage } from '@/src/lib/admin-error-message';
import { createTrendRange, fillTrendRange, formatTrendLabel, type TrendRangeKey } from '@/src/lib/trend-range';
import { getAdminSettings, getDashboardModels, getDashboardStats, getDashboardTrend, listAccounts } from '@/src/services/admin';
import { adminConfigState, hasAuthenticatedAdminSession } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

const RANGE_TITLE_MAP: Record<TrendRangeKey, string> = {
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
};

function hasAccountError(account: { status?: string; error_message?: string | null }) {
  return Boolean(account.status === 'error' || account.error_message);
}

function hasAccountRateLimited(account: {
  rate_limit_reset_at?: string | null;
  extra?: Record<string, unknown>;
}) {
  if (account.rate_limit_reset_at) {
    const resetTime = new Date(account.rate_limit_reset_at).getTime();
    if (!Number.isNaN(resetTime) && resetTime > Date.now()) return true;
  }

  const modelLimits = account.extra?.model_rate_limits;
  if (!modelLimits || typeof modelLimits !== 'object' || Array.isArray(modelLimits)) return false;

  const now = Date.now();
  return Object.values(modelLimits as Record<string, unknown>).some((info) => {
    if (!info || typeof info !== 'object' || Array.isArray(info)) return false;
    const resetAt = (info as { rate_limit_reset_at?: unknown }).rate_limit_reset_at;
    if (typeof resetAt !== 'string' || !resetAt.trim()) return false;
    const resetTime = new Date(resetAt).getTime();
    return !Number.isNaN(resetTime) && resetTime > now;
  });
}

export function useMonitorDashboard() {
  const config = useSnapshot(adminConfigState);
  const hasAccount = hasAuthenticatedAdminSession(config);
  const [rangeKey, setRangeKey] = useState<TrendRangeKey>('7d');
  const range = useMemo(() => createTrendRange(rangeKey), [rangeKey]);

  const statsQuery = useQuery({
    queryKey: ['monitor-stats'],
    queryFn: getDashboardStats,
    enabled: hasAccount,
    staleTime: 60_000,
  });
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getAdminSettings,
    enabled: hasAccount,
    staleTime: 120_000,
  });
  const accountsQuery = useQuery({
    queryKey: ['monitor-accounts'],
    queryFn: () => listAccounts(''),
    enabled: hasAccount,
    staleTime: 60_000,
  });
  const trendQuery = useQuery({
    queryKey: ['monitor-trend', rangeKey, range.query.start_date, range.query.end_date, range.query.granularity, range.query.timezone],
    queryFn: () => getDashboardTrend(range.query),
    enabled: hasAccount,
    staleTime: 60_000,
  });
  const modelsQuery = useQuery({
    queryKey: ['monitor-models', rangeKey, range.query.start_date, range.query.end_date, range.query.timezone],
    queryFn: () => getDashboardModels({
      start_date: range.query.start_date,
      end_date: range.query.end_date,
      timezone: range.query.timezone,
    }),
    enabled: hasAccount,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });

  async function refetchAll(): Promise<void> {
    await Promise.all([
      statsQuery.refetch(),
      settingsQuery.refetch(),
      accountsQuery.refetch(),
      trendQuery.refetch(),
      modelsQuery.refetch(),
    ]);
  }

  const stats = statsQuery.data;
  const siteName = settingsQuery.data?.site_name?.trim() || '管理控制台';
  const accounts = accountsQuery.data?.items ?? [];
  const trend = useMemo(
    () => fillTrendRange(trendQuery.data?.trend ?? [], range),
    [range, trendQuery.data?.trend]
  );
  const topModels = (modelsQuery.data?.models ?? []).slice(0, 5);
  const queryError = statsQuery.error ?? settingsQuery.error ?? accountsQuery.error ?? trendQuery.error ?? modelsQuery.error;
  const errorMessage = getAdminRequestErrorMessage(queryError, '当前无法加载概览数据，请检查服务地址、Token 和网络。');
  const currentPageErrorAccounts = accounts.filter(hasAccountError).length;
  const currentPageLimitedAccounts = accounts.filter((item) => hasAccountRateLimited(item)).length;
  const currentPageBusyAccounts = accounts.filter((item) => {
    if (hasAccountError(item) || hasAccountRateLimited(item)) return false;
    return (item.current_concurrency ?? 0) > 0;
  }).length;
  const totalAccounts = stats?.total_accounts ?? accountsQuery.data?.total ?? accounts.length;
  const errorAccounts = Math.max(stats?.error_accounts ?? 0, currentPageErrorAccounts);
  const healthyAccounts = stats?.normal_accounts ?? Math.max(totalAccounts - errorAccounts, 0);
  const latestTrendPoints = trend.slice(-6).reverse();
  const selectedTokenTotal = trend.reduce((sum, item) => sum + item.total_tokens, 0);
  const selectedCostTotal = trend.reduce((sum, item) => sum + item.cost, 0);
  const selectedOutputTotal = trend.reduce((sum, item) => sum + item.output_tokens, 0);
  const hasTrendData = Boolean(trendQuery.data?.trend?.length);

  const throughputPoints = useMemo(
    () => trend.map((item) => ({ label: formatTrendLabel(item.date, range.query.granularity), value: item.total_tokens })),
    [range.query.granularity, trend]
  );
  const requestPoints = useMemo(
    () => trend.map((item) => ({ label: formatTrendLabel(item.date, range.query.granularity), value: item.requests })),
    [range.query.granularity, trend]
  );
  const costPoints = useMemo(
    () => trend.map((item) => ({ label: formatTrendLabel(item.date, range.query.granularity), value: item.cost })),
    [range.query.granularity, trend]
  );

  return {
    hasAccount,
    rangeKey,
    setRangeKey,
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
    rangeTitle: RANGE_TITLE_MAP[rangeKey],
    hasTrendData,
    isLoading: statsQuery.isLoading || settingsQuery.isLoading || accountsQuery.isLoading,
    hasError: Boolean(queryError),
    throughputPoints,
    requestPoints,
    costPoints,
    totalInputTokens: trend.reduce((sum, item) => sum + item.input_tokens, 0),
    totalOutputTokens: trend.reduce((sum, item) => sum + item.output_tokens, 0),
    totalCacheReadTokens: trend.reduce((sum, item) => sum + item.cache_read_tokens, 0),
    isRefreshing: statsQuery.isRefetching || settingsQuery.isRefetching || accountsQuery.isRefetching || trendQuery.isRefetching || modelsQuery.isRefetching,
    refetchAll,
  };
}

export type MonitorDashboardState = ReturnType<typeof useMonitorDashboard>;
