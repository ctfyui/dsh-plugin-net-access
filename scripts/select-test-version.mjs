// CI-only: select one tested upstream release before installing test dependencies.
import { readFileSync, writeFileSync } from 'node:fs';
const version = process.env.DSH_TEST_VERSION;
if (!['0.2.0-rc.2', '0.2.1-alpha.1'].includes(version)) throw new Error('Select a supported DSH_TEST_VERSION.');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const name of Object.keys(pkg.devDependencies)) {
  if (name.startsWith('@deepseek-ai/dsh')) pkg.devDependencies[name] = version;
}
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
