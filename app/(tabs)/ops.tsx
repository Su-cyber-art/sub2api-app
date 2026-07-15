import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BellRing,
  Bug,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileText,
  RotateCcw,
  Search,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDebouncedValue } from '@/src/hooks/use-debounced-value';
import { getAdminRequestErrorMessage } from '@/src/lib/admin-error-message';
import { isAdminApiError } from '@/src/lib/admin-fetch';
import { queryClient } from '@/src/lib/query-client';
import {
  getSystemLogSinkHealth,
  listAlertEvents,
  listRequestErrors,
  listSystemLogs,
  updateAlertEventStatus,
  updateRequestErrorResolved,
} from '@/src/services/admin';
import { adminConfigState, hasAuthenticatedAdminSession } from '@/src/store/admin-config';
import type { AlertEvent, OpsErrorLog, OpsSystemLog } from '@/src/types/admin';

const { useSnapshot } = require('valtio/react');

type OpsMode = 'alerts' | 'errors' | 'logs';
type AlertStatusFilter = 'all' | 'firing' | 'resolved';
type AlertSeverityFilter = 'all' | 'critical' | 'error' | 'warning' | 'info';
type ErrorStatusFilter = 'all' | 'unresolved' | 'resolved';
type ErrorTimeRange = '1h' | '24h' | '7d';
type LogLevelFilter = 'all' | 'error' | 'warn' | 'info' | 'debug';
type LogTimeRange = '1h' | '24h' | '7d';

const PAGE_SIZE = 30;
const colors = {
  page: '#f4efe4',
  surface: '#fbf8f2',
  muted: '#f1ece2',
  border: '#e3dacb',
  text: '#16181a',
  subtext: '#71685d',
  primary: '#1d5f55',
  danger: '#b45131',
  dangerBg: '#fbebe4',
  warning: '#8a641a',
  warningBg: '#f7edcf',
};

function formatDateTime(value?: string | null) {
  if (!value) return '时间未知';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function getOpsErrorMessage(error: unknown) {
  if (isAdminApiError(error) && error.status === 404) {
    return '当前服务器未启用运维监控，或版本尚不支持该接口。';
  }

  return getAdminRequestErrorMessage(error, '运维数据加载失败，请检查服务器状态后重试。');
}

function severityStyle(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical' || normalized === 'error') {
    return { backgroundColor: colors.dangerBg, color: colors.danger };
  }
  if (normalized === 'warning' || normalized === 'warn') {
    return { backgroundColor: colors.warningBg, color: colors.warning };
  }
  return { backgroundColor: '#e6f4ee', color: colors.primary };
}

function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{ height: 34, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: selected ? colors.primary : colors.muted }}
          >
            <Text style={{ color: selected ? '#fff' : colors.subtext, fontSize: 12, fontWeight: '700' }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function EmptyOrError({ error, label, onRetry }: { error?: unknown; label: string; onRetry: () => void }) {
  return (
    <View style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {error ? <CircleAlert color={colors.danger} size={28} /> : <FileText color="#8c8378" size={28} />}
      <Text style={{ marginTop: 12, color: colors.text, fontSize: 16, fontWeight: '800' }}>{error ? '加载失败' : label}</Text>
      {error ? <Text style={{ marginTop: 8, color: colors.subtext, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>{getOpsErrorMessage(error)}</Text> : null}
      {error ? (
        <Pressable onPress={onRetry} style={{ marginTop: 14, minHeight: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.primary }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>重试</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AlertEventRow({ item, resolving, onResolve }: { item: AlertEvent; resolving: boolean; onResolve: () => void }) {
  const tone = severityStyle(item.severity);
  const firing = item.status === 'firing';
  return (
    <View style={{ borderRadius: 8, borderWidth: 1, borderColor: firing ? '#e8c5b7' : colors.border, backgroundColor: colors.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <AlertTriangle color={firing ? colors.danger : '#81786d'} size={19} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '800' }}>{item.title || `告警 #${item.id}`}</Text>
          <Text style={{ color: colors.subtext, fontSize: 11, marginTop: 4 }}>{formatDateTime(item.fired_at)}</Text>
        </View>
        <View style={{ borderRadius: 6, backgroundColor: tone.backgroundColor, paddingHorizontal: 8, paddingVertical: 5 }}>
          <Text style={{ color: tone.color, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{item.severity}</Text>
        </View>
      </View>

      {item.description ? <Text style={{ color: '#514a42', fontSize: 13, lineHeight: 20 }}>{item.description}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ color: firing ? colors.danger : colors.primary, fontSize: 11, fontWeight: '800' }}>{firing ? '正在告警' : '已解除'}</Text>
        {typeof item.metric_value === 'number' ? <Text style={{ color: colors.subtext, fontSize: 11 }}>当前 {item.metric_value.toLocaleString()}</Text> : null}
        {typeof item.threshold_value === 'number' ? <Text style={{ color: colors.subtext, fontSize: 11 }}>阈值 {item.threshold_value.toLocaleString()}</Text> : null}
        <Text style={{ color: colors.subtext, fontSize: 11 }}>{item.email_sent ? '已通知' : '未发邮件'}</Text>
      </View>

      {firing ? (
        <Pressable
          disabled={resolving}
          onPress={onResolve}
          style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: resolving ? '#8bada6' : colors.primary }}
        >
          {resolving ? <ActivityIndicator color="#fff" size="small" /> : <CheckCircle2 color="#fff" size={17} />}
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>{resolving ? '处理中' : '标记为已解除'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RequestErrorRow({
  item,
  updating,
  onToggleResolved,
}: {
  item: OpsErrorLog;
  updating: boolean;
  onToggleResolved: () => void;
}) {
  const tone = severityStyle(item.severity || 'error');
  const requestId = item.request_id || item.client_request_id;
  const subject = [item.platform, item.model].filter(Boolean).join(' / ');
  const owner = [item.user_email, item.account_name, item.group_name].filter(Boolean).join(' · ');

  return (
    <View style={{ borderRadius: 8, borderWidth: 1, borderColor: item.resolved ? colors.border : '#e8c5b7', backgroundColor: colors.surface, padding: 13, gap: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
        <Bug color={item.resolved ? '#81786d' : colors.danger} size={18} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' }}>
            {item.type || item.phase || `请求错误 #${item.id}`}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 10, marginTop: 4 }}>{formatDateTime(item.created_at)}</Text>
        </View>
        <View style={{ borderRadius: 6, backgroundColor: tone.backgroundColor, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: tone.color, fontSize: 10, fontWeight: '800' }}>{item.status_code || item.severity}</Text>
        </View>
      </View>

      <Text selectable style={{ color: '#514a42', fontSize: 13, lineHeight: 20 }}>{item.message || '未记录错误信息'}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Text style={{ color: item.resolved ? colors.primary : colors.danger, fontSize: 10, fontWeight: '800' }}>{item.resolved ? '已解除' : '待处理'}</Text>
        {item.phase ? <Text style={{ color: colors.subtext, fontSize: 10 }}>阶段 {item.phase}</Text> : null}
        {item.error_source ? <Text style={{ color: colors.subtext, fontSize: 10 }}>来源 {item.error_source}</Text> : null}
        {subject ? <Text style={{ color: colors.subtext, fontSize: 10 }}>{subject}</Text> : null}
      </View>

      {owner ? <Text numberOfLines={1} style={{ color: colors.subtext, fontSize: 10 }}>{owner}</Text> : null}
      {requestId ? <Text selectable numberOfLines={1} style={{ color: '#81786d', fontSize: 10 }}>请求 {requestId}</Text> : null}

      <Pressable
        disabled={updating}
        onPress={onToggleResolved}
        style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8, backgroundColor: updating ? '#a8a096' : item.resolved ? colors.muted : colors.primary }}
      >
        {updating ? (
          <ActivityIndicator color={item.resolved ? colors.primary : '#fff'} size="small" />
        ) : item.resolved ? (
          <RotateCcw color={colors.primary} size={16} />
        ) : (
          <CheckCircle2 color="#fff" size={16} />
        )}
        <Text style={{ color: item.resolved ? colors.primary : '#fff', fontSize: 12, fontWeight: '800' }}>
          {updating ? '更新中' : item.resolved ? '重新打开' : '标记为已解除'}
        </Text>
      </Pressable>
    </View>
  );
}

function SystemLogRow({ item }: { item: OpsSystemLog }) {
  const tone = severityStyle(item.level);
  const requestId = item.request_id || item.client_request_id;
  return (
    <View style={{ borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 13, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ borderRadius: 6, backgroundColor: tone.backgroundColor, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: tone.color, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{item.level}</Text>
        </View>
        <Text numberOfLines={1} style={{ flex: 1, color: colors.subtext, fontSize: 11 }}>{item.component || item.host}</Text>
        <Text style={{ color: '#8a8176', fontSize: 10 }}>{formatDateTime(item.created_at)}</Text>
      </View>
      <Text selectable style={{ color: colors.text, fontSize: 13, lineHeight: 20 }}>{item.message}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {item.host ? <Text style={{ color: colors.subtext, fontSize: 10 }}>主机 {item.host}</Text> : null}
        {item.platform ? <Text style={{ color: colors.subtext, fontSize: 10 }}>平台 {item.platform}</Text> : null}
        {item.model ? <Text style={{ color: colors.subtext, fontSize: 10 }}>模型 {item.model}</Text> : null}
        {requestId ? <Text selectable style={{ color: colors.subtext, fontSize: 10 }}>请求 {requestId}</Text> : null}
      </View>
    </View>
  );
}

function LoadMore({ visible, loading, onPress }: { visible: boolean; loading: boolean; onPress: () => void }) {
  if (!visible) return <View style={{ height: 8 }} />;
  return (
    <Pressable disabled={loading} onPress={onPress} style={{ height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
      {loading ? <ActivityIndicator color={colors.primary} size="small" /> : <ChevronDown color={colors.primary} size={17} />}
      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>{loading ? '加载中' : '加载更早记录'}</Text>
    </Pressable>
  );
}

async function confirmResolve() {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.confirm('确认将该告警标记为已解除？此操作只更新告警状态。') : false;
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert('解除告警', '确认将该告警标记为已解除？此操作只更新告警状态。', [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '确认解除', onPress: () => resolve(true) },
    ]);
  });
}

async function confirmRequestErrorUpdate(resolved: boolean) {
  const title = resolved ? '解除请求错误' : '重新打开请求错误';
  const message = resolved
    ? '确认将该请求错误标记为已解除？原始错误记录仍会保留。'
    : '确认将该请求错误重新标记为待处理？';

  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.confirm(message) : false;
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel', onPress: () => resolve(false) },
      { text: '确认', onPress: () => resolve(true) },
    ]);
  });
}

export default function OpsScreen() {
  const config = useSnapshot(adminConfigState);
  const hasSession = hasAuthenticatedAdminSession(config);
  const serverScope = `${config.baseUrl}|${config.activeAccountId}`;
  const [mode, setMode] = useState<OpsMode>('alerts');
  const [alertStatus, setAlertStatus] = useState<AlertStatusFilter>('firing');
  const [alertSeverity, setAlertSeverity] = useState<AlertSeverityFilter>('all');
  const [errorStatus, setErrorStatus] = useState<ErrorStatusFilter>('unresolved');
  const [errorTimeRange, setErrorTimeRange] = useState<ErrorTimeRange>('24h');
  const [errorSearch, setErrorSearch] = useState('');
  const [logLevel, setLogLevel] = useState<LogLevelFilter>('all');
  const [logTimeRange, setLogTimeRange] = useState<LogTimeRange>('24h');
  const [logSearch, setLogSearch] = useState('');
  const [alertActionMessage, setAlertActionMessage] = useState('');
  const [errorActionMessage, setErrorActionMessage] = useState('');
  const debouncedErrorSearch = useDebouncedValue(errorSearch, 300);
  const debouncedLogSearch = useDebouncedValue(logSearch, 300);

  const alertsQuery = useInfiniteQuery({
    queryKey: ['ops', serverScope, 'alert-events', alertStatus, alertSeverity],
    queryFn: ({ pageParam }) => listAlertEvents({
      limit: PAGE_SIZE,
      status: alertStatus === 'all' ? undefined : alertStatus,
      severity: alertSeverity === 'all' ? undefined : alertSeverity,
      before_fired_at: pageParam?.firedAt,
      before_id: pageParam?.id,
    }),
    initialPageParam: undefined as { firedAt: string; id: number } | undefined,
    getNextPageParam: (lastPage) => {
      const last = lastPage.at(-1);
      return lastPage.length === PAGE_SIZE && last ? { firedAt: last.fired_at, id: last.id } : undefined;
    },
    enabled: hasSession && mode === 'alerts',
  });

  const requestErrorsQuery = useInfiniteQuery({
    queryKey: ['ops', serverScope, 'request-errors', errorTimeRange, errorStatus, debouncedErrorSearch],
    queryFn: ({ pageParam }) => listRequestErrors({
      page: pageParam,
      page_size: PAGE_SIZE,
      time_range: errorTimeRange,
      resolved: errorStatus === 'all' ? undefined : errorStatus === 'resolved' ? 'true' : 'false',
      view: 'errors',
      q: debouncedErrorSearch.trim() || undefined,
      sort_by: 'created_at',
      sort_order: 'desc',
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: hasSession && mode === 'errors',
  });

  const logsQuery = useInfiniteQuery({
    queryKey: ['ops', serverScope, 'system-logs', logTimeRange, logLevel, debouncedLogSearch],
    queryFn: ({ pageParam }) => listSystemLogs({
      page: pageParam,
      page_size: PAGE_SIZE,
      time_range: logTimeRange,
      level: logLevel === 'all' ? undefined : logLevel,
      q: debouncedLogSearch.trim() || undefined,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: hasSession && mode === 'logs',
  });

  const healthQuery = useQuery({
    queryKey: ['ops', serverScope, 'system-logs-health'],
    queryFn: getSystemLogSinkHealth,
    enabled: hasSession && mode === 'logs',
    refetchInterval: 30_000,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => updateAlertEventStatus(id, 'manual_resolved'),
    onSuccess: async () => {
      setAlertActionMessage('告警已标记为解除。');
      await queryClient.invalidateQueries({ queryKey: ['ops', serverScope, 'alert-events'] });
    },
    onError: (error) => setAlertActionMessage(getOpsErrorMessage(error)),
  });

  const errorResolutionMutation = useMutation({
    mutationFn: ({ id, resolved }: { id: number; resolved: boolean }) => updateRequestErrorResolved(id, resolved),
    onSuccess: async (_, variables) => {
      setErrorActionMessage(variables.resolved ? '请求错误已标记为解除。' : '请求错误已重新打开。');
      await queryClient.invalidateQueries({ queryKey: ['ops', serverScope, 'request-errors'] });
    },
    onError: (error) => setErrorActionMessage(getOpsErrorMessage(error)),
  });

  const alerts = useMemo(() => alertsQuery.data?.pages.flat() ?? [], [alertsQuery.data]);
  const requestErrors = useMemo(() => requestErrorsQuery.data?.pages.flatMap((page) => page.items) ?? [], [requestErrorsQuery.data]);
  const logs = useMemo(() => logsQuery.data?.pages.flatMap((page) => page.items) ?? [], [logsQuery.data]);

  async function handleResolve(id: number) {
    setAlertActionMessage('');
    if (await confirmResolve()) resolveMutation.mutate(id);
  }

  async function handleRequestErrorUpdate(item: OpsErrorLog) {
    const resolved = !item.resolved;
    setErrorActionMessage('');
    if (await confirmRequestErrorUpdate(resolved)) {
      errorResolutionMutation.mutate({ id: item.id, resolved });
    }
  }

  const activeQuery = mode === 'alerts' ? alertsQuery : mode === 'errors' ? requestErrorsQuery : logsQuery;
  const isInitialLoading = activeQuery.isLoading;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>运维</Text>
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>查看告警、请求错误与服务器运行日志。</Text>
        </View>

        <View style={{ height: 42, flexDirection: 'row', padding: 4, borderRadius: 8, backgroundColor: colors.muted, marginBottom: 10 }}>
          {([
            { value: 'alerts' as const, label: '告警', icon: BellRing },
            { value: 'errors' as const, label: '请求错误', icon: Bug },
            { value: 'logs' as const, label: '日志', icon: FileText },
          ]).map((option) => {
            const selected = mode === option.value;
            const Icon = option.icon;
            return (
              <Pressable key={option.value} onPress={() => setMode(option.value)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 6, backgroundColor: selected ? colors.surface : 'transparent' }}>
                <Icon color={selected ? colors.primary : colors.subtext} size={16} />
                <Text style={{ color: selected ? colors.primary : colors.subtext, fontSize: 13, fontWeight: '800' }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'alerts' ? (
          <>
            <View style={{ gap: 8, marginBottom: 10 }}>
              <FilterPills
                value={alertStatus}
                onChange={setAlertStatus}
                options={[{ value: 'firing', label: '正在告警' }, { value: 'resolved', label: '已解除' }, { value: 'all', label: '全部状态' }]}
              />
              <FilterPills
                value={alertSeverity}
                onChange={setAlertSeverity}
                options={[{ value: 'all', label: '全部级别' }, { value: 'critical', label: '严重' }, { value: 'error', label: '错误' }, { value: 'warning', label: '警告' }, { value: 'info', label: '提示' }]}
              />
            </View>
            {alertActionMessage ? <Text style={{ marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: alertActionMessage.includes('已标记') ? '#e6f4ee' : colors.dangerBg, color: alertActionMessage.includes('已标记') ? colors.primary : colors.danger, fontSize: 12 }}>{alertActionMessage}</Text> : null}
            {isInitialLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <FlatList
                data={alerts}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => <AlertEventRow item={item} resolving={resolveMutation.isPending && resolveMutation.variables === item.id} onResolve={() => void handleResolve(item.id)} />}
                ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 104, flexGrow: alerts.length === 0 ? 1 : 0 }}
                refreshControl={<RefreshControl refreshing={alertsQuery.isRefetching && !alertsQuery.isFetchingNextPage} onRefresh={() => void alertsQuery.refetch()} tintColor={colors.primary} />}
                ListEmptyComponent={<EmptyOrError error={alertsQuery.error} label="当前筛选条件下没有告警" onRetry={() => void alertsQuery.refetch()} />}
                ListFooterComponent={<LoadMore visible={alertsQuery.hasNextPage} loading={alertsQuery.isFetchingNextPage} onPress={() => void alertsQuery.fetchNextPage()} />}
              />
            )}
          </>
        ) : mode === 'errors' ? (
          <>
            <View style={{ height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: 12, marginBottom: 8 }}>
              <Search color="#81786d" size={16} />
              <TextInput
                value={errorSearch}
                onChangeText={setErrorSearch}
                placeholder="搜索错误、模型或请求 ID"
                placeholderTextColor="#968c7e"
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, color: colors.text, fontSize: 13 }}
              />
            </View>
            <View style={{ gap: 8, marginBottom: 9 }}>
              <FilterPills
                value={errorTimeRange}
                onChange={setErrorTimeRange}
                options={[{ value: '1h', label: '1 小时' }, { value: '24h', label: '24 小时' }, { value: '7d', label: '7 天' }]}
              />
              <FilterPills
                value={errorStatus}
                onChange={setErrorStatus}
                options={[{ value: 'unresolved', label: '待处理' }, { value: 'resolved', label: '已解除' }, { value: 'all', label: '全部状态' }]}
              />
            </View>
            {errorActionMessage ? (
              <Text style={{ marginBottom: 8, padding: 10, borderRadius: 8, backgroundColor: errorActionMessage.includes('已') ? '#e6f4ee' : colors.dangerBg, color: errorActionMessage.includes('已') ? colors.primary : colors.danger, fontSize: 12 }}>
                {errorActionMessage}
              </Text>
            ) : null}
            {isInitialLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <FlatList
                data={requestErrors}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <RequestErrorRow
                    item={item}
                    updating={errorResolutionMutation.isPending && errorResolutionMutation.variables?.id === item.id}
                    onToggleResolved={() => void handleRequestErrorUpdate(item)}
                  />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 104, flexGrow: requestErrors.length === 0 ? 1 : 0 }}
                refreshControl={<RefreshControl refreshing={requestErrorsQuery.isRefetching && !requestErrorsQuery.isFetchingNextPage} onRefresh={() => void requestErrorsQuery.refetch()} tintColor={colors.primary} />}
                ListEmptyComponent={<EmptyOrError error={requestErrorsQuery.error} label="当前筛选条件下没有请求错误" onRetry={() => void requestErrorsQuery.refetch()} />}
                ListFooterComponent={<LoadMore visible={requestErrorsQuery.hasNextPage} loading={requestErrorsQuery.isFetchingNextPage} onPress={() => void requestErrorsQuery.fetchNextPage()} />}
              />
            )}
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1, height: 42, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: 12 }}>
                <Search color="#81786d" size={16} />
                <TextInput value={logSearch} onChangeText={setLogSearch} placeholder="搜索日志内容或请求 ID" placeholderTextColor="#968c7e" autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: colors.text, fontSize: 13 }} />
              </View>
            </View>
            <View style={{ gap: 8, marginBottom: 9 }}>
              <FilterPills value={logTimeRange} onChange={setLogTimeRange} options={[{ value: '1h', label: '1 小时' }, { value: '24h', label: '24 小时' }, { value: '7d', label: '7 天' }]} />
              <FilterPills value={logLevel} onChange={setLogLevel} options={[{ value: 'all', label: '全部级别' }, { value: 'error', label: '错误' }, { value: 'warn', label: '警告' }, { value: 'info', label: '信息' }, { value: 'debug', label: '调试' }]} />
            </View>
            {healthQuery.data ? (
              <View style={{ marginBottom: 9, minHeight: 34, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: 11, paddingVertical: 7 }}>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>写入队列 {healthQuery.data.queue_depth}/{healthQuery.data.queue_capacity}</Text>
                <Text style={{ color: healthQuery.data.dropped_count ? colors.danger : colors.subtext, fontSize: 11 }}>丢弃 {healthQuery.data.dropped_count}</Text>
                <Text style={{ color: healthQuery.data.write_failed_count ? colors.danger : colors.subtext, fontSize: 11 }}>失败 {healthQuery.data.write_failed_count}</Text>
                <Text style={{ color: colors.subtext, fontSize: 11 }}>延迟 {healthQuery.data.avg_write_delay_ms.toFixed(1)}ms</Text>
              </View>
            ) : null}
            {isInitialLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <FlatList
                data={logs}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => <SystemLogRow item={item} />}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 104, flexGrow: logs.length === 0 ? 1 : 0 }}
                refreshControl={<RefreshControl refreshing={logsQuery.isRefetching && !logsQuery.isFetchingNextPage} onRefresh={() => void Promise.all([logsQuery.refetch(), healthQuery.refetch()])} tintColor={colors.primary} />}
                ListEmptyComponent={<EmptyOrError error={logsQuery.error} label="当前筛选条件下没有日志" onRetry={() => void logsQuery.refetch()} />}
                ListFooterComponent={<LoadMore visible={logsQuery.hasNextPage} loading={logsQuery.isFetchingNextPage} onPress={() => void logsQuery.fetchNextPage()} />}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
