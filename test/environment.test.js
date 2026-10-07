import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { assertCurlVersion, resolveToolBin, toolboxEnvironment } from '../plugin/environment.js';
import { verifyArchive } from '../scripts/setup.mjs';

const toolbox = { toolBin: 'C:\\HTTPS Tools\\bin', caBundle: 'C:\\HTTPS Tools\\bin\\curl-ca-bundle.crt' };

test('PATH injection does not copy host credentials or mutate input', () => {
  const input = Object.freeze({ TASK: '1' });
  const parent = { Path: 'C:\\Windows', DEEPSEEK_API_KEY: 'must-not-leak', DSH_SECRET: 'must-not-leak' };
  assert.deepEqual(toolboxEnvironment(input, toolbox, parent), {
    TASK: '1', Path: `${toolbox.toolBin};C:\\Windows`, CURL_CA_BUNDLE: toolbox.caBundle,
  });
});

test('Windows PATH casing and repeated overlays do not create duplicate keys or directories', () => {
  const parent = { Path: 'C:\\Windows' };
  const env = toolboxEnvironment({ PATH: 'c:\\https tools\\bin;D:\\custom', task: 'x' }, toolbox, parent);
  assert.equal(env.Path, `${toolbox.toolBin};D:\\custom`);
  assert.equal(Object.keys(env).filter(key => key.toUpperCase() === 'PATH').length, 1);
  assert.deepEqual(toolboxEnvironment(env, toolbox, parent), env);
});

test('explicit or inherited corporate CA settings are retained', () => {
  assert.equal(toolboxEnvironment({ CURL_CA_BUNDLE: 'D:\\corporate.pem' }, toolbox, {}).CURL_CA_BUNDLE, 'D:\\corporate.pem');
  assert.equal(toolboxEnvironment({}, toolbox, { CURL_CA_BUNDLE: 'D:\\parent.pem' }).CURL_CA_BUNDLE, 'D:\\parent.pem');
  assert.equal(toolboxEnvironment({ curl_ca_bundle: 'D:\\override.pem' }, toolbox, { CURL_CA_BUNDLE: 'D:\\parent.pem' }).CURL_CA_BUNDLE, 'D:\\override.pem');
});

test('missing PATH still selects the toolbox', () => {
  assert.equal(toolboxEnvironment({}, toolbox, {}).PATH, toolbox.toolBin);
});

test('accept OpenSSL/LibreSSL and reject Schannel or unidentified TLS', () => {
  for (const tls of ['OpenSSL/3.5.0', 'LibreSSL/4.3.3']) assert.match(assertCurlVersion(`curl 8.22.0 (Windows) ${tls}\nRelease-Date: x`), /curl/);
  for (const line of ['curl 8.22.0 Schannel', 'curl 8.22.0 SSL', 'not curl', 'curl 8.22.0 OpenSSL/3.5 Schannel']) {
    assert.throws(() => assertCurlVersion(line), /OpenSSL or LibreSSL/);
  }
});

test('explicit toolbox overrides DSH_HOME; relative and PATH-list values fail', () => {
  const dir = resolve('.validation/toolbox/bin');
  assert.equal(resolveToolBin({ toolBin: dir }, { DSH_HOME: resolve('.validation/other') }), dir);
  assert.equal(resolveToolBin({}, { DSH_NETACCESS_TOOLBIN: dir }), dir);
  assert.throws(() => resolveToolBin({ toolBin: 'relative/bin' }), /absolute/);
  assert.throws(() => resolveToolBin({ toolBin: `${dir};bad` }), /semicolons/);
});

test('corrupt or substituted archives fail before extraction', () => {
  const bytes = Buffer.from('archive');
  verifyArchive(bytes, createHash('sha256').update(bytes).digest('hex'));
  assert.throws(() => verifyArchive(Buffer.from('substituted'), createHash('sha256').update(bytes).digest('hex')), /SHA-256 mismatch/);
});
