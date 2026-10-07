import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { applyEntryPatches, entryListSchema } from '@deepseek-ai/cordis-plugin-include';

test('official patch composer retains native sandbox modes and disables only the local provider', () => {
  const patches = load(readFileSync(new URL('../plugin/cordis.patch.yml', import.meta.url), 'utf8'), { schema: entryListSchema });
  const warnings = [];
  const base = [
    { id: 'subprocess', name: '@deepseek-ai/dsh-subprocess-local' },
    { id: 'permission', name: '@deepseek-ai/dsh-permission-presets' },
    { id: 'sandbox', name: '@deepseek-ai/dsh-sandbox-local' },
  ];
  const result = applyEntryPatches(base, patches, (...args) => warnings.push(args));
  assert.deepEqual(warnings, []);
  assert.equal(base.length, 3);
  const presets = result.find(row => row.id === 'permission').config.presets;
  assert.deepEqual([presets['net-access'].sandbox, presets['net-access'].approval], ['workspace-write', 'ask']);
  assert.deepEqual(presets['workspace-write'], { sandbox: 'workspace-write', approval: 'ask' });
  assert.deepEqual(result.find(row => row.id === 'sandbox'), base[2]);
  assert.equal(result.find(row => row.id === 'subprocess').disabled.__jsExpr, "process.platform === 'win32'");
  assert.equal(result.find(row => row.id === 'net-access-subprocess').disabled.__jsExpr, "process.platform !== 'win32'");
});

test('user permission configuration has final precedence', () => {
  const patches = load(readFileSync(new URL('../plugin/cordis.patch.yml', import.meta.url), 'utf8'), { schema: entryListSchema });
  const custom = { presets: { customName: { sandbox: 'read-only', approval: 'ask' } } };
  const result = applyEntryPatches([{ id: 'subprocess', name: '@deepseek-ai/dsh-subprocess-local' },
    { id: 'permission', name: '@deepseek-ai/dsh-permission-presets' }],
  [...patches, { id: 'permission', config: custom }], () => {});
  assert.deepEqual(result.find(row => row.id === 'permission').config, custom);
});
