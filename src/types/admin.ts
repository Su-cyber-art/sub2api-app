export type ApiEnvelope<T> = {
  code: number | string;
  message?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  data?: T;
};

export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type DashboardStats = {
  total_users: number;
  today_new_users: number;
  active_users: number;
  total_api_keys: number;
  active_api_keys: number;
  total_accounts: number;
  normal_accounts: number;
  error_accounts: number;
  total_requests: number;
  total_cost: number;
  total_tokens: number;
  today_requests: number;
  today_cost: number;
  today_tokens: number;
  today_input_tokens?: number;
  today_output_tokens?: number;
  today_cache_read_tokens?: number;
  rpm: number;
  tpm: number;
};

export type TrendPoint = {
  date: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  cost: number;
  actual_cost: number;
};

export type DashboardTrend = {
  start_date: string;
  end_date: string;
  granularity: 'day' | 'hour' | string;
  trend: TrendPoint[];
};

export type ModelStat = {
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  cost: number;
  actual_cost: number;
};

export type DashboardModelStats = {
  start_date: string;
  end_date: string;
  models: ModelStat[];
};

export type UsageStats = {
  total_requests?: number;
  total_tokens?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_cost?: number;
  total_actual_cost?: number;
  total_account_cost?: number;
  average_duration_ms?: number;
};

export type DashboardSnapshot = {
  trend?: TrendPoint[];
  models?: ModelStat[];
  groups?: Array<{
    group_id?: number;
    group_name?: string;
    requests?: number;
    total_tokens?: number;
    total_cost?: number;
    total_actual_cost?: number;
  }>;
};

export type AdminSettings = {
  site_name?: string;
  [key: string]: string | number | boolean | null | string[] | undefined;
};

export type AdminUser = {
  id: number;
  email: string;
  username?: string | null;
  balance?: number;
  concurrency?: number;
  rpm_limit?: number;
  status?: string;
  role?: string;
  current_concurrency?: number;
  allowed_groups?: number[] | null;
  group_rates?: Record<number, number>;
  notes?: string | null;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type UpdateUserRequest = {
  email?: string;
  password?: string;
  username?: string;
  notes?: string;
  role?: 'user' | 'admin';
  balance?: number;
  concurrency?: number;
  rpm_limit?: number;
  status?: 'active' | 'disabled';
  allowed_groups?: number[] | null;
  group_rates?: Record<number, number | null>;
};

export type UserPlatformQuotaPlatform = 'anthropic' | 'openai' | 'gemini' | 'antigravity' | 'grok';
export type UserPlatformQuotaWindow = 'daily' | 'weekly' | 'monthly';

export type UserPlatformQuota = {
  platform: UserPlatformQuotaPlatform;
  daily_limit_usd: number | null;
  weekly_limit_usd: number | null;
  monthly_limit_usd: number | null;
  daily_usage_usd: number;
  weekly_usage_usd: number;
  monthly_usage_usd: number;
  daily_window_start?: string | null;
  weekly_window_start?: string | null;
  monthly_window_start?: string | null;
  daily_window_resets_at?: string | null;
  weekly_window_resets_at?: string | null;
  monthly_window_resets_at?: string | null;
};

export type UpdateUserPlatformQuota = Pick<
  UserPlatformQuota,
  'platform' | 'daily_limit_usd' | 'weekly_limit_usd' | 'monthly_limit_usd'
>;

export type UserPlatformQuotasResponse = {
  platform_quotas: UserPlatformQuota[];
};

export type UserUsageSummary = {
  total_requests?: number;
  total_tokens?: number;
  total_cost?: number;
  requests?: number;
  tokens?: number;
  cost?: number;
  [key: string]: string | number | boolean | null | undefined;
};

export type AdminApiKey = {
  id: number;
  user_id: number;
  key: string;
  name: string;
  group_id?: number | null;
  status: string;
  quota: number;
  quota_used: number;
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  usage_5h?: number;
  usage_1d?: number;
  usage_7d?: number;
  group?: AdminGroup;
  user?: {
    id: number;
    email?: string;
    username?: string | null;
  };
};

export type BalanceOperation = 'set' | 'add' | 'subtract';

export type GroupPlatform = 'anthropic' | 'openai' | 'gemini' | 'antigravity' | 'grok';
export type GroupSubscriptionType = 'standard' | 'subscription';
export type GroupStatus = 'active' | 'inactive';

export type AdminGroup = {
  id: number;
  name: string;
  description?: string | null;
  platform: string;
  rate_multiplier?: number;
  rpm_limit?: number;
  is_exclusive?: boolean;
  status?: string;
  subscription_type?: string;
  daily_limit_usd?: number | null;
  weekly_limit_usd?: number | null;
  monthly_limit_usd?: number | null;
  account_count?: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type CreateGroupRequest = {
  name: string;
  description?: string | null;
  platform?: GroupPlatform;
  rate_multiplier?: number;
  rpm_limit?: number;
  is_exclusive?: boolean;
  subscription_type?: GroupSubscriptionType;
  daily_limit_usd?: number | null;
  weekly_limit_usd?: number | null;
  monthly_limit_usd?: number | null;
};

export type UpdateGroupRequest = Partial<CreateGroupRequest> & {
  status?: GroupStatus;
};

export type AccountTodayStats = {
  requests: number;
  tokens: number;
  cost: number;
  standard_cost?: number;
  user_cost?: number;
};

export type BatchAccountTodayStats = {
  stats: Record<string, AccountTodayStats>;
};

export type SystemVersion = {
  version: string;
};

export type AdminComplianceAcknowledgement = {
  version: string;
  document_zh: string;
  document_en: string;
  admin_user_id: number;
  ip_address?: string;
  user_agent?: string;
  accepted_at: string;
};

export type AdminComplianceStatus = {
  required: boolean;
  version: string;
  document_path_zh: string;
  document_path_en: string;
  document_url_zh: string;
  document_url_en: string;
  ack_phrase_zh: string;
  ack_phrase_en: string;
  acknowledgement?: AdminComplianceAcknowledgement;
};

export type SystemReleaseInfo = {
  name: string;
  body: string;
  published_at: string;
  html_url: string;
};

export type SystemUpdateInfo = {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_info?: SystemReleaseInfo;
  cached: boolean;
  warning?: string;
  build_type: string;
};

export type PlatformUsage = {
  platform: string;
  today_actual_cost: number;
  total_actual_cost: number;
};

export type BatchUserUsageStats = {
  user_id: number;
  today_actual_cost: number;
  total_actual_cost: number;
  by_platform?: PlatformUsage[];
};

export type BatchUsersUsage = {
  stats: Record<string, BatchUserUsageStats>;
};

export type AlertEvent = {
  id: number;
  rule_id: number;
  severity: string;
  status: string;
  title?: string;
  description?: string;
  metric_value?: number;
  threshold_value?: number;
  dimensions?: Record<string, unknown>;
  fired_at: string;
  resolved_at?: string | null;
  email_sent: boolean;
  created_at: string;
};

export type AlertEventsQuery = {
  limit?: number;
  status?: string;
  severity?: string;
  email_sent?: boolean;
  time_range?: string;
  start_time?: string;
  end_time?: string;
  before_fired_at?: string;
  before_id?: number;
  platform?: string;
  group_id?: number;
};

export type OpsErrorLog = {
  id: number;
  created_at: string;
  phase: string;
  type: string;
  error_owner: string;
  error_source: string;
  severity: string;
  status_code: number;
  platform: string;
  model: string;
  resolved: boolean;
  resolved_at?: string | null;
  resolved_by_user_id?: number | null;
  client_request_id: string;
  request_id: string;
  message: string;
  user_id?: number | null;
  user_email: string;
  api_key_id?: number | null;
  api_key_name?: string;
  api_key_deleted?: boolean;
  account_id?: number | null;
  account_name: string;
  group_id?: number | null;
  group_name: string;
  client_ip?: string | null;
  request_path?: string;
  stream?: boolean;
  inbound_endpoint?: string;
  upstream_endpoint?: string;
  requested_model?: string;
  upstream_model?: string;
  request_type?: number | null;
  user_agent?: string;
  deleted_key_owner_user_id?: number | null;
  deleted_key_owner_email?: string | null;
};

export type OpsErrorListQuery = {
  page?: number;
  page_size?: number;
  time_range?: '1h' | '24h' | '7d' | '30d';
  start_time?: string;
  end_time?: string;
  platform?: string;
  group_id?: number | null;
  account_id?: number | null;
  user_id?: number | null;
  api_key_id?: number | null;
  model?: string;
  phase?: string;
  category?: string;
  error_owner?: string;
  error_source?: string;
  resolved?: 'true' | 'false';
  view?: 'errors' | 'excluded' | 'all';
  q?: string;
  status_codes?: string;
  status_codes_other?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
};

export type OpsSystemLog = {
  id: number;
  created_at: string;
  host: string;
  level: string;
  component: string;
  message: string;
  request_id?: string;
  client_request_id?: string;
  user_id?: number | null;
  api_key_id?: number | null;
  account_id?: number | null;
  platform?: string;
  model?: string;
  extra?: Record<string, unknown>;
};

export type OpsSystemLogQuery = {
  page?: number;
  page_size?: number;
  time_range?: '5m' | '30m' | '1h' | '6h' | '24h' | '7d' | '30d';
  start_time?: string;
  end_time?: string;
  host?: string;
  level?: string;
  component?: string;
  request_id?: string;
  client_request_id?: string;
  user_id?: number | null;
  api_key_id?: number | null;
  account_id?: number | null;
  platform?: string;
  model?: string;
  q?: string;
};

export type OpsSystemLogSinkHealth = {
  queue_depth: number;
  queue_capacity: number;
  dropped_count: number;
  write_failed_count: number;
  written_count: number;
  avg_write_delay_ms: number;
  last_error?: string;
};

export type AdminAccount = {
  id: number;
  name: string;
  notes?: string | null;
  platform: string;
  type: string;
  status?: string;
  schedulable?: boolean;
  proxy_id?: number | null;
  priority?: number;
  concurrency?: number;
  load_factor?: number | null;
  current_concurrency?: number;
  rate_multiplier?: number;
  error_message?: string;
  updated_at?: string;
  last_used_at?: string | null;
  group_ids?: number[];
  groups?: AdminGroup[];
  extra?: Record<string, string | number | boolean | null>;
};

export type AccountType = 'apikey' | 'oauth' | 'setup-token' | 'upstream';

export type CreateAccountRequest = {
  name: string;
  platform: string;
  type: AccountType;
  credentials: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, string | number | boolean | null | undefined>;
  notes?: string;
  proxy_id?: number;
  concurrency?: number;
  priority?: number;
  rate_multiplier?: number;
  group_ids?: number[];
};

export type UpdateAccountRequest = {
  name?: string;
  notes?: string | null;
  type?: AccountType;
  credentials?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, string | number | boolean | null | undefined>;
  proxy_id?: number | null;
  concurrency?: number;
  load_factor?: number | null;
  priority?: number;
  rate_multiplier?: number;
  schedulable?: boolean;
  status?: 'active' | 'inactive' | 'error';
  group_ids?: number[];
  expires_at?: number | null;
  auto_pause_on_expired?: boolean;
  confirm_mixed_channel_risk?: boolean;
};

export type BulkUpdateAccountsRequest = {
  account_ids: number[];
  name?: string;
  proxy_id?: number | null;
  concurrency?: number;
  priority?: number;
  rate_multiplier?: number;
  load_factor?: number;
  status?: 'active' | 'inactive' | 'error';
  schedulable?: boolean;
  group_ids?: number[];
  credentials?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, string | number | boolean | null | undefined>;
  confirm_mixed_channel_risk?: boolean;
};

export type BulkUpdateAccountsResult = {
  success: number;
  failed: number;
  success_ids?: number[];
  failed_ids?: number[];
  results: Array<{ account_id: number; success: boolean; error?: string }>;
};

export type BatchAccountOperationResult = {
  total: number;
  success: number;
  failed: number;
  errors?: Array<{ account_id: number; error: string }>;
  warnings?: Array<{ account_id: number; warning: string }>;
};

export type CreateUserRequest = {
  email: string;
  password: string;
  username?: string;
  notes?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'disabled';
  balance?: number;
  concurrency?: number;
  rpm_limit?: number;
  allowed_groups?: number[] | null;
  [key: string]: string | number | boolean | number[] | null | undefined;
};
