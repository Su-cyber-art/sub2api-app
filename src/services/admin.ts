import { adminFetch } from '@/src/lib/admin-fetch';
import type {
  AccountTodayStats,
  AdminAccount,
  AdminApiKey,
  AdminGroup,
  AdminComplianceStatus,
  AdminSettings,
  AdminUser,
  AlertEvent,
  AlertEventsQuery,
  BalanceOperation,
  BatchAccountTodayStats,
  BatchUsersUsage,
  DashboardModelStats,
  DashboardSnapshot,
  DashboardStats,
  DashboardTrend,
  CreateAccountRequest,
  CreateUserRequest,
  PaginatedData,
  OpsSystemLog,
  OpsSystemLogQuery,
  OpsSystemLogSinkHealth,
  SystemUpdateInfo,
  SystemVersion,
  UsageStats,
  UserUsageSummary,
} from '@/src/types/admin';

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const value = query.toString();

  return value ? `?${value}` : '';
}

export function getDashboardStats() {
  return adminFetch<DashboardStats>('/api/v1/admin/dashboard/stats');
}

export function getAdminSettings() {
  return adminFetch<AdminSettings>('/api/v1/admin/settings');
}

export function getSystemVersion() {
  return adminFetch<SystemVersion>('/api/v1/admin/system/version');
}

export function checkSystemUpdates(force = false) {
  return adminFetch<SystemUpdateInfo>(`/api/v1/admin/system/check-updates${buildQuery({ force: force || undefined })}`);
}

export function getAdminComplianceStatus() {
  return adminFetch<AdminComplianceStatus>('/api/v1/admin/compliance');
}

export function acceptAdminCompliance(phrase: string, language = 'zh') {
  return adminFetch<AdminComplianceStatus>('/api/v1/admin/compliance/accept', {
    method: 'POST',
    body: JSON.stringify({ phrase, language }),
  });
}

export function getDashboardTrend(params: {
  start_date: string;
  end_date: string;
  granularity?: 'day' | 'hour';
  account_id?: number;
  group_id?: number;
  user_id?: number;
}) {
  return adminFetch<DashboardTrend>(`/api/v1/admin/dashboard/trend${buildQuery(params)}`);
}

export function getDashboardModels(params: { start_date: string; end_date: string }) {
  return adminFetch<DashboardModelStats>(`/api/v1/admin/dashboard/models${buildQuery(params)}`);
}

export function getDashboardSnapshot(params: {
  start_date: string;
  end_date: string;
  granularity?: 'day' | 'hour';
  account_id?: number;
  user_id?: number;
  group_id?: number;
  model?: string;
  request_type?: string;
  billing_type?: string | null;
  include_stats?: boolean;
  include_trend?: boolean;
  include_model_stats?: boolean;
  include_group_stats?: boolean;
  include_users_trend?: boolean;
}) {
  return adminFetch<DashboardSnapshot>(`/api/v1/admin/dashboard/snapshot-v2${buildQuery(params)}`);
}

export function getUsageStats(params: {
  start_date: string;
  end_date: string;
  user_id?: number;
  account_id?: number;
  group_id?: number;
  model?: string;
  request_type?: string;
  billing_type?: string | null;
}) {
  return adminFetch<UsageStats>(`/api/v1/admin/usage/stats${buildQuery(params)}`);
}

export function listUsers(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminUser>>(
    `/api/v1/admin/users${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function getBatchUsersUsage(userIds: number[]) {
  return adminFetch<BatchUsersUsage>('/api/v1/admin/dashboard/users-usage', {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export function getUser(userId: number) {
  return adminFetch<AdminUser>(`/api/v1/admin/users/${userId}`);
}

export function createUser(body: CreateUserRequest) {
  return adminFetch<AdminUser>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getUserUsage(userId: number, period: 'day' | 'week' | 'month' = 'month') {
  return adminFetch<UserUsageSummary>(`/api/v1/admin/users/${userId}/usage${buildQuery({ period })}`);
}

export function listUserApiKeys(userId: number) {
  return adminFetch<PaginatedData<AdminApiKey>>(`/api/v1/admin/users/${userId}/api-keys${buildQuery({ page: 1, page_size: 100 })}`);
}

export function updateUserBalance(
  userId: number,
  body: { balance: number; operation: BalanceOperation; notes?: string }
) {
  return adminFetch<AdminUser>(
    `/api/v1/admin/users/${userId}/balance`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    {
      idempotencyKey: `user-balance-${userId}-${Date.now()}`,
    }
  );
}

export function updateUserStatus(userId: number, status: 'active' | 'disabled') {
  return adminFetch<AdminUser>(`/api/v1/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export function listGroups(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminGroup>>(
    `/api/v1/admin/groups${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function getGroup(groupId: number) {
  return adminFetch<AdminGroup>(`/api/v1/admin/groups/${groupId}`);
}

export function listAccounts(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminAccount>>(
    `/api/v1/admin/accounts${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function getAccount(accountId: number) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}`);
}

export function createAccount(body: CreateAccountRequest) {
  return adminFetch<AdminAccount>('/api/v1/admin/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getAccountTodayStats(accountId: number) {
  return adminFetch<AccountTodayStats>(`/api/v1/admin/accounts/${accountId}/today-stats`);
}

export function getBatchAccountTodayStats(accountIds: number[]) {
  return adminFetch<BatchAccountTodayStats>('/api/v1/admin/accounts/today-stats/batch', {
    method: 'POST',
    body: JSON.stringify({ account_ids: accountIds }),
  });
}

export function testAccount(accountId: number) {
  return adminFetch(`/api/v1/admin/accounts/${accountId}/test`, {
    method: 'POST',
  });
}

export function refreshAccount(accountId: number) {
  return adminFetch(`/api/v1/admin/accounts/${accountId}/refresh`, {
    method: 'POST',
  });
}

export function setAccountSchedulable(accountId: number, schedulable: boolean) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}/schedulable`, {
    method: 'POST',
    body: JSON.stringify({ schedulable }),
  });
}

export function recoverAccountState(accountId: number) {
  return adminFetch<unknown>(`/api/v1/admin/accounts/${accountId}/recover-state`, {
    method: 'POST',
  });
}

export function clearAccountError(accountId: number) {
  return adminFetch<unknown>(`/api/v1/admin/accounts/${accountId}/clear-error`, {
    method: 'POST',
  });
}

export function clearAccountRateLimit(accountId: number) {
  return adminFetch<unknown>(`/api/v1/admin/accounts/${accountId}/clear-rate-limit`, {
    method: 'POST',
  });
}

export function clearAccountTempUnschedulable(accountId: number) {
  return adminFetch<unknown>(`/api/v1/admin/accounts/${accountId}/temp-unschedulable`, {
    method: 'DELETE',
  });
}

export function listAlertEvents(params: AlertEventsQuery = {}) {
  return adminFetch<AlertEvent[]>(`/api/v1/admin/ops/alert-events${buildQuery(params)}`);
}

export function updateAlertEventStatus(alertEventId: number, status: 'resolved' | 'manual_resolved') {
  return adminFetch<unknown>(`/api/v1/admin/ops/alert-events/${alertEventId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export function listSystemLogs(params: OpsSystemLogQuery) {
  return adminFetch<PaginatedData<OpsSystemLog>>(`/api/v1/admin/ops/system-logs${buildQuery(params)}`);
}

export function getSystemLogSinkHealth() {
  return adminFetch<OpsSystemLogSinkHealth>('/api/v1/admin/ops/system-logs/health');
}
