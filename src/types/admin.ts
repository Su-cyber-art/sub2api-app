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
  status?: string;
  role?: string;
  current_concurrency?: number;
  notes?: string | null;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
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
  platform: string;
  type: string;
  status?: string;
  schedulable?: boolean;
  priority?: number;
  concurrency?: number;
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

export type CreateUserRequest = {
  email: string;
  password: string;
  username?: string;
  notes?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'disabled';
  balance?: number;
  concurrency?: number;
  [key: string]: string | number | boolean | null | undefined;
};
