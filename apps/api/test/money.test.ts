import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { moneyCents } from '../src/common/money';
import { validate } from 'class-validator';
import { CreateProductDto } from '../src/modules/catalog/catalog.dto';
test('prices preserve decimal cents and reject values beyond PostgreSQL precision', async () => {
  assert.equal(moneyCents('0.29'), 29n);
  assert.equal(moneyCents('9999999999.99'), 999999999999n);
  for (const invalid of ['', '-1', '1.001', '1e3', 'abc', ' 10.00']) {
    assert.throws(() => moneyCents(invalid), RangeError);
  }
  for (const price of ['99999999999.99', '1e3', '0.001', '-1']) {
    const errors = await validate(
      Object.assign(new CreateProductDto(), {
        cat_id: '1',
        prod_name: 'Item',
        price,
      }),
    );
    assert.ok(errors.some((error) => error.property === 'price'));
  }
});
