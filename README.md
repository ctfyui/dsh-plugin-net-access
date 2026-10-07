# Net Access for current DSH

[English](README.en.md) | 简体中文

这是 [Gumiho12345/dsh-plugin-net-access](https://github.com/Gumiho12345/dsh-plugin-net-access) 的兼容分支。0.4.0 使用 DSH 公开的子进程插件接口，提供 Windows OpenSSL/LibreSSL curl 工具环境，不再给引擎文件打补丁。

已验证：DSH `0.2.0-rc.2`（npm `latest`）和 `0.2.1-alpha.1`（npm `alpha`），Windows x64，Node 24。版本核验日期：2026-10-07。完整验证记录见 [兼容性说明](docs/compatibility.md)。

## 安装

需要 Windows 10/11、Node.js 22 或更高版本、npm、pnpm 和系统 `tar.exe`；有 HTTP(S) 代理时建议 Node 24.5 或更高版本。请先停止要安装插件的 DSH profile。

```powershell
git clone https://github.com/ctfyui/dsh-plugin-net-access.git
cd dsh-plugin-net-access
node scripts/setup.mjs
npx @deepseek-ai/dsh plugin --profile web add .
npx @deepseek-ai/dsh --profile web --no-open
```

`setup.ps1` 也是同一安装器的 PowerShell 入口。Node 入口可以直接使用，不依赖 PowerShell 脚本执行策略。将 `web` 换成你的实际 profile 名称。此 fork 的 npm 包名是 `@ctfyui/dsh-plugin-net-access`，尚未发布到 npm，请使用上面的本地目录安装方式，不要误装上游旧 npm 包。

安装器从 curl 官方站点下载固定的 `8.22.0_3` x64/ARM64 构建，先验证仓库中记录的 SHA-256，再解压、检查 TLS 后端和 CA 文件，最后进行 HTTPS 验证。已有工具箱会先验证并复用，损坏的现有目录不会被覆盖。它只安装工具箱，不修改系统 PATH、Git 全局配置、DSH 引擎或你的 profile YAML。

默认工具箱为 `$DSH_HOME/netaccess-tools/bin`，未设置 `DSH_HOME` 时为 `~/.dsh/netaccess-tools/bin`。自定义目录时，安装和启动都要指定：

```powershell
$env:DSH_NETACCESS_TOOLBIN = 'D:\Tools\dsh-curl\bin'
node scripts/setup.mjs --tool-bin $env:DSH_NETACCESS_TOOLBIN
npx @deepseek-ai/dsh --profile web
```

也可以在 profile 用户层配置 `net-access-subprocess` 的 `toolBin`。自备工具箱应包含非 Schannel 的 `curl.exe` 和 PEM 格式 CA 文件（`curl-ca-bundle.crt`、`cacert.pem` 或 `ca-bundle.crt`）。离线验证可用 `--skip-download --skip-https-check`；此时没有执行联网验证。

## 行为与边界

- 权限选择器中的 **Net Access** 对应原生 `workspace-write + ask`，不会创建第四种沙箱模式，也不会自动切换当前会话权限。
- 工具箱环境作用于这个 profile 的本地子进程，包括普通命令、后台任务和新建持久终端，且对所有权限预设生效；切换预设不是开关网络的操作。文件权限仍由当时的原生沙箱模式决定。
- 插件只给每个子进程添加 PATH 和默认 `CURL_CA_BUNDLE`，不改变 DSH 宿主进程的环境、不复制宿主密钥、不修改沙箱 argv、受限令牌或审批逻辑。已有企业 CA 配置保留。
- 这是本地 Windows profile 插件。不要与替换 `subprocess` 服务的 SSH/远程沙箱插件同时使用。非 Windows 上不会加载 Windows 子进程实现。
- 原生 Windows ACL 后端有 DSH 自身的限制，报告 `partial` enforcement。本插件不增强该后端，也不将其描述成绝对隔离。
- `Invoke-WebRequest` 和系统目录中显式指定的 Schannel curl 不会因此修复。请使用 PATH 上的 `curl.exe`。插件不调整 Git TLS 后端。
- 持久终端需要重建后才能获得新的环境；安装、卸载或更新后应完整重启 DSH。

bundle 会提供官方三种预设和 Net Access 的完整表。DSH 的用户 profile 覆盖层优先级更高；如果你已有自定义 `permission` 配置，需要自行在该表加入 `net-access: { sandbox: workspace-write, approval: ask, name: Net Access }`。安装器不会覆盖这份配置。

## 验证

在 DSH 内选择 Net Access 或 workspace-write，再运行：

```powershell
(Get-Command curl.exe).Source
curl.exe --disable --fail --silent --show-error https://example.com
```

开发者回归（仓库中）：

```powershell
pnpm install
node scripts/setup.mjs --tool-bin "$PWD\.validation\toolbox\bin"
pnpm test
pnpm test:integration
```

集成测试在新建的用户临时目录中验证工作区写入、越界写入拒绝、read-only 拒绝、HTTPS HTTP 200/TLS 校验及真实终端 PATH。不会向桌面或现有用户文件写入。测试启动的 Cordis 服务先清理；Node 测试运行器使用 `--test-force-exit` 结束上游 native/worker 残留句柄。

若出现 `SetNamedSecurityInfoW failed (Win32 5)`，这是原生 DSH 无法设置工作区 ACL/完整性标签。请使用当前用户有完整控制权限的工作区；不应通过切到 full access 掩盖安装验证失败。

## 从 0.3.0 迁移和卸载

原版 0.3.0 修改了引擎、配置及会话中的模式名。请停掉 DSH，卸载旧 bundle，并重新安装一份干净的目标 DSH 版本。**不要把旧 `.netaccess.bak` 覆盖到新版引擎上**。先备份并检查用户 profile，移除遗留的 `sandbox: net-access`；该值不是新版合法沙箱模式。含旧模式记录的历史会话建议保留归档，并新建会话使用新插件。

历史 `patches/`、`manifest.json`、`tools/build-recipes.py`、`extras/` 和 `docs/findings-zh.md` 仅保留为上游研究记录，不在 0.4.0 安装包中使用或分发。`install.ps1` 现在只转到工具箱安装，不扫描或恢复旧引擎文件。

卸载当前版本（先停止 DSH）：

```powershell
npx @deepseek-ai/dsh plugin --profile web remove @ctfyui/dsh-plugin-net-access
```

重新启动后恢复官方子进程实现；工具箱和历史备份保留，避免误删共享文件。`uninstall.ps1` 会显示此操作说明。

## 许可

MIT。保留上游作者和 DeepSeek 的原有许可；curl 二进制单独从官方站点下载，安装时保留其 `COPYING.txt`。
