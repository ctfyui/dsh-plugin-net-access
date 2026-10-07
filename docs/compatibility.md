# Compatibility and validation

Checked 2026-10-07 against the public npm registry and upstream source.

| Target | Registry tag | Unit/composition/provider tests | Real Windows integration |
| --- | --- | --- | --- |
| DSH 0.2.0-rc.2 | latest / next | 10 passed | 2 passed |
| DSH 0.2.1-alpha.1 | alpha | 10 passed | 2 passed |

Environment: Windows x64, Node 24.19.0, pnpm 11.19.0. The alpha dependencies were installed in a separate directory, with the same plugin and test sources. ARM64 download metadata is included, but ARM64 execution has not been tested. Versions outside the explicit peer range require a fresh compatibility run.

## Observed behavior

- Real `LocalSandboxProvider` + `SandboxPolicyService` + `SandboxPwshExecutor`, with this plugin replacing `LocalSubprocessRuntime`: curl resolved to the verified toolbox, HTTPS returned **HTTP 200 / TLS verify 0**, a workspace file was created, a sibling file outside the workspace was denied and absent, and read-only writes were denied and absent.
- Real ConPTY terminal startup: `where curl.exe` found the toolbox; the host PATH was unchanged. This checks the provider's terminal route, not a full interactive DSH persistent-tool conversation.
- Official Cordis patch composition: Net Access resolves to `workspace-write + ask`; original sandbox provider and caller argv remain unchanged. User permission overrides retain final precedence.
- Download integrity: official x64 curl archive matched `f38b0ac2e3a280fd414b607c874a21e6dd4d1ed0e2ae622afbf0020917446561` before extraction, executable inspection, or use.
- Packaged installation on 0.2.0-rc.2: `dsh plugin --profile web add file:<package.tgz>` succeeded in an isolated DSH_HOME; `--dump-config` showed the new provider and preset; Web CLI help and actual Web server startup succeeded. An unauthenticated HTTP request returned the expected 401.

No production profile was modified. No model/API-key conversation, browser interaction with the selector, or exhaustive ACL escape testing was performed. Native Windows enforcement still reports the upstream `partial` boundary.

## Environment findings

The outer coding sandbox denies captured process pipes (`spawn EPERM`), so builds and real integration tests ran outside that outer sandbox. DSH's own restricted-token runner remained active inside the integration tests.

The D: project directory allowed Modify but the stock DSH runner could not set its mandatory label (`SetNamedSecurityInfoW`, Win32 5). Tests use freshly created user-temp directories with the permissions the upstream runner needs. They remove only their own random test directory. This is not a plugin workaround for the target sandbox.

The integration runner uses `--test-force-exit` after explicit Cordis teardown because upstream native/worker handles keep Node alive. Test assertions and failures still determine the exit code.

## Reproduce

Use the commands in the README. To exercise alpha in a separate checkout, set `DSH_TEST_VERSION=0.2.1-alpha.1`, run `node scripts/select-test-version.mjs`, then `pnpm install --no-frozen-lockfile`, setup, and both test suites. The GitHub workflow uses this matrix. Local results above do not claim a completed GitHub-hosted CI run.

## Sources

- [Original plugin](https://github.com/Gumiho12345/dsh-plugin-net-access), base commit `bbd0458b79f0342587750686dfa35a2f65ccb541`.
- [Official DSH repository](https://github.com/deepseek-ai/deepseek-harness), inspected main at `5badb15` (`dsh-v0.2.1-alpha.1`).
- [Official npm metadata](https://registry.npmjs.org/@deepseek-ai/dsh): latest/next `0.2.0-rc.2`, alpha `0.2.1-alpha.1` at verification time.
- [Official curl Windows builds](https://curl.se/windows/): 8.22.0_3, LibreSSL 4.3.3, pinned x64 and ARM64 SHA-256 values in `scripts/curl-builds.json`.

## Design changes from 0.3.0

The old release modified compiled engine files, introduced an unsupported sandbox mode and replaced the user's profile patch. Version 0.4.0 installs a subclass of the official local subprocess provider through normal bundle composition. It overrides only executable lookup, ordinary spawn and terminal spawn, supplying a narrow per-child environment. The stock provider retains all process management and the stock sandbox retains all confinement decisions. The alias preset records supported sandbox/approval values. No source patch anchors, compiled chunk names, UI patches or engine backup restoration are required.
