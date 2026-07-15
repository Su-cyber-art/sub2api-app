export function getAdminRequestErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  switch (error.message) {
    case 'BASE_URL_REQUIRED':
      return '请先填写服务器地址。';
    case 'ADMIN_API_KEY_REQUIRED':
      return '请先填写 Admin Key。';
    case 'INVALID_SERVER_RESPONSE':
      return '服务器返回的数据格式不正确，请确认它是可用的 Sub2API 管理接口。';
    case 'WEB_PROXY_UNAVAILABLE':
      return '无法连接本地 Web 代理，请使用 npm run web 启动完整开发服务。';
    case 'NETWORK_REQUEST_FAILED':
      return '无法连接服务器，请检查服务器地址、HTTP/HTTPS 配置和网络连通性。';
    case 'SUB2API_BASE_URL_NOT_CONFIGURED':
      return '本地代理没有收到上游服务器地址，请重新保存服务器配置。';
    case 'SUB2API_ADMIN_API_KEY_NOT_CONFIGURED':
      return '本地代理没有收到 Admin Key，请重新保存服务器配置。';
    case 'INVALID_UPSTREAM_BASE_URL':
      return '服务器地址无效，仅支持不含账号密码的 HTTP 或 HTTPS 地址。';
    case 'UPSTREAM_PROXY_LOOP':
      return '服务器地址不能填写成本地代理地址，请填写真实的 Sub2API 地址。';
    default:
      return error.message;
  }
}
