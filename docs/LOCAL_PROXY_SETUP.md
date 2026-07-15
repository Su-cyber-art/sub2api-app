# Local Proxy Setup

本项目内置了一个最小代理层，用来解决：

- Expo Web 调用 `Sub2API` 管理接口时的 CORS
- 开发环境在登录页直接切换不同的 Sub2API 服务
- Web 端不持久化管理员 API Key

## 开发环境启动

```bash
npm run web
```

该命令会同时启动：

- Expo Web：`http://localhost:8081`
- 本地代理：`http://127.0.0.1:8787`

登录页仍然填写真实的 Sub2API 地址和 Admin Key。开发版 Web 会自动把请求交给本地代理，不要把服务器地址填写成代理地址。

只启动 Expo 客户端（代理已单独运行时）：

```bash
npm run web:client
```

## 固定代理配置

部署共享代理或不希望浏览器传递目标地址时，可继续使用固定环境变量：

```bash
SUB2API_BASE_URL="https://x.empjs.dev" \
SUB2API_ADMIN_API_KEY="admin-xxxx" \
ALLOW_ORIGIN="http://localhost:8081" \
npm run web
```

固定环境变量优先于登录页随请求传入的地址和 Key。

可选环境变量：

- `PORT`：代理端口，默认 `8787`
- `HOST`：代理监听地址，默认 `127.0.0.1`
- `ALLOW_ORIGIN`：逗号分隔的 Web 来源；默认仅允许本机 HTTP 开发页，显式设置 `*` 才允许任意来源
- `ALLOW_DYNAMIC_UPSTREAM`：是否允许逐请求指定上游；回环监听时默认开启，非回环监听时默认关闭
- `EXPO_PUBLIC_ADMIN_PROXY_URL`：生产 Web 使用的代理地址

## 打包优化开关

当前项目已在 `metro.config.js` 打开更积极的导入优化，并建议在本地或 CI 增加：

```bash
EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1 \
EXPO_UNSTABLE_TREE_SHAKING=1 \
npx expo export --platform web
```

这组环境变量更适合生产打包或包体分析，不建议把日常开发体验和正式构建混在一起看。

## 健康检查

打开：`http://localhost:8787/healthz`

如果返回：

```json
{
  "ok": true,
  "mode": "dynamic",
  "dynamicUpstreamEnabled": true,
  "upstreamConfigured": false,
  "apiKeyConfigured": false
}
```

说明动态本地代理已正常启动。健康检查不会显示或泄露登录页中的地址和 Key。

## 生产 Web

生产 Web 不会默认访问本机代理。部署时应提供固定配置的 HTTPS 代理，并在构建前设置：

```bash
EXPO_PUBLIC_ADMIN_PROXY_URL="https://admin-proxy.example.com" npx expo export --platform web
```

生产代理应设置固定的 `SUB2API_BASE_URL`、`SUB2API_ADMIN_API_KEY`、严格的 `ALLOW_ORIGIN`，并保持 `ALLOW_DYNAMIC_UPSTREAM=false`。

## API 密钥聚合接口

当前项目的管理端为了区分“用户 API 密钥”和“上游账号”，在本地代理额外提供了一个聚合接口：

- `GET /api/v1/keys`

这个接口不是直接转发上游用户态 `/api/v1/keys`，而是通过管理员接口聚合得到：

- `GET /api/v1/admin/users`
- `GET /api/v1/admin/users/:id/api-keys`

支持参数：

- `page`
- `page_size`
- `search`
- `status`

适合用在内部管理台的“用户 API 密钥”列表。
