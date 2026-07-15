import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { createTrendRange, fillTrendRange, formatTrendLabel, type TrendRangeKey } from '@/src/lib/trend-range';
import { deleteUser, getDashboardSnapshot, getUsageStats, getUser, listUserApiKeys, updateUserBalance, updateUserStatus } from '@/src/services/admin';
import type { AdminApiKey, BalanceOperation } from '@/src/types/admin';

export function getUserDetailErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    switch (error.message) {
      case 'BASE_URL_REQUIRED':
        return '请先到服务器页填写服务地址。';
      case 'ADMIN_API_KEY_REQUIRED':
        return '请先到服务器页填写 Admin Token。';
      default:
        return error.message;
    }
  }
  return '加载失败，请稍后重试。';
}

async function confirmUserDelete(email: string) {
  const message = `确认删除用户“${email}”吗？该操作无法撤销。`;
  if (Platform.OS === 'web') {
    return typeof globalThis.confirm === 'function' ? globalThis.confirm(`删除用户\n\n${message}`) : false;
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert('删除用户', message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '确认删除', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function useUserDetail(userId: number) {
  const queryClient = useQueryClient();
  const [operation, setOperation] = useState<BalanceOperation>('add');
  const [amount, setAmount] = useState('10');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);
  const [rangeKey, setRangeKey] = useState<TrendRangeKey>('7d');
  const range = useMemo(() => createTrendRange(rangeKey), [rangeKey]);

  const userQuery = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
    enabled: Number.isFinite(userId),
  });
  const apiKeysQuery = useQuery({
    queryKey: ['user-api-keys', userId],
    queryFn: () => listUserApiKeys(userId),
    enabled: Number.isFinite(userId),
  });
  const usageStatsQuery = useQuery({
    queryKey: ['usage-stats', 'user', userId, rangeKey, range.query.start_date, range.query.end_date, range.query.timezone],
    queryFn: () => getUsageStats({ ...range.query, user_id: userId }),
    enabled: Number.isFinite(userId),
  });
  const usageSnapshotQuery = useQuery({
    queryKey: ['usage-snapshot', 'user', userId, rangeKey, range.query.start_date, range.query.end_date, range.query.granularity, range.query.timezone],
    queryFn: () => getDashboardSnapshot({
      ...range.query,
      user_id: userId,
      include_stats: false,
      include_trend: true,
      include_model_stats: false,
      include_group_stats: false,
      include_users_trend: false,
    }),
    enabled: Number.isFinite(userId),
  });

  const balanceMutation = useMutation({
    mutationFn: (payload: { amount: number; notes?: string; operation: BalanceOperation }) => updateUserBalance(userId, {
      balance: payload.amount,
      notes: payload.notes,
      operation: payload.operation,
    }),
    onSuccess: () => {
      setFormError(null);
      setAmount('10');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['user', userId] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => setFormError(getUserDetailErrorMessage(error)),
  });
  const statusMutation = useMutation({
    mutationFn: (status: 'active' | 'disabled') => updateUserStatus(userId, status),
    onSuccess: () => {
      setStatusError(null);
      void queryClient.invalidateQueries({ queryKey: ['user', userId] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => setStatusError(getUserDetailErrorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(userId),
    onSuccess: async () => {
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.removeQueries({ queryKey: ['user', userId] });
      router.replace('/(tabs)/users');
    },
    onError: (error) => setDeleteError(getUserDetailErrorMessage(error)),
  });

  const user = userQuery.data;
  const apiKeys = apiKeysQuery.data?.items ?? [];
  const filteredApiKeys = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return apiKeys.filter((item) => {
      const haystack = [item.name, item.key, item.group?.name].filter(Boolean).join(' ').toLowerCase();
      return keyword ? haystack.includes(keyword) : true;
    });
  }, [apiKeys, searchText]);
  const normalizedTrend = useMemo(
    () => fillTrendRange(usageSnapshotQuery.data?.trend ?? [], range),
    [range, usageSnapshotQuery.data?.trend]
  );
  const trendPoints = useMemo(
    () => normalizedTrend.map((item) => ({ label: formatTrendLabel(item.date, range.query.granularity), value: item.total_tokens })),
    [normalizedTrend, range.query.granularity]
  );

  function submitBalance() {
    const numericAmount = Number(amount);
    if (!amount.trim()) {
      setFormError('请输入金额。');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setFormError('金额格式不正确。');
      return;
    }
    balanceMutation.mutate({ amount: numericAmount, notes: notes.trim() || undefined, operation });
  }

  async function copyKey(item: AdminApiKey) {
    await Clipboard.setStringAsync(item.key || '');
    setCopiedKeyId(item.id);
    setTimeout(() => setCopiedKeyId((current) => current === item.id ? null : current), 1500);
  }

  function toggleUserStatus() {
    if (!user) return;
    const nextStatus: 'active' | 'disabled' = user.status === 'disabled' ? 'active' : 'disabled';
    const actionLabel = nextStatus === 'disabled' ? '禁用' : '启用';
    Alert.alert(`${actionLabel}用户`, `确认要${actionLabel}该用户吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: nextStatus === 'disabled' ? 'destructive' : 'default',
        onPress: () => {
          setStatusError(null);
          statusMutation.mutate(nextStatus);
        },
      },
    ]);
  }

  async function removeUser() {
    if (!user || user.role?.toLowerCase() === 'admin') return;
    setDeleteError(null);
    if (await confirmUserDelete(user.email)) deleteMutation.mutate();
  }

  return {
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
    toggleUserStatus,
    removeUser,
  };
}

export type UserDetailState = ReturnType<typeof useUserDetail>;
