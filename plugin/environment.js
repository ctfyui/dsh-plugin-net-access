import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, win32 } from 'node:path';

/** Resolve the toolbox without changing any process-global environment. */
export function resolveToolBin(config = {}, env = process.env) {
  const selected = config.toolBin ?? env.DSH_NETACCESS_TOOLBIN
    ?? join(env.DSH_HOME || join(homedir(), '.dsh'), 'netaccess-tools', 'bin');
  if (!selected || !isAbsolute(selected) || selected.includes(';')) {
    throw new Error('Net Access: toolBin must be an absolute directory without semicolons.');
  }
  return resolve(selected);
}

/** Reject Schannel and builds without a positively identified supported TLS backend. */
export function assertCurlVersion(output) {
  const first = output.split(/\r?\n/, 1)[0];
  if (!/^curl \d+\./.test(first) || !/\b(?:OpenSSL|LibreSSL)\//.test(first) || /Schannel/i.test(first)) {
    throw new Error('Net Access: curl.exe must use OpenSSL or LibreSSL, not Schannel.');
  }
  return first;
}

/** Validate the user-selected executable and its CA bundle before registering a provider. */
export function inspectToolbox(toolBin) {
  const executable = join(toolBin, 'curl.exe');
  if (!existsSync(executable) || !statSync(executable).isFile()) {
    throw new Error(`Net Access: missing ${executable}. Run setup.ps1 before enabling the plugin.`);
  }
  const caBundle = ['curl-ca-bundle.crt', 'cacert.pem', 'ca-bundle.crt']
    .map(name => join(toolBin, name))
    .find(file => existsSync(file) && statSync(file).isFile());
  if (!caBundle || !readFileSync(caBundle, 'utf8').includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error(`Net Access: no PEM CA bundle in ${toolBin}. Run setup.ps1.`);
  }
  const version = assertCurlVersion(execFileSync(executable, ['--disable', '--version'], {
    encoding: 'utf8', timeout: 10_000, windowsHide: true,
  }));
  return { toolBin, executable, caBundle, version };
}

function keyFor(env, name) {
  return Object.keys(env).find(key => key.toUpperCase() === name);
}

/**
 * Add just PATH and CURL_CA_BUNDLE to the caller's explicit overrides. Never
 * copy the ambient environment: the official provider must still scrub secrets.
 * An explicit CA bundle wins, including corporate trust configurations.
 */
export function toolboxEnvironment(overrides = {}, toolbox, parent = process.env) {
  const result = { ...overrides };
  const parentPathKey = keyFor(parent, 'PATH') ?? 'PATH';
  const explicitPathKey = keyFor(overrides, 'PATH');
  const pathValue = (explicitPathKey ? overrides[explicitPathKey] : parent[parentPathKey]) ?? '';
  for (const key of Object.keys(result)) {
    if (key.toUpperCase() === 'PATH') delete result[key];
  }
  const normalized = value => win32.normalize(value.replace(/^"|"$/g, '')).replace(/\\$/, '').toLowerCase();
  const directories = pathValue.split(';').filter(value => value && normalized(value) !== normalized(toolbox.toolBin));
  result[parentPathKey] = [toolbox.toolBin, ...directories].join(';');
  const parentCaKey = keyFor(parent, 'CURL_CA_BUNDLE');
  const explicitCaKey = keyFor(overrides, 'CURL_CA_BUNDLE');
  for (const key of Object.keys(result)) {
    if (key.toUpperCase() === 'CURL_CA_BUNDLE') delete result[key];
  }
  result[parentCaKey ?? 'CURL_CA_BUNDLE'] = (explicitCaKey ? overrides[explicitCaKey] : undefined)
    ?? (parentCaKey ? parent[parentCaKey] : undefined) ?? toolbox.caBundle;
  return result;
}
