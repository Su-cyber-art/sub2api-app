import { Platform } from 'react-native';

import { adminConfigState } from '@/src/store/admin-config';
import { requireAdminCompliance } from '@/src/store/admin-compliance';
import type { ApiEnvelope } from '@/src/types/admin';

const UPSTREAM_BASE_URL_HEADER = 'x-sub2api-base-url';

type AdminApiErrorOptions = {
  status: number;
  code?: number | string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: number | string;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;

  constructor(message: string, options: AdminApiErrorOptions) {
    super(message);
    this.name = 'AdminApiError';
    this.status = options.status;
    this.code = options.code;
    this.reason = options.reason;
    this.metadata = options.metadata;
  }
}

export function isAdminApiError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getResponseMessage(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getDefaultWebProxyBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8787';
  }

  const currentHostname = window.location.hostname || '127.0.0.1';
  const hostname = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(currentHostname.toLowerCase())
    ? '127.0.0.1'
    : currentHostname;
  const formattedHostname = hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
  return `http://${formattedHostname}:8787`;
}

function normalizeHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase()) ? 'loopback' : hostname.toLowerCase();
}

function isSameEndpoint(left: string, right: string) {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return normalizeHostname(leftUrl.hostname) === normalizeHostname(rightUrl.hostname)
      && leftUrl.port === rightUrl.port
      && leftUrl.protocol === rightUrl.protocol;
  } catch {
    return left === right;
  }
}

function resolveRequestTarget(baseUrl: string, path: string) {
  const configuredProxyBaseUrl = process.env.EXPO_PUBLIC_ADMIN_PROXY_URL?.trim().replace(/\/$/, '');
  const shouldUseWebProxy = Platform.OS === 'web' && (__DEV__ || Boolean(configuredProxyBaseUrl));

  if (!shouldUseWebProxy) {
    return { requestUrl: buildRequestUrl(baseUrl, path), usingProxy: false };
  }

  const proxyBaseUrl = configuredProxyBaseUrl || getDefaultWebProxyBaseUrl();
  if (isSameEndpoint(baseUrl, proxyBaseUrl)) {
    return { requestUrl: buildRequestUrl(baseUrl, path), usingProxy: false };
  }

  return { requestUrl: buildRequestUrl(proxyBaseUrl, path), usingProxy: true };
}

function buildRequestUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.trim().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const duplicatedPrefixes = ['/api/v1', '/api'];

  for (const prefix of duplicatedPrefixes) {
    if (normalizedBase.endsWith(prefix) && normalizedPath.startsWith(`${prefix}/`)) {
      const baseWithoutPrefix = normalizedBase.slice(0, -prefix.length);
      return `${baseWithoutPrefix}${normalizedPath}`;
    }
  }

  return `${normalizedBase}${normalizedPath}`;
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  options?: { idempotencyKey?: string }
): Promise<T> {
  const baseUrl = adminConfigState.baseUrl.trim().replace(/\/$/, '');
  const adminApiKey = adminConfigState.adminApiKey.trim();

  if (!baseUrl) {
    throw new Error('BASE_URL_REQUIRED');
  }

  if (!adminApiKey) {
    throw new Error('ADMIN_API_KEY_REQUIRED');
  }

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (adminApiKey) {
    headers.set('x-api-key', adminApiKey);
  }

  if (options?.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  const target = resolveRequestTarget(baseUrl, path);
  if (target.usingProxy) {
    headers.set(UPSTREAM_BASE_URL_HEADER, baseUrl);
  }

  let response: Response;
  try {
    response = await fetch(target.requestUrl, {
      ...init,
      headers,
    });
  } catch (cause) {
    const error = new Error(target.usingProxy ? 'WEB_PROXY_UNAVAILABLE' : 'NETWORK_REQUEST_FAILED');
    (error as Error & { cause?: unknown }).cause = cause;
    throw error;
  }

  let parsed: unknown;
  const rawText = await response.text();

  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    throw new AdminApiError('INVALID_SERVER_RESPONSE', { status: response.status });
  }

  if (!isRecord(parsed)) {
    throw new AdminApiError('INVALID_SERVER_RESPONSE', { status: response.status });
  }

  const json = parsed as Partial<ApiEnvelope<T>> & { detail?: unknown };

  if (!response.ok || (json.code !== 0 && json.code !== '0')) {
    const reason = getResponseMessage(json.reason);
    const message = reason
      || getResponseMessage(json.message)
      || getResponseMessage(json.detail)
      || (json.code !== undefined ? String(json.code) : 'REQUEST_FAILED');
    const metadata = isRecord(json.metadata) ? json.metadata : undefined;

    if (response.status === 423 && json.code === 'ADMIN_COMPLIANCE_ACK_REQUIRED') {
      requireAdminCompliance(baseUrl, metadata);
    }

    throw new AdminApiError(message, {
      status: response.status,
      code: json.code,
      reason,
      metadata,
    });
  }

  return json.data as T;
}
