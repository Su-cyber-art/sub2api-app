# Expo Release

当前项目已绑定新的 Expo / EAS 项目：

- Owner: `ckken`
- Slug: `sub2api-mobile`
- Project ID: `acaedd05-5a2a-4843-a648-e025c08ce7b3`

## 已完成配置

- `app.json` 已配置 `owner`
- `app.json` 已配置 `scheme = sub2apimobile`
- `app.json` 已配置 `runtimeVersion.policy = appVersion`
- `app.json` 已配置 `updates.url`
- `package.json` 已包含 `expo-dev-client`
- `eas.json` 已配置 `development / development-device / preview / production` 四套 profile
- 项目已升级到 Expo SDK 56，iOS 原生页面使用 `@expo/ui` 的 SwiftUI 与 Swift Charts

## 登录状态检查

```bash
npx expo whoami
npx eas whoami
```

## 关键结论

### 1. Expo Go 适合什么

当前 Expo Go 可以用于部分 SDK 56 快速预览，但本项目不把它作为 iOS 原生验收环境。日常 iOS 验收使用 development build，确保与最终 IPA 的原生模块和运行时一致。

`Expo Go` 仍适合：

- `npx expo start`
- 本地 Metro 联调
- 快速查看 JS / RN 页面改动

### 2. Expo Go 不适合什么

这次已经实测确认：

- 不能把 `Expo Go` 当成 `EAS Update branch` 的稳定预览壳
- 想在 Expo Updates 里通过 branch 打开新版本，应该使用 `development build / dev client`

### 3. branch 预览要满足什么

要稳定预览 branch/update，需要同时满足：

- 已发布 `eas update --branch <branch>`
- App 壳支持 `expo-updates`
- App 壳包含 `expo-dev-client` 或对应原生构建
- 项目配置了自定义 `scheme`
- `runtimeVersion` 与 update 一致

## 本地开发

```bash
npm run start
```

如果要用 dev client 连本地（iOS 原生页面的推荐方式）：

```bash
npm run start:dev-client
```

## 预览包

```bash
npm run eas:build:preview
```

## Dev Client / 模拟器测试

开发构建：

```bash
npm run eas:build:development
```

也可以分平台：

```bash
npm run eas:build:development:android
npm run eas:build:development:ios
npm run eas:build:development:ios:device
```

当前 `development` profile 已配置：

- `developmentClient: true`
- `distribution: internal`
- `ios.simulator: true`

真机使用 `development-device` profile：

- `developmentClient: true`
- `distribution: internal`
- `ios.simulator: false`

首次构建时 EAS 会引导注册测试设备并处理 Apple 签名。SDK 56 的 iOS 最低版本是 16.4；本地原生构建需要 Xcode 26.4 或更高版本。

适合先生成一个测试壳，后续再配合 `Expo / EAS Update` 做快速验证。

## 推荐发布流程

### 方案 A：本地开发调试

适用于：

- UI 改动
- 页面白屏排查
- 路由调试

命令：

```bash
npm run start
```

### 方案 B：发 branch 给 dev client 验证

适用于：

- 想在 Expo Updates 里看到新的 branch/update
- 想让测试壳直接吃 OTA

步骤：

```bash
npx eas-cli@latest update --branch preview --message "your message"
```

然后在 dev client / development build 中验证对应 branch。

### 方案 C：先出壳，再吃 OTA

如果还没有合适的 dev client：

```bash
npm run eas:build:development:android
npm run eas:build:development:ios
npm run eas:build:development:ios:device
```

装好开发壳后，再发：

```bash
npx eas-cli@latest update --branch preview --message "your message"
```

## 本次实战记录

本次已经验证通过的 OTA 发布命令：

```bash
npx eas-cli@latest update --branch preview --message "align dev-client and user detail 2026-03-08"
```

本次成功发布结果：

- Branch: `preview`
- Message: `align dev-client and user detail 2026-03-08`
- Update group ID: `b6744438-929d-4206-b1eb-0887eaf3f97d`
- iOS update ID: `019ccd68-a2af-7ba1-af68-7958f454e93c`
- Android update ID: `019ccd68-a2af-7166-9e9d-9619bd1b8e0e`

## 常见问题

### 1. 本地正常，发到 branch 后白屏

先排查：

- 当前打开的是不是 `Expo Go`
- 当前壳是不是 `development build`
- 项目是否配置了 `scheme`
- `runtimeVersion` 是否匹配

### 2. branch 发上去了，但设备没更新

先确认：

- 看的是不是正确 project
- branch 是否是 `preview`
- 壳的 channel 是否匹配
- 使用的是不是 dev client / 原生预览壳

### 3. Deep link 报错 no custom scheme defined

说明 `app.json` 没有自定义 `scheme`，或者当前原生壳太旧，需要重新构建。

## GitHub Actions 构建

仓库已提供工作流：`.github/workflows/eas-build.yml`

使用前需要在 GitHub 仓库 Secrets 里配置：

- `EXPO_TOKEN`

触发方式：

1. 打开 GitHub 仓库的 `Actions`
2. 选择 `EAS Build`
3. 点击 `Run workflow`
4. 选择：
   - `profile`: `preview` 或 `production`
   - `platform`: `android` / `ios` / `all`

工作流会执行：

```bash
npm ci
npx eas build --non-interactive --profile <profile> --platform <platform>
```

## 爱思助手自签 IPA

没有付费 Apple Developer 账号时，可使用仓库的 `iOS Unsigned IPA` 工作流在 GitHub macOS runner 上编译未签名 arm64 Release IPA，再用爱思助手或个人证书重签。

该流程不需要 `EXPO_TOKEN` 或 Apple 凭据，具体步骤见 [iOS 未签名 IPA 与爱思助手自签](IOS_UNSIGNED_IPA.md)。

## 正式包

```bash
npm run eas:build:production
```

## OTA 更新

预发：

```bash
npx eas update --branch preview --message "preview update"
```

正式：

```bash
npx eas update --branch production --message "production update"
```
