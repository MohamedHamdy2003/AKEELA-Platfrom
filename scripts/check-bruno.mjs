import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import lang from '@usebruno/lang';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const collection = path.join(root, 'bruno', 'AKEELA');
const read = (name) => readFile(path.join(collection, name), 'utf8');
assert.equal(JSON.parse(await read('bruno.json')).name, 'AKEELA APIs');
const config = lang.collectionBruToJson(await read('collection.bru'));
assert.equal(config.auth.bearer.token, '{{access_token}}');
for (const name of ['Local.bru', 'Production.bru'])
  lang.bruToEnvJsonV2(await read(`environments/${name}`));
const spec = await readFile(path.join(root, 'AKEELA-Features.md'), 'utf8');
const sections = new Map(
  spec.split(/^## /m).flatMap((section) => {
    const number = section.match(/^(\d{2})\./)?.[1];
    return number ? [[number, section]] : [];
  }),
);
const folders = (await readdir(collection, { withFileTypes: true }))
  .filter((item) => item.isDirectory() && /^\d{2} - /.test(item.name))
  .map((item) => item.name)
  .sort();
assert.ok(folders.length > 0);
const inventory = [];
for (const folder of folders) {
  lang.collectionBruToJson(await read(`${folder}/folder.bru`));
  const section = sections.get(folder.slice(0, 2));
  assert.ok(section, `No feature specification for ${folder}`);
  const actual = [];
  for (const file of (await readdir(path.join(collection, folder)))
    .filter((name) => name.endsWith('.bru') && name !== 'folder.bru')
    .sort()) {
    const value = lang.bruToJsonV2(await read(`${folder}/${file}`));
    const route = value.http.url
      .replace('{{base_url}}', '')
      .split('?')[0]
      .replace(/\{\{([^}]+)\}\}/g, '{$1}');
    actual.push(`${value.http.method.toUpperCase()} ${route}`);
    if (value.body?.json) JSON.parse(value.body.json);
    if (value.script?.res) {
      new Script(value.script.res);
      assert.ok(
        !value.script.res.includes('setEnvVar'),
        'Tokens must stay in runtime variables.',
      );
    }
    if (value.tests) new Script(value.tests);
    const isPublic =
      route.startsWith('/restaurants') ||
      (route.startsWith('/auth/') && route !== '/auth/logout');
    assert.equal(value.http.auth, isPublic ? 'none' : 'inherit');
  }
  const expected = [
    ...section.matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)`/gm),
  ].map((item) => `${item[1]} ${item[2]}`);
  assert.deepEqual(actual, expected, `Bruno coverage differs for ${folder}`);
  inventory.push(...actual);
}
assert.equal(new Set(inventory).size, inventory.length);
console.log(
  `Bruno check passed: ${inventory.length} APIs match ${folders.length} implemented feature folders; files, bodies, auth modes, and scripts are valid.`,
);
