import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as http from 'node:http';
import { inspectToolbox, resolveToolBin } from '../plugin/environment.js';

/** Verify downloaded bytes before extraction or executing any downloaded code. */
export function verifyArchive(bytes, expected) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error(`curl archive SHA-256 mismatch: ${actual}`);
}

/** Install the official pinned Windows build; never edit engine/profile files. */
export async function setup(args = process.argv.slice(2)) {
  if (process.platform !== 'win32') throw new Error('Net Access setup requires Windows.');
  const { values } = parseArgs({ args, options: {
    'tool-bin': { type: 'string' }, 'skip-download': { type: 'boolean' },
    'skip-https-check': { type: 'boolean' },
  } });
  const toolBin = resolveToolBin({ toolBin: values['tool-bin'] });
  if (!existsSync(join(toolBin, 'curl.exe')) && !values['skip-download']) {
    const builds = JSON.parse(await readFile(new URL('./curl-builds.json', import.meta.url), 'utf8'));
    const build = builds[process.arch];
    if (!build) throw new Error(`No pinned curl build for ${process.arch}; provide your own toolbox.`);
    if (existsSync(toolBin)) throw new Error(`Refusing to replace existing incomplete toolbox: ${toolBin}`);
    await mkdir(dirname(toolBin), { recursive: true });
    // Staging is a freshly created sibling on the same volume, for atomic rename.
    const stage = await mkdtemp(join(dirname(toolBin), '.netaccess-'));
    try {
      const url = `https://curl.se/windows/dl-${builds.version}/${build.archive}`;
      console.log(`Downloading ${url}`);
      const restoreProxy = http.setGlobalProxyFromEnv?.();
      let bytes;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error(`curl download failed: HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
      } finally {
        restoreProxy?.();
      }
      verifyArchive(bytes, build.sha256);
      console.log(`Verified SHA-256 ${build.sha256}`);
      const archive = join(stage, 'curl.zip');
      await writeFile(archive, bytes);
      const extracted = join(stage, 'extracted');
      await mkdir(extracted);
      execFileSync('tar.exe', ['-xf', archive, '-C', extracted],
        { stdio: 'inherit', windowsHide: true, timeout: 60_000 });
      const roots = (await readdir(extracted, { withFileTypes: true })).filter(item => item.isDirectory());
      if (roots.length !== 1) throw new Error('Unexpected curl archive layout.');
      const root = join(extracted, roots[0].name);
      const stagedBin = join(root, 'bin');
      inspectToolbox(stagedBin);
      // Preserve the upstream binary redistribution license beside the binaries.
      await copyFile(join(root, 'COPYING.txt'), join(stagedBin, 'COPYING.txt'));
      await writeFile(join(stagedBin, 'net-access-install.json'), JSON.stringify({
        version: builds.version, url, sha256: build.sha256,
      }, null, 2) + '\n');
      await rename(stagedBin, toolBin);
    } finally {
      // Only our mkdtemp-created directory is removed, never the chosen toolbox.
      await rm(stage, { recursive: true, force: true });
    }
  }
  const toolbox = inspectToolbox(toolBin);
  console.log(toolbox.version);
  if (!values['skip-https-check']) {
    execFileSync(toolbox.executable, ['--disable', '--fail', '--silent', '--show-error',
      '--cacert', process.env.CURL_CA_BUNDLE || toolbox.caBundle, '--max-time', '30',
      '--output', 'NUL', '--write-out', 'HTTPS HTTP %{http_code}; TLS verify %{ssl_verify_result}\n',
      'https://example.com'], { stdio: 'inherit', windowsHide: true, timeout: 35_000 });
  }
  console.log(`Toolbox ready: ${toolBin}`);
  console.log('Enable the bundle using dsh plugin add, then restart DSH. See README.md.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup().catch(error => { console.error(error.message); process.exitCode = 1; });
}
