# Net Access for current DSH

English | [简体中文](README.md)

A compatibility fork of [Gumiho12345/dsh-plugin-net-access](https://github.com/Gumiho12345/dsh-plugin-net-access). Version 0.4.0 replaces engine patching with a public DSH subprocess provider. Tested on Windows x64 / Node 24 with DSH **0.2.0-rc.2** (npm latest) and **0.2.1-alpha.1** (alpha), checked 2026-10-07. See [validation details](docs/compatibility.md).

## Install

Requires Windows 10/11, Node 22+, npm, pnpm, and Windows tar.exe. Use Node 24.5+ when downloading through HTTP(S) proxy environment variables. Stop the target DSH profile first.

```powershell
git clone https://github.com/ctfyui/dsh-plugin-net-access.git
cd dsh-plugin-net-access
node scripts/setup.mjs
npx @deepseek-ai/dsh plugin --profile web add .
npx @deepseek-ai/dsh --profile web --no-open
```

Replace `web` with your profile name. This fork uses `@ctfyui/dsh-plugin-net-access`, which is not published to npm; install from the local directory. The PowerShell setup.ps1 wrapper invokes the same Node installer. The Node entry does not depend on PowerShell script execution policy.

Setup downloads the pinned official curl 8.22.0_3 build, verifies its recorded SHA-256 **before extraction/execution**, validates LibreSSL/OpenSSL and the PEM CA bundle, and checks HTTPS. It reuses a valid existing toolbox and refuses to overwrite an incomplete directory. It never patches the engine, overwrites profile YAML, or changes system PATH or Git settings.

The default is `$DSH_HOME/netaccess-tools/bin`, falling back to `~/.dsh/netaccess-tools/bin`. For a custom directory, set `DSH_NETACCESS_TOOLBIN` before both setup and DSH launch, and run `node scripts/setup.mjs --tool-bin $env:DSH_NETACCESS_TOOLBIN`. Alternatively configure `toolBin` on the `net-access-subprocess` profile row. A custom toolbox needs curl.exe with OpenSSL/LibreSSL plus curl-ca-bundle.crt, cacert.pem, or ca-bundle.crt. `--skip-download --skip-https-check` permits offline validation, without claiming a network check.

## Behavior

- **Net Access** is a preset for native `workspace-write + ask`. No new sandbox mode is persisted and no session permission is automatically changed.
- The toolbox applies to local subprocesses across **all presets**, including ordinary commands, background jobs and newly created persistent terminals. The preset selector is not a network toggle.
- Only per-child PATH and default CURL_CA_BUNDLE are added. The official DSH implementation retains credential scrubbing, sandbox argv, restricted tokens, approval policy, process ownership and cancellation. Existing corporate CA settings take precedence; the host environment is unchanged.
- Intended for local Windows profiles. Do not combine it with a remote/SSH provider replacing the same subprocess service. The Windows implementation is disabled on other platforms.
- Native Windows ACL enforcement remains DSH's `partial` enforcement, with its original limitations. Schannel Invoke-WebRequest and explicitly selected system curl are not repaired. Git TLS configuration is unchanged.
- Restart DSH and recreate persistent terminals after changes.

The bundle supplies the three stock presets plus Net Access. DSH user overrides win and are never overwritten. If your user layer already defines `permission`, add `net-access: { sandbox: workspace-write, approval: ask, name: Net Access }` to its table yourself.

## Validate

Inside DSH with workspace-write or Net Access selected:

```powershell
(Get-Command curl.exe).Source
curl.exe --disable --fail --silent --show-error https://example.com
```

Repository development:

```powershell
pnpm install
node scripts/setup.mjs --tool-bin "$PWD\.validation\toolbox\bin"
pnpm test
pnpm test:integration
```

Integration tests create disposable user-temp workspaces, check HTTPS/TLS, allowed workspace writes, denied sibling and read-only writes, and real terminal PATH. They dispose Cordis services before the test runner's `--test-force-exit` terminates residual upstream native/worker handles. `SetNamedSecurityInfoW failed (Win32 5)` means DSH cannot set the workspace ACL/integrity label; use a workspace under your user's full control.

## Upgrade from 0.3.0 / uninstall

Stop DSH, remove the old bundle, and install a clean target DSH release. Never restore old `.netaccess.bak` files over a newer engine. Back up and inspect user profile settings, replacing legacy `sandbox: net-access` values. Archive old sessions containing that unsupported mode and create new sessions.

Historical patches/, manifest.json, tools/build-recipes.py, extras/ and docs/findings-zh.md are retained as upstream research only and excluded from the 0.4.0 package. install.ps1 now delegates to toolbox setup.

```powershell
npx @deepseek-ai/dsh plugin --profile web remove @ctfyui/dsh-plugin-net-access
```

Restart to restore the official provider. Toolbox files and historical backups are retained; uninstall.ps1 displays these instructions.

MIT; upstream attribution is preserved. Downloaded curl retains its own COPYING.txt.
