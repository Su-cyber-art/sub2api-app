const cors = require('cors');
const express = require('express');

const app = express();

const port = Number(process.env.PORT || 8787);
const host = (process.env.HOST || '127.0.0.1').trim();
const fixedUpstreamBaseUrl = normalizeUpstreamBaseUrl(process.env.SUB2API_BASE_URL || '');
const fixedAdminApiKey = (process.env.SUB2API_ADMIN_API_KEY || '').trim();
const allowedOriginSetting = (process.env.ALLOW_ORIGIN || '').trim();
const allowedOrigins = allowedOriginSetting.split(',').map((value) => value.trim()).filter(Boolean);
const dynamicUpstreamSetting = (process.env.ALLOW_DYNAMIC_UPSTREAM || '').trim().toLowerCase();
const allowDynamicUpstream = dynamicUpstreamSetting
  ? ['1', 'true', 'yes'].includes(dynamicUpstreamSetting)
  : ['127.0.0.1', 'localhost', '::1'].includes(host);
const upstreamBaseUrlHeader = 'x-sub2api-base-url';

function normalizeUpstreamBaseUrl(value) {
  const normalized = String(value || '').trim().replace(/\/$/, '');
  if (!normalized) {
    return '';
  }

  const url = new URL(normalized);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('INVALID_UPSTREAM_BASE_URL');
  }

  return normalized;
}

function isLoopbackHostname(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function isProxyLoop(baseUrl) {
  const url = new URL(baseUrl);
  const effectivePort = url.port || (url.protocol === 'https:' ? '443' : '80');
  return isLoopbackHostname(url.hostname) && effectivePort === String(port);
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes('*')) {
    return true;
  }

  if (allowedOrigins.length > 0) {
    return allowedOrigins.includes(origin);
  }

  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
}

function buildUpstreamUrl(baseUrl, path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const duplicatedPrefixes = ['/api/v1', '/api'];

  for (const prefix of duplicatedPrefixes) {
    if (baseUrl.endsWith(prefix) && normalizedPath.startsWith(`${prefix}/`)) {
      return new URL(`${baseUrl.slice(0, -prefix.length)}${normalizedPath}`);
    }
  }

  return new URL(`${baseUrl}${normalizedPath}`);
}

function getRequestConfig(req) {
  const dynamicBaseUrl = allowDynamicUpstream ? req.get(upstreamBaseUrlHeader) || '' : '';
  const dynamicApiKey = allowDynamicUpstream ? req.get('x-api-key') || '' : '';
  const upstreamBaseUrl = fixedUpstreamBaseUrl || normalizeUpstreamBaseUrl(dynamicBaseUrl);

  if (upstreamBaseUrl && isProxyLoop(upstreamBaseUrl)) {
    throw new Error('UPSTREAM_PROXY_LOOP');
  }

  return {
    upstreamBaseUrl,
    adminApiKey: fixedAdminApiKey || dynamicApiKey.trim(),
  };
}

function assertRequestConfig(config) {
  if (!config.upstreamBaseUrl) {
    throw new Error('SUB2API_BASE_URL_NOT_CONFIGURED');
  }

  if (!config.adminApiKey) {
    throw new Error('SUB2API_ADMIN_API_KEY_NOT_CONFIGURED');
  }
}

async function fetchAdminJson(config, path) {
  assertRequestConfig(config);

  const response = await fetch(buildUpstreamUrl(config.upstreamBaseUrl, path), {
    headers: {
      'x-api-key': config.adminApiKey,
    },
  });

  const json = await response.json();

  if (!response.ok || (json.code !== 0 && json.code !== '0')) {
    throw new Error(json.reason || json.message || json.detail || 'ADMIN_FETCH_FAILED');
  }

  return json.data;
}

function redactAccountCredentials(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const walk = (value) => {
    if (Array.isArray(value)) {
      return value.map(walk);
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const next = {};

    Object.entries(value).forEach(([key, entryValue]) => {
      if (key === 'credentials') {
        next[key] = { redacted: true };
        return;
      }

      next[key] = walk(entryValue);
    });

    return next;
  };

  return walk(payload);
}

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

app.get('/healthz', (req, res) => {
  let requestConfig = { upstreamBaseUrl: '', adminApiKey: '' };
  try {
    requestConfig = getRequestConfig(req);
  } catch {
    // Health checks report invalid dynamic configuration without echoing it.
  }

  res.json({
    ok: true,
    mode: fixedUpstreamBaseUrl || fixedAdminApiKey ? 'fixed' : 'dynamic',
    dynamicUpstreamEnabled: allowDynamicUpstream,
    upstreamConfigured: Boolean(requestConfig.upstreamBaseUrl),
    apiKeyConfigured: Boolean(requestConfig.adminApiKey),
  });
});

app.get('/api/v1/keys', async (req, res) => {
  try {
    const requestConfig = getRequestConfig(req);
    assertRequestConfig(requestConfig);
    const page = Math.max(Number(req.query.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.page_size || 10), 1), 100);
    const search = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim();

    const users = [];
    let currentPage = 1;
    let totalPages = 1;

    do {
      const userPage = await fetchAdminJson(requestConfig, `/api/v1/admin/users?page=${currentPage}&page_size=100`);
      users.push(...(userPage.items || []));
      totalPages = userPage.pages || 1;
      currentPage += 1;
    } while (currentPage <= totalPages);

    const keyPages = await Promise.all(
      users.map(async (user) => {
        const result = await fetchAdminJson(requestConfig, `/api/v1/admin/users/${user.id}/api-keys?page=1&page_size=100`);
        return (result.items || []).map((item) => ({
          ...item,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
        }));
      })
    );

    let items = keyPages.flat();

    if (search) {
      items = items.filter((item) => {
        const haystack = [item.name, item.key, item.user?.email, item.user?.username, item.group?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (status) {
      items = items.filter((item) => item.status === status);
    }

    items.sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.last_used_at || 0).getTime();
      const rightTime = new Date(right.updated_at || right.last_used_at || 0).getTime();
      return rightTime - leftTime;
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);

    res.json({
      code: 0,
      message: 'success',
      data: {
        items: pagedItems,
        total,
        page,
        page_size: pageSize,
        pages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error instanceof Error ? error.message : 'KEYS_AGGREGATION_FAILED',
    });
  }
});

app.use('/api/v1/admin', async (req, res) => {
  let requestConfig;
  try {
    requestConfig = getRequestConfig(req);
  } catch (error) {
    res.status(400).json({ code: 400, message: error instanceof Error ? error.message : 'INVALID_UPSTREAM_BASE_URL' });
    return;
  }

  if (!requestConfig.upstreamBaseUrl) {
    res.status(500).json({ code: 500, message: 'SUB2API_BASE_URL_NOT_CONFIGURED' });
    return;
  }

  if (!requestConfig.adminApiKey) {
    res.status(500).json({ code: 500, message: 'SUB2API_ADMIN_API_KEY_NOT_CONFIGURED' });
    return;
  }

  const upstreamUrl = buildUpstreamUrl(requestConfig.upstreamBaseUrl, req.originalUrl);
  const headers = new Headers();

  headers.set('x-api-key', requestConfig.adminApiKey);

  const contentType = req.headers['content-type'];
  if (contentType) {
    headers.set('content-type', contentType);
  }

  const idempotencyKey = req.headers['idempotency-key'];
  if (typeof idempotencyKey === 'string' && idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  const init = {
    method: req.method,
    headers,
  };

  if (!['GET', 'HEAD'].includes(req.method)) {
    init.body = JSON.stringify(req.body || {});
  }

  try {
    const response = await fetch(upstreamUrl, init);
    const upstreamContentType = response.headers.get('content-type');
    const isJson = upstreamContentType?.includes('application/json');

    let responseBody;
    if (isJson) {
      const json = await response.json();
      responseBody = req.path.startsWith('/accounts') ? redactAccountCredentials(json) : json;
    } else {
      responseBody = await response.text();
    }

    if (upstreamContentType) {
      res.setHeader('content-type', upstreamContentType);
    }

    res.status(response.status).send(responseBody);
  } catch (error) {
    res.status(502).json({
      code: 502,
      message: 'UPSTREAM_REQUEST_FAILED',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });
  }
});

app.listen(port, host, () => {
  console.log(`Admin proxy listening on http://${host}:${port}`);
  console.log(`Proxy mode: ${fixedUpstreamBaseUrl || fixedAdminApiKey ? 'fixed environment configuration' : allowDynamicUpstream ? 'dynamic local requests' : 'configuration required'}`);
});
