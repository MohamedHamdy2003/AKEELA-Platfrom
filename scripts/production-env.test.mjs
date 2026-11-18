import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  parsePrivateEnvironment,
  renderPrivateEnvironment,
} from './production-env.mjs';
const { parse } = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
)('dotenv');
test('private Compose encoding is repeatable and preserves dollar signs, apostrophes and backslashes', () => {
  const values = {
    PASSWORD: "synthetic'\\value$part #sample",
    NAME: 'اسم عربي',
    EMPTY: '',
    ESCAPED: "back\\'quote",
  };
  const rendered = renderPrivateEnvironment(values);
  const parsed = parsePrivateEnvironment(rendered, parse);
  assert.deepEqual(parsed, values);
  assert.equal(renderPrivateEnvironment(parsed), rendered);
  assert.deepEqual(
    parsePrivateEnvironment("PASSWORD='owner\\'value'", parse),
    parse("PASSWORD='owner\\'value'"),
  );
  assert.throws(() => renderPrivateEnvironment({ PASSWORD: 'line\nbreak' }));
});
