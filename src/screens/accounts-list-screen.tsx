import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Activity,
  CheckSquare2,
  ChevronDown,
  ChevronUp,
  CircleX,
  Copy,
  Clock,
  Gauge,
  KeyRound,
  ListChecks,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShieldOff,
  Square,
  Trash2,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { AccountEditModal } from '@/src/components/account-edit-modal';
import { ListCard } from '@/src/components/list-card';
import { ScreenShell } from '@/src/components/screen-shell';
import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { getAdminRequestErrorMessage } from '@/src/lib/admin-error-message';
import { isAdminApiError } from '@/src/lib/admin-fetch';
import { formatTokenValue } from '@/src/lib/formatters';
import {
  batchClearAccountErrors,
  batchRefreshAccounts,
  bulkUpdateAccounts,
  clearAccountError,
  clearAccountRateLimit,
  clearAccountTempUnschedulable,
  deleteAccount,
  duplicateAccount,
  getAccountTodayStats,
  getBatchAccountTodayStats,
  getSystemVersion,
  listAccounts,
  listGroups,
  recoverAccountState,
  setAccountSchedulable,
  testAccount,
  updateAccount,
} from '@/src/services/admin';
import { adminConfigState } from '@/src/store/admin-config';
import type { AccountTodayStats, AdminAccount, BatchAccountTodayStats, UpdateAccountRequest } from '@/src/types/admin';

const { useSnapshot } = require('valtio/react');

type AccountStatusFilter = 'all' | 'active' | 'paused' | 'error';
type UsageSort = 'usage-desc' | 'usage-asc';
type AccountVisualStatus = {
  filterKey: AccountStatusFilter;
  label: '正常' | '暂停' | '异常';
  badgeTone: 'success' | 'muted' | 'danger';
};

type AccountTodaySummary = {
  requests: number;
  tokens: number;
  cost: number;
};

type RecoveryAction = 'recover-state' | 'clear-error' | 'clear-rate-limit' | 'clear-temp-unschedulable';
type RecoveryFeedback = {
  message: string;
  tone: 'success' | 'error';
};
type AccountStatsResult = BatchAccountTodayStats & {
  source: 'batch' | 'legacy';
};
type BatchAction = 'pause' | 'resume' | 'clear-error' | 'refresh';

async function confirmAccountAction(title: string, message: string, destructive = false) {
  if (Platform.OS === 'web') {
    return typeof globalThis.confirm === 'function' ? globalThis.confirm(`${title}\n\n${message}`) : false;
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '确认', style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

const recoveryActions: Array<{
  key: RecoveryAction;
  label: string;
  description: string;
  icon: typeof RefreshCw;
}> = [
  { key: 'recover-state', label: '恢复状态', description: '重置账号运行状态并重新参与调度。', icon: RefreshCw },
  { key: 'clear-error', label: '清除错误', description: '清除账号当前记录的错误状态。', icon: CircleX },
  { key: 'clear-rate-limit', label: '清除限流', description: '立即清除账号的限流等待状态。', icon: Gauge },
  { key: 'clear-temp-unschedulable', label: '解除临时停用', description: '移除账号的临时不可调度状态。', icon: Clock },
];

const batchActions: Array<{ key: BatchAction; label: string; icon: typeof RefreshCw }> = [
  { key: 'pause', label: '暂停', icon: Pause },
  { key: 'resume', label: '恢复', icon: Play },
  { key: 'clear-error', label: '清错', icon: CircleX },
  { key: 'refresh', label: '刷新', icon: RefreshCw },
];

function isUnavailableEndpoint(error: unknown) {
  return isAdminApiError(error) && [404, 405, 501].includes(error.status);
}

async function loadAccountTodayStats(accountIds: number[]): Promise<AccountStatsResult> {
  try {
    const result = await getBatchAccountTodayStats(accountIds);
    return { ...result, source: 'batch' };
  } catch (error) {
    if (!isUnavailableEndpoint(error)) {
      throw error;
    }

    const results = await Promise.allSettled(
      accountIds.map(async (accountId) => [String(accountId), await getAccountTodayStats(accountId)] as const)
    );
    const stats: Record<string, AccountTodayStats> = {};
    let firstError: unknown;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        stats[result.value[0]] = result.value[1];
      } else if (!firstError) {
        firstError = result.reason;
      }
    });

    if (Object.keys(stats).length === 0 && firstError) {
      throw firstError;
    }

    return { stats, source: 'legacy' };
  }
}

function formatServerVersion(version?: string) {
  const value = version?.trim();
  if (!value) return '';
  return value.toLowerCase().startsWith('v') ? value : `v${value}`;
}

function formatTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getAccountError(account: AdminAccount) {
  return Boolean(account.status === 'error' || account.error_message);
}

function getAccountVisualStatus(account: AdminAccount): AccountVisualStatus {
  const normalizedStatus = `${account.status ?? ''}`.toLowerCase();
  const isPausedStatus = ['inactive', 'disabled', 'paused', 'stop', 'stopped'].includes(normalizedStatus);

  if (getAccountError(account)) {
    return { filterKey: 'error', label: '异常', badgeTone: 'danger' };
  }
  if (isPausedStatus || account.schedulable === false) {
    return { filterKey: 'paused', label: '暂停', badgeTone: 'muted' };
  }
  return { filterKey: 'active', label: '正常', badgeTone: 'success' };
}

type AccountsListScreenProps = {
  safeAreaEdges?: Edge[];
};

export function AccountsListScreen({ safeAreaEdges }: AccountsListScreenProps) {
  const config = useSnapshot(adminConfigState);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<AccountStatusFilter>('all');
  const [usageSort, setUsageSort] = useState<UsageSort>('usage-desc');
  const [testingAccountId, setTestingAccountId] = useState<number | null>(null);
  const [testFeedbackByAccountId, setTestFeedbackByAccountId] = useState<Record<number, string>>({});
  const [togglingAccountId, setTogglingAccountId] = useState<number | null>(null);
  const [expandedRecoveryAccountId, setExpandedRecoveryAccountId] = useState<number | null>(null);
  const [recoveringAccountId, setRecoveringAccountId] = useState<number | null>(null);
  const [recoveryFeedbackByAccountId, setRecoveryFeedbackByAccountId] = useState<Record<number, RecoveryFeedback>>({});
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(() => new Set());
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [editError, setEditError] = useState('');
  const [listActionFeedback, setListActionFeedback] = useState<RecoveryFeedback | null>(null);
  const keyword = useDebouncedValue(searchText.trim(), 300);
  const queryClient = useQueryClient();
  const serverScope = config.activeAccountId || config.baseUrl;

  const versionQuery = useQuery({
    queryKey: ['system-version', serverScope],
    queryFn: getSystemVersion,
    enabled: Boolean(config.baseUrl.trim() && config.adminApiKey.trim()),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const accountsQuery = useInfiniteQuery({
    queryKey: ['accounts', serverScope, keyword],
    queryFn: ({ pageParam }) => listAccounts(keyword, pageParam, 20),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });

  const groupsQuery = useQuery({
    queryKey: ['groups', serverScope, 'account-editor'],
    queryFn: () => listGroups('', 1, 100),
    enabled: editingAccount !== null,
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ accountId, schedulable }: { accountId: number; schedulable: boolean }) =>
      setAccountSchedulable(accountId, schedulable),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts', serverScope] }),
  });

  const testMutation = useMutation({
    mutationFn: (accountId: number) => testAccount(accountId),
  });

  const recoveryMutation = useMutation({
    mutationFn: ({ accountId, action }: { accountId: number; action: RecoveryAction }) => {
      switch (action) {
        case 'recover-state':
          return recoverAccountState(accountId);
        case 'clear-error':
          return clearAccountError(accountId);
        case 'clear-rate-limit':
          return clearAccountRateLimit(accountId);
        case 'clear-temp-unschedulable':
          return clearAccountTempUnschedulable(accountId);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts', serverScope] }),
        queryClient.invalidateQueries({ queryKey: ['account-today-stats', serverScope] }),
      ]);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ accountId, body }: { accountId: number; body: UpdateAccountRequest }) => {
      const { schedulable, ...updates } = body;
      const account = await updateAccount(accountId, updates);
      if (typeof schedulable === 'boolean' && account.schedulable !== schedulable) {
        return setAccountSchedulable(accountId, schedulable);
      }
      return account;
    },
    onSuccess: async () => {
      setEditingAccount(null);
      setEditError('');
      setListActionFeedback({ message: '账号配置已更新。', tone: 'success' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['account-today-stats', serverScope] }),
      ]);
    },
    onError: (error) => setEditError(getAdminRequestErrorMessage(error, '更新账号失败。')),
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateAccount,
    onSuccess: async (account) => {
      setListActionFeedback({ message: `已复制为“${account.name}”。`, tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error) => setListActionFeedback({ message: getAdminRequestErrorMessage(error, '复制账号失败。'), tone: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      setListActionFeedback({ message: '账号已删除。', tone: 'success' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['account-today-stats', serverScope] }),
      ]);
    },
    onError: (error) => setListActionFeedback({ message: getAdminRequestErrorMessage(error, '删除账号失败。'), tone: 'error' }),
  });

  const batchMutation = useMutation({
    mutationFn: async ({ action, accountIds }: { action: BatchAction; accountIds: number[] }) => {
      const result = action === 'pause'
        ? await bulkUpdateAccounts({ account_ids: accountIds, schedulable: false })
        : action === 'resume'
          ? await bulkUpdateAccounts({ account_ids: accountIds, schedulable: true })
          : action === 'clear-error'
            ? await batchClearAccountErrors(accountIds)
            : await batchRefreshAccounts(accountIds);
      return { success: result.success, failed: result.failed };
    },
    onSuccess: async (result, variables) => {
      const actionLabel: Record<BatchAction, string> = {
        pause: '暂停调度',
        resume: '恢复调度',
        'clear-error': '清除错误',
        refresh: '刷新凭据',
      };
      setListActionFeedback({
        message: `${actionLabel[variables.action]}完成：成功 ${result.success}，失败 ${result.failed}。`,
        tone: result.failed > 0 ? 'error' : 'success',
      });
      setSelectedAccountIds(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['account-today-stats', serverScope] }),
      ]);
    },
    onError: (error) => setListActionFeedback({ message: getAdminRequestErrorMessage(error, '批量操作失败。'), tone: 'error' }),
  });

  const items = useMemo(() => accountsQuery.data?.pages.flatMap((page) => page.items) ?? [], [accountsQuery.data]);
  const accountIds = useMemo(() => items.map((account) => account.id), [items]);
  const accountStatsQuery = useQuery({
    queryKey: ['account-today-stats', serverScope, accountIds],
    queryFn: () => loadAccountTodayStats(accountIds),
    enabled: accountIds.length > 0,
    staleTime: 60_000,
  });

  const todayByAccountId = useMemo(() => {
    const next = new Map<number, AccountTodaySummary>();
    items.forEach((account) => {
      const result = accountStatsQuery.data?.stats[String(account.id)];
      const fromStatsCost = typeof result?.cost === 'number' && Number.isFinite(result.cost) ? result.cost : undefined;
      const fromExtra = typeof account.extra?.today_cost === 'number' ? account.extra.today_cost : undefined;
      const cost = fromStatsCost ?? fromExtra ?? 0;
      const requests = typeof result?.requests === 'number' && Number.isFinite(result.requests) ? result.requests : 0;
      const tokens = typeof result?.tokens === 'number' && Number.isFinite(result.tokens) ? result.tokens : 0;
      next.set(account.id, { requests, tokens, cost });
    });
    return next;
  }, [accountStatsQuery.data?.stats, items]);

  const filteredItems = useMemo(() => {
    const statusMatched = items.filter((account) => {
      const visualStatus = getAccountVisualStatus(account);
      if (filter === 'all') return true;
      if (filter === 'active') return visualStatus.filterKey === 'active';
      if (filter === 'paused') return visualStatus.filterKey === 'paused';
      if (filter === 'error') return visualStatus.filterKey === 'error';
      return true;
    });

    const sorted = [...statusMatched].sort((left, right) => {
      const requestsLeft = todayByAccountId.get(left.id)?.requests ?? 0;
      const requestsRight = todayByAccountId.get(right.id)?.requests ?? 0;
      if (requestsLeft === requestsRight) {
        const tokensLeft = todayByAccountId.get(left.id)?.tokens ?? 0;
        const tokensRight = todayByAccountId.get(right.id)?.tokens ?? 0;
        return tokensLeft - tokensRight;
      }
      if (usageSort === 'usage-asc') return requestsLeft - requestsRight;
      return requestsRight - requestsLeft;
    });

    return sorted;
  }, [filter, items, todayByAccountId, usageSort]);
  const selectedIds = useMemo(() => Array.from(selectedAccountIds), [selectedAccountIds]);

  function toggleAccountSelection(accountId: number) {
    setSelectedAccountIds((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => {
      if (current) setSelectedAccountIds(new Set());
      return !current;
    });
    setListActionFeedback(null);
  }

  function selectVisibleAccounts() {
    const visibleIds = filteredItems.map((account) => account.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedAccountIds.has(id));
    setSelectedAccountIds(allSelected ? new Set() : new Set(visibleIds));
  }

  async function handleDuplicateAccount(account: AdminAccount) {
    setListActionFeedback(null);
    if (await confirmAccountAction('复制账号', `确认复制“${account.name}”吗？服务端会保留现有凭据并创建一个新账号。`)) {
      duplicateMutation.mutate(account.id);
    }
  }

  async function handleDeleteAccount(account: AdminAccount) {
    setListActionFeedback(null);
    if (await confirmAccountAction('删除账号', `确认删除“${account.name}”吗？此操作无法撤销。`, true)) {
      deleteMutation.mutate(account.id);
    }
  }

  async function handleBatchAction(action: BatchAction) {
    if (selectedIds.length === 0) return;
    const descriptions: Record<BatchAction, { title: string; message: string; destructive?: boolean }> = {
      pause: { title: '批量暂停调度', message: `确认暂停所选 ${selectedIds.length} 个账号的调度吗？`, destructive: true },
      resume: { title: '批量恢复调度', message: `确认恢复所选 ${selectedIds.length} 个账号的调度吗？` },
      'clear-error': { title: '批量清除错误', message: `确认清除所选 ${selectedIds.length} 个账号的错误状态吗？` },
      refresh: { title: '批量刷新凭据', message: `确认刷新所选 ${selectedIds.length} 个账号吗？该操作可能需要较长时间。` },
    };
    const description = descriptions[action];
    setListActionFeedback(null);
    if (await confirmAccountAction(description.title, description.message, description.destructive)) {
      batchMutation.mutate({ action, accountIds: selectedIds });
    }
  }

  const errorMessage = accountsQuery.error
    ? getAdminRequestErrorMessage(accountsQuery.error, '账号列表加载失败。')
    : '';

  const summary = useMemo(() => {
    const total = accountsQuery.data?.pages[0]?.total ?? items.length;
    const loaded = items.length;
    const errors = items.filter((item) => getAccountVisualStatus(item).filterKey === 'error').length;
    const paused = items.filter((item) => getAccountVisualStatus(item).filterKey === 'paused').length;
    const active = items.filter((item) => getAccountVisualStatus(item).filterKey === 'active').length;
    return { total, loaded, active, paused, errors };
  }, [accountsQuery.data, items]);

  const serverVersion = formatServerVersion(versionQuery.data?.version);
  const serverVersionLabel = serverVersion
    ? `服务端 ${serverVersion}`
    : versionQuery.fetchStatus === 'fetching'
      ? '正在检测服务端版本'
      : isUnavailableEndpoint(versionQuery.error)
        ? '旧版服务端（无版本接口）'
        : '服务端版本未知';
  const statsModeLabel = accountStatsQuery.data?.source === 'batch'
    ? '批量统计'
    : accountStatsQuery.data?.source === 'legacy'
      ? '兼容统计'
      : accountStatsQuery.fetchStatus === 'fetching'
        ? '统计加载中'
        : accountStatsQuery.isError
          ? '统计不可用'
          : '等待统计';

  const confirmRecoveryAction = useCallback(
    (account: AdminAccount, action: RecoveryAction) => {
      const actionConfig = recoveryActions.find((item) => item.key === action);
      if (!actionConfig) return;

      const confirmationMessage = `确认对“${account.name}”执行此操作吗？\n${actionConfig.description}`;
      const execute = () => {
        setRecoveringAccountId(account.id);
        setRecoveryFeedbackByAccountId((current) => {
          const next = { ...current };
          delete next[account.id];
          return next;
        });
        recoveryMutation.mutate(
          { accountId: account.id, action },
          {
            onSuccess: () => {
              setRecoveryFeedbackByAccountId((current) => ({
                ...current,
                [account.id]: { message: `${actionConfig.label}完成`, tone: 'success' },
              }));
            },
            onError: (error) => {
              const message = error instanceof Error && error.message ? error.message : `${actionConfig.label}失败`;
              setRecoveryFeedbackByAccountId((current) => ({
                ...current,
                [account.id]: { message, tone: 'error' },
              }));
            },
            onSettled: () => {
              setRecoveringAccountId((current) => (current === account.id ? null : current));
            },
          }
        );
      };

      if (Platform.OS === 'web') {
        if (globalThis.confirm(`${actionConfig.label}\n\n${confirmationMessage}`)) {
          execute();
        }
        return;
      }

      Alert.alert(actionConfig.label, confirmationMessage, [
        { text: '取消', style: 'cancel' },
        { text: '确认执行', onPress: execute },
      ]);
    },
    [recoveryMutation]
  );

  const listHeader = (
    <View className="pb-2">
      <View className="mb-3 flex-row items-center justify-between gap-3 px-1">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Server color="#1d5f55" size={16} />
          <Text className="flex-1 text-xs font-semibold text-[#4e463e]" numberOfLines={1}>{serverVersionLabel}</Text>
        </View>
        <Text className="text-xs text-[#7d7468]">{statsModeLabel}</Text>
      </View>
      <View className="rounded-[24px] bg-[#fbf8f2] p-2.5">
        <View className="flex-row items-center rounded-[18px] bg-[#f1ece2] px-4 py-3">
          <Search color="#7d7468" size={18} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="搜索账号名称 / 平台"
            placeholderTextColor="#9b9081"
            className="ml-3 flex-1 text-base text-[#16181a]"
          />
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {([
            ['all', `全部 ${summary.loaded}/${summary.total}`],
            ['active', `正常 ${summary.active}`],
            ['paused', `暂停 ${summary.paused}`],
            ['error', `异常 ${summary.errors}`],
          ] as const).map(([key, label]) => {
            const active = filter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                className={active ? 'rounded-full bg-[#1d5f55] px-3 py-2' : 'rounded-full bg-[#e7dfcf] px-3 py-2'}
              >
                <Text className={active ? 'text-xs font-semibold text-white' : 'text-xs font-semibold text-[#4e463e]'}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          {([
            ['usage-desc', '请求高→低'],
            ['usage-asc', '请求低→高'],
          ] as const).map(([key, label]) => {
            const active = usageSort === key;
            return (
              <Pressable
                key={key}
                onPress={() => setUsageSort(key)}
                className={active ? 'rounded-full bg-[#4e463e] px-3 py-3' : 'rounded-full bg-[#e7dfcf] px-3 py-3'}
              >
                <Text className={active ? 'text-xs font-semibold text-white' : 'text-xs font-semibold text-[#4e463e]'}>{label}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={toggleSelectionMode}
            accessibilityRole="button"
            accessibilityLabel={selectionMode ? '退出批量选择' : '进入批量选择'}
            className={selectionMode ? 'min-h-10 flex-row items-center gap-2 rounded-[8px] bg-[#1d5f55] px-3' : 'min-h-10 flex-row items-center gap-2 rounded-[8px] bg-[#e6f4ee] px-3'}
          >
            <ListChecks color={selectionMode ? '#fff' : '#1d5f55'} size={16} />
            <Text className={selectionMode ? 'text-xs font-bold text-white' : 'text-xs font-bold text-[#1d5f55]'}>{selectionMode ? '退出批量' : '批量操作'}</Text>
          </Pressable>
        </View>

        {selectionMode ? (
          <View className="mt-3 gap-2 border-t border-[#e3dacb] pt-3">
            <View className="flex-row items-center justify-between gap-3">
              <Pressable onPress={selectVisibleAccounts} className="min-h-9 flex-row items-center gap-2 rounded-[8px] bg-[#f1ece2] px-3">
                <CheckSquare2 color="#4e463e" size={15} />
                <Text className="text-xs font-bold text-[#4e463e]">全选当前列表</Text>
              </Pressable>
              <Text className="text-xs font-semibold text-[#71685d]">已选 {selectedIds.length}</Text>
            </View>
            {selectedIds.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {batchActions.map((action) => {
                  const ActionIcon = action.icon;
                  const pending = batchMutation.isPending && batchMutation.variables?.action === action.key;
                  return (
                    <Pressable
                      key={action.key}
                      disabled={batchMutation.isPending}
                      onPress={() => void handleBatchAction(action.key)}
                      className="min-h-10 w-[48%] flex-row items-center justify-center gap-2 rounded-[8px] bg-[#e7dfcf] px-2"
                      style={{ opacity: batchMutation.isPending && !pending ? 0.5 : 1 }}
                    >
                      {pending ? <ActivityIndicator color="#4e463e" size="small" /> : <ActionIcon color="#4e463e" size={15} />}
                      <Text className="text-xs font-bold text-[#4e463e]">{pending ? '处理中' : action.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        {listActionFeedback ? (
          <Text className={listActionFeedback.tone === 'success' ? 'mt-3 rounded-[8px] bg-[#e6f4ee] p-3 text-xs text-[#1d5f55]' : 'mt-3 rounded-[8px] bg-[#fbebe4] p-3 text-xs text-[#b45131]'}>
            {listActionFeedback.message}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderItem = ({ item: account }: { item: (typeof filteredItems)[number] }) => {
      const isError = getAccountError(account);
      const visualStatus = getAccountVisualStatus(account);
      const statusText = visualStatus.label;
      const groupsText = account.groups?.map((group) => group.name).filter(Boolean).slice(0, 3).join(' · ');
      const todayStats = todayByAccountId.get(account.id) ?? { requests: 0, tokens: 0, cost: 0 };
      const nextSchedulable = visualStatus.filterKey === 'paused';
      const toggleLabel = nextSchedulable ? '恢复' : '暂停';
      const testFeedback = testFeedbackByAccountId[account.id];
      const recoveryFeedback = recoveryFeedbackByAccountId[account.id];
      const recoveryExpanded = expandedRecoveryAccountId === account.id;
      const isTogglingCurrent = togglingAccountId === account.id && toggleMutation.isPending;
      const isTestingCurrent = testingAccountId === account.id && testMutation.isPending;
      const isRecoveringCurrent = recoveringAccountId === account.id && recoveryMutation.isPending;
      const isSelected = selectedAccountIds.has(account.id);
      const isDuplicatingCurrent = duplicateMutation.isPending && duplicateMutation.variables === account.id;
      const isDeletingCurrent = deleteMutation.isPending && deleteMutation.variables === account.id;

      return (
        <View>
          <ListCard
            title={account.name}
            meta={`${account.platform} · ${account.type}`}
            badge={statusText}
            badgeTone={visualStatus.badgeTone}
            icon={KeyRound}
          >
            <View className="gap-3">
              {selectionMode ? (
                <Pressable
                  onPress={() => toggleAccountSelection(account.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${isSelected ? '取消选择' : '选择'}账号 ${account.name}`}
                  className={isSelected ? 'min-h-10 flex-row items-center gap-2 rounded-[8px] bg-[#e6f4ee] px-3' : 'min-h-10 flex-row items-center gap-2 rounded-[8px] bg-[#f1ece2] px-3'}
                >
                  {isSelected ? <CheckSquare2 color="#1d5f55" size={17} /> : <Square color="#71685d" size={17} />}
                  <Text className={isSelected ? 'text-xs font-bold text-[#1d5f55]' : 'text-xs font-bold text-[#71685d]'}>{isSelected ? '已选择' : '加入批量操作'}</Text>
                </Pressable>
              ) : null}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  {account.schedulable && !isError ? <ShieldCheck color="#7d7468" size={14} /> : <ShieldOff color="#7d7468" size={14} />}
                  <Text className="text-sm text-[#7d7468]">状态：{statusText}</Text>
                </View>
                <Text className="text-xs text-[#7d7468]">最近使用 {formatTime(account.last_used_at || account.updated_at)}</Text>
              </View>

              <View className="flex-row gap-2">
                <View className="flex-1 rounded-[14px] bg-[#f1ece2] px-3 py-3">
                  <Text className="text-[11px] text-[#7d7468]">请求次数</Text>
                  <Text className="mt-1 text-sm font-bold text-[#16181a]">{todayStats.requests}</Text>
                </View>
                <View className="flex-1 rounded-[14px] bg-[#f1ece2] px-3 py-3">
                  <Text className="text-[11px] text-[#7d7468]">消费金额</Text>
                  <Text className="mt-1 text-sm font-bold text-[#16181a]">${todayStats.cost.toFixed(2)}</Text>
                </View>
                <View className="flex-1 rounded-[14px] bg-[#f1ece2] px-3 py-3">
                  <Text className="text-[11px] text-[#7d7468]">token消耗</Text>
                  <Text className="mt-1 text-sm font-bold text-[#16181a]">{formatTokenValue(todayStats.tokens)}</Text>
                </View>
              </View>

              <Text className="text-xs text-[#7d7468]">优先级 {account.priority ?? 0} · 倍率 {(account.rate_multiplier ?? 1).toFixed(2)}x</Text>

              {groupsText ? <Text className="text-xs text-[#7d7468]">分组 {groupsText}</Text> : null}
              {account.error_message ? <Text className="text-xs text-[#a4512b]">异常信息：{account.error_message}</Text> : null}

              <View className="flex-row gap-2">
                <Pressable
                  className="min-h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-[#1b1d1f] px-3 py-2"
                  disabled={isTestingCurrent}
                  onPress={(event) => {
                    event.stopPropagation();
                    setTestingAccountId(account.id);
                    testMutation.mutate(account.id, {
                      onSuccess: () => {
                        setTestFeedbackByAccountId((current) => ({ ...current, [account.id]: '测试成功' }));
                      },
                      onError: (error) => {
                        const message = error instanceof Error && error.message ? error.message : '测试失败';
                        setTestFeedbackByAccountId((current) => ({ ...current, [account.id]: message }));
                      },
                      onSettled: () => {
                        setTestingAccountId((current) => (current === account.id ? null : current));
                      },
                    });
                  }}
                >
                  <Activity color="#f6f1e8" size={14} />
                  <Text className="text-xs font-semibold text-[#f6f1e8]">{isTestingCurrent ? '测试中...' : '测试'}</Text>
                </Pressable>
                <Pressable
                  className="min-h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-[#e7dfcf] px-3 py-2"
                  disabled={isTogglingCurrent}
                  onPress={(event) => {
                    event.stopPropagation();
                    setTogglingAccountId(account.id);
                    toggleMutation.mutate({
                      accountId: account.id,
                      schedulable: nextSchedulable,
                    }, {
                      onSettled: () => {
                        setTogglingAccountId((current) => (current === account.id ? null : current));
                      },
                      onError: (error) => {
                        const message = error instanceof Error && error.message ? error.message : `${toggleLabel}失败`;
                        setRecoveryFeedbackByAccountId((current) => ({
                          ...current,
                          [account.id]: { message, tone: 'error' },
                        }));
                      },
                    });
                  }}
                >
                  {nextSchedulable ? <Play color="#4e463e" size={14} /> : <Pause color="#4e463e" size={14} />}
                  <Text className="text-xs font-semibold text-[#4e463e]">{isTogglingCurrent ? '处理中...' : toggleLabel}</Text>
                </Pressable>
                <Pressable
                  className="min-h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-[#e7dfcf] px-3 py-2"
                  onPress={(event) => {
                    event.stopPropagation();
                    setExpandedRecoveryAccountId((current) => (current === account.id ? null : account.id));
                  }}
                >
                  <Wrench color="#4e463e" size={14} />
                  <Text className="text-xs font-semibold text-[#4e463e]">应急</Text>
                  {recoveryExpanded ? <ChevronUp color="#4e463e" size={13} /> : <ChevronDown color="#4e463e" size={13} />}
                </Pressable>
              </View>

              <View className="flex-row gap-2">
                <Pressable
                  disabled={editMutation.isPending}
                  onPress={() => {
                    setEditError('');
                    setEditingAccount(account);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`编辑账号 ${account.name}`}
                  className="min-h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-[8px] bg-[#e6f4ee] px-2"
                >
                  <Pencil color="#1d5f55" size={14} />
                  <Text className="text-xs font-semibold text-[#1d5f55]">编辑</Text>
                </Pressable>
                <Pressable
                  disabled={duplicateMutation.isPending || deleteMutation.isPending}
                  onPress={() => void handleDuplicateAccount(account)}
                  accessibilityRole="button"
                  accessibilityLabel={`复制账号 ${account.name}`}
                  className="min-h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-[8px] bg-[#e7dfcf] px-2"
                >
                  {isDuplicatingCurrent ? <ActivityIndicator color="#4e463e" size="small" /> : <Copy color="#4e463e" size={14} />}
                  <Text className="text-xs font-semibold text-[#4e463e]">{isDuplicatingCurrent ? '复制中' : '复制'}</Text>
                </Pressable>
                <Pressable
                  disabled={deleteMutation.isPending || duplicateMutation.isPending}
                  onPress={() => void handleDeleteAccount(account)}
                  accessibilityRole="button"
                  accessibilityLabel={`删除账号 ${account.name}`}
                  className="min-h-10 w-11 items-center justify-center rounded-[8px] bg-[#fbebe4]"
                >
                  {isDeletingCurrent ? <ActivityIndicator color="#b45131" size="small" /> : <Trash2 color="#b45131" size={15} />}
                </Pressable>
              </View>

              {recoveryExpanded ? (
                <View className="border-t border-[#e7dfcf] pt-3">
                  <Text className="text-xs font-semibold text-[#4e463e]">账号应急操作</Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {recoveryActions.map((action) => {
                      const ActionIcon = action.icon;
                      const isActionPending = isRecoveringCurrent && recoveryMutation.variables?.action === action.key;
                      return (
                        <Pressable
                          key={action.key}
                          className="min-h-11 w-[48%] flex-row items-center justify-center gap-2 rounded-[12px] bg-[#f1ece2] px-2 py-2"
                          disabled={recoveryMutation.isPending}
                          style={{ opacity: recoveryMutation.isPending && !isActionPending ? 0.5 : 1 }}
                          onPress={(event) => {
                            event.stopPropagation();
                            confirmRecoveryAction(account, action.key);
                          }}
                        >
                          <ActionIcon color="#4e463e" size={14} />
                          <Text className="text-[11px] font-semibold text-[#4e463e]">{isActionPending ? '处理中...' : action.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {testFeedback ? <Text className="text-xs text-[#1d5f55]">测试结果：{testFeedback}</Text> : null}
              {recoveryFeedback ? (
                <Text className={recoveryFeedback.tone === 'success' ? 'text-xs text-[#1d5f55]' : 'text-xs text-[#a4512b]'}>
                  操作结果：{recoveryFeedback.message}
                </Text>
              ) : null}
            </View>
          </ListCard>
        </View>
      );
    };

  const emptyState = useMemo(
    () => <ListCard title="暂无账号" meta={errorMessage || '连上后这里会展示账号列表。'} icon={KeyRound} />,
    [errorMessage]
  );

  return (
    <>
      <ScreenShell
        title="账号清单"
        subtitle="查看账号状态、用量并执行编辑与批量维护。"
        titleAside={<Text className="text-[11px] text-[#7d7468]">已加载 {summary.loaded} / {summary.total}</Text>}
        right={(
          <Pressable
            onPress={() => router.push('/accounts/create')}
            accessibilityRole="button"
            accessibilityLabel="添加账号"
            className="h-10 w-10 items-center justify-center rounded-[8px] bg-[#1d5f55]"
          >
            <Plus color="#fff" size={19} />
          </Pressable>
        )}
        variant="minimal"
        scroll={false}
        safeAreaEdges={safeAreaEdges}
        bottomInsetClassName="pb-6"
        contentGapClassName="mt-2 gap-2"
      >
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.id}`}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={(accountsQuery.isRefetching && !accountsQuery.isFetchingNextPage) || accountStatsQuery.isRefetching}
              onRefresh={() => {
                const requests: Promise<unknown>[] = [accountsQuery.refetch(), versionQuery.refetch()];
                if (accountIds.length > 0) requests.push(accountStatsQuery.refetch());
                void Promise.all(requests);
              }}
              tintColor="#1d5f55"
            />
          )}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyState}
          ListFooterComponent={accountsQuery.hasNextPage ? (
            <Pressable
              disabled={accountsQuery.isFetchingNextPage}
              onPress={() => void accountsQuery.fetchNextPage()}
              className="h-14 flex-row items-center justify-center gap-2"
            >
              {accountsQuery.isFetchingNextPage ? <ActivityIndicator color="#1d5f55" size="small" /> : <ChevronDown color="#1d5f55" size={17} />}
              <Text className="text-xs font-bold text-[#1d5f55]">{accountsQuery.isFetchingNextPage ? '加载中' : '加载更多账号'}</Text>
            </Pressable>
          ) : null}
          ItemSeparatorComponent={() => <View className="h-4" />}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
        />
      </ScreenShell>

      <AccountEditModal
        visible={editingAccount !== null}
        account={editingAccount}
        groups={groupsQuery.data?.items ?? []}
        groupsLoading={groupsQuery.isLoading}
        saving={editMutation.isPending}
        serverError={editError || (groupsQuery.error ? getAdminRequestErrorMessage(groupsQuery.error, '分组列表加载失败。') : '')}
        onClose={() => {
          if (editMutation.isPending) return;
          setEditingAccount(null);
          setEditError('');
        }}
        onSave={(body) => {
          if (!editingAccount) return;
          editMutation.mutate({ accountId: editingAccount.id, body });
        }}
      />
    </>
  );
}
