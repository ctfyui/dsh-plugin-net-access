import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Context } from '@deepseek-ai/cordis';
import { LocalSandboxProvider } from '@deepseek-ai/dsh-sandbox-local';
import { SandboxPolicyService } from '@deepseek-ai/dsh-sandbox-policy';
import { SandboxPwshExecutor } from '@deepseek-ai/dsh-pwsh-sandbox';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import NetAccessSubprocessRuntime from '../../plugin/index.js';

const toolBin = resolve(process.env.DSH_NETACCESS_TOOLBIN || '.validation/toolbox/bin');
const quote = text => "'" + text.replaceAll("'", "''") + "'";

test('real Windows sandbox: HTTPS works while workspace and read-only writes stay confined', {
  skip: process.platform !== 'win32', timeout: 120_000,
}, async t => {
  assert.ok(existsSync(join(toolBin, 'curl.exe')), 'Run setup.ps1 before the integration suite.');
  mkdirSync('.validation', { recursive: true });
  // User temp carries a user-owned ACL; some D: project roots grant only Modify,
  // which cannot support the official runner's mandatory-label setup.
  const root = mkdtempSync(join(tmpdir(), 'dsh-netaccess-acl-'));
  const workspace = join(root, 'workspace');
  mkdirSync(workspace);
  const ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); rmSync(root, { recursive: true, force: true }); });
  await ctx.plugin(SessionProjectionRegistry);
  await ctx.plugin(LocalSandboxProvider, {});
  await ctx.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: workspace });
  await ctx.plugin(NetAccessSubprocessRuntime, { toolBin });
  await ctx.plugin(SandboxPwshExecutor, {});
  assert.equal(await ctx.subprocess.resolveExecutable('curl.exe'), join(toolBin, 'curl.exe'));
  const run = async (command, mode = 'workspace-write') => {
    const execution = await ctx.shell.execute(ctx.shell.resolve({
      command, workdir: workspace, timeoutMs: 45000,
      sandboxPolicy: { mode, workspaceRoot: workspace },
    }));
    return execution.result();
  };

  const inside = join(workspace, 'allowed.txt');
  const outside = join(root, 'must-not-exist.txt');
  const result = await run([
    "$ErrorActionPreference='Stop'",
    `Set-Content -LiteralPath ${quote(inside)} -Value allowed`,
    `try { Set-Content -LiteralPath ${quote(outside)} -Value escaped; 'ESCAPED' } catch { 'OUTSIDE-DENIED' }`,
    '$env:CURL_CA_BUNDLE',
    '(Get-Command curl.exe).Source',
    'curl.exe --disable --fail --silent --show-error --max-time 25 --output NUL --write-out "HTTP=%{http_code};VERIFY=%{ssl_verify_result}" https://example.com',
    'exit $LASTEXITCODE',
  ].join('; '));
  assert.equal(result.exitCode, 0, JSON.stringify(result));
  assert.match(result.stdout.text, /OUTSIDE-DENIED/);
  assert.match(result.stdout.text, /HTTP=200;VERIFY=0/);
  assert.ok(result.stdout.text.toLowerCase().includes(toolBin.toLowerCase()));
  assert.equal(result.sandbox.mode, 'workspace-write');
  assert.equal(readFileSync(inside, 'utf8').trim(), 'allowed');
  assert.equal(existsSync(outside), false);
  t.diagnostic(result.stdout.text);

  const roFile = join(workspace, 'read-only-must-not-exist.txt');
  const ro = await run(`Set-Content -LiteralPath ${quote(roFile)} -Value denied -ErrorAction Stop`, 'read-only');
  assert.notEqual(ro.exitCode, 0, JSON.stringify(ro));
  assert.equal(existsSync(roFile), false);
  assert.equal(ro.sandbox.mode, 'read-only');
  assert.equal(ro.sandbox.denied, true);
});

test('real terminal startup uses the same curl PATH without changing the host environment', {
  skip: process.platform !== 'win32', timeout: 30_000,
}, async t => {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  const pathBefore = process.env.PATH;
  await ctx.plugin(NetAccessSubprocessRuntime, { toolBin });
  const terminal = await ctx.subprocess.spawnTerminal({
    argv: ['cmd.exe', '/d', '/c', 'where curl.exe'], cwd: process.cwd(),
    rows: 24, cols: 120, terminalType: 'xterm', graceMs: 1000,
  });
  let output = '';
  const reader = (async () => { for await (const chunk of terminal.output) output += chunk; })();
  await terminal.done;
  await reader;
  await terminal.terminate();
  assert.ok(output.toLowerCase().includes(join(toolBin, 'curl.exe').toLowerCase()), output);
  assert.equal(process.env.PATH, pathBefore);
});
