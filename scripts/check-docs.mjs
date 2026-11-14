import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const features = await read('AKEELA-Features.md');
const contracts = await read('AKEELA-Responses-Requests.md');
const routePattern = /^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)`/gm;
const routes = (text) =>
  [...text.matchAll(routePattern)].map((match) => `${match[1]} ${match[2]}`);
const inventory = routes(features);
assert.equal(
  new Set(inventory).size,
  inventory.length,
  'Duplicate feature route',
);
assert.deepEqual(routes(contracts), inventory, 'API inventories differ');

for (const block of contracts.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)) {
  JSON.parse(block[1]);
}

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await markdownFiles(file)));
    else if (entry.name.endsWith('.md')) files.push(file);
  }
  return files;
}
const documents = [
  'AGENTS.md',
  'README.md',
  ...(await markdownFiles('docs')),
  'apps/api/README.md',
  'apps/admin/README.md',
  'apps/restaurant/README.md',
  'apps/delivery/README.md',
  'deploy/sites-enabled/README.md',
];
for (const file of documents) {
  const text = await read(file);
  if (file.startsWith('docs/frontend/'))
    for (const match of text.matchAll(
      /^\| (GET|POST|PUT|PATCH|DELETE)\s+\| `([^`]+)`/gm,
    ))
      assert.ok(
        inventory.includes(`${match[1]} ${match[2]}`),
        `Unknown API in ${file}: ${match[2]}`,
      );
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^https?:|^#/.test(target)) continue;
    await readFile(
      path.resolve(root, path.dirname(file), target.split('#')[0]),
    );
  }
}
console.log(
  `Documentation checks passed: ${inventory.length} matching API routes, valid JSON examples, local links.`,
);
