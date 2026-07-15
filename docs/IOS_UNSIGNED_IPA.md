# iOS 未签名 IPA 与爱思助手自签

仓库提供 `iOS Unsigned IPA` GitHub Actions 工作流，用 GitHub 的 macOS 26 / Xcode 26.4 runner 编译 arm64 iPhone Release 包。产物不包含证书或描述文件，必须重新签名后才能安装。

## 构建

1. 打开 GitHub 仓库的 `Actions` 页面。
2. 选择 `iOS Unsigned IPA`。
3. 点击 `Run workflow`，分支选择 `main`。
4. 等待 `Build unsigned device IPA` 完成。
5. 在运行页面底部下载 `sub2api-mobile-ios-unsigned-*` artifact。
6. 解压 artifact，得到 `.ipa` 和 `BUILD-INFO.txt`。

工作流会在上传前检查：

- Xcode 版本不低于 26.4
- Expo Doctor 与 TypeScript 通过
- 目标是 arm64 iPhone 设备而不是模拟器
- Release 包内包含离线 JavaScript/Hermes bundle
- IPA 使用标准的 `Payload/*.app` 结构
- 主 App 不带签名与 provisioning profile

## 爱思助手签名与安装

1. 在 Windows 上打开爱思助手并连接 iPhone。
2. 进入 `工具箱`，选择 `IPA 签名`。
3. 添加下载的未签名 `.ipa`。
4. 选择你的 Apple ID、个人证书或其他可用签名证书。
5. 完成签名后安装生成的新 IPA。
6. 如果系统阻止启动，到 iPhone 的证书/设备管理页面信任对应开发者。
7. iOS 16 及以上如仍提示开发者模式，请在 `设置 -> 隐私与安全性 -> 开发者模式` 中启用并重启。

该工作流生成的是自带完整 JS bundle 的 Release IPA，正常使用时不需要 Metro，也不需要电脑与手机保持在同一网络。

## 更新

代码更新后重新运行工作流并重新签名安装。签名有效期由所用证书决定；使用免费个人签名时通常需要定期重新签名。

应用 Bundle ID 为 `com.ppx.sub2apimobile`。更换签名身份后，Keychain 访问组可能变化，首次启动时可能需要重新填写服务器地址与 Admin Token。

## 安全说明

- 不要把 Apple ID 密码、`.p12`、provisioning profile 或爱思签名资料上传到仓库或 GitHub Secrets。
- GitHub artifact 是未签名二进制，任何获取它的人仍无法直接安装，但可以自行重签。
- 第三方自签不属于 Expo 或 Apple 官方分发流程；需要官方真机分发时，应改用付费 Apple Developer 账号与 EAS Ad Hoc、TestFlight 或 App Store。
