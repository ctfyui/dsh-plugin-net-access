import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalSubprocessRuntime } from '@deepseek-ai/dsh-subprocess-local';
import NetAccessSubprocessRuntime from '../plugin/index.js';

test('ordinary and terminal calls forward sandbox argv, signal and lifecycle fields untouched', async t => {
  const provider = Object.create(NetAccessSubprocessRuntime.prototype);
  provider.toolbox = { toolBin: 'C:\\toolbox', caBundle: 'C:\\toolbox\\ca.pem' };
  const handle = {};
  const spec = Object.freeze({
    argv: Object.freeze(['node.exe', 'windows-acl-runner.js', '--mode', 'read-only', '--', 'pwsh.exe']),
    env: Object.freeze({ TASK: '1' }), signal: new AbortController().signal,
    cwd: 'C:\\workspace', graceMs: 500, stdio: { stdout: 'pipe', stderr: 'pipe', stdin: 'ignore' },
  });
  for (const method of ['spawn', 'spawnTerminal']) {
    const spy = t.mock.method(LocalSubprocessRuntime.prototype, method, forwarded => {
      assert.equal(forwarded.argv, spec.argv);
      assert.equal(forwarded.signal, spec.signal);
      assert.equal(forwarded.stdio, spec.stdio);
      assert.equal(forwarded.cwd, spec.cwd);
      assert.equal(forwarded.graceMs, spec.graceMs);
      assert.equal(forwarded.env.TASK, '1');
      assert.equal(forwarded.env.CURL_CA_BUNDLE, provider.toolbox.caBundle);
      return handle;
    });
    assert.equal(await provider[method](spec), handle);
    assert.equal(spy.mock.callCount(), 1);
    spy.mock.restore();
  }
  assert.deepEqual(spec.env, { TASK: '1' });
});
