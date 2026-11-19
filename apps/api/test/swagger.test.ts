import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { Type } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getMetadataStorage, validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import SwaggerParser from '@apidevtools/swagger-parser';
import {
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { configureApplication } from '../src/bootstrap';
import {
  configureSwagger,
  createApiDocument,
} from '../src/documentation/swagger';
import { operations } from '../src/documentation/operations';
import { PUBLIC_ROUTE } from '../src/common/http/public-route.decorator';

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(directory, e.name))
      : [join(directory, e.name)],
  );
}

const moduleFiles = files(join(__dirname, '../src/modules'));
const loadModule = createRequire(__filename);
// Discover real controllers, including HealthController which shares health.module.ts.
const controllers = moduleFiles
  .filter((f) => f.endsWith('.controller.js') || f.endsWith('health.module.js'))
  .flatMap((f) =>
    Object.values(loadModule(f) as Record<string, Type<unknown>>).filter(
      (value) =>
        typeof value === 'function' &&
        Reflect.hasMetadata(PATH_METADATA, value),
    ),
  );
const dtos = moduleFiles
  .filter((f) => f.endsWith('.dto.js'))
  .flatMap((f) =>
    Object.values(loadModule(f) as Record<string, Type<object>>).filter(
      (v) => typeof v === 'function' && /^[A-Z]/.test(v.name),
    ),
  );

test('OpenAPI describes every real REST route with validated schemas, inputs, auth and response envelopes', async () => {
  // No business handler runs and no database, SMTP or real account is used.
  const module = await Test.createTestingModule({ controllers })
    .useMocker(() => ({}))
    .compile();
  const app = module.createNestApplication({ logger: false });
  configureApplication(app, []);
  try {
    const doc = createApiDocument(app);
    const publicByOperation = new Map<string, boolean>();
    for (const controller of controllers) {
      for (const method of Object.getOwnPropertyNames(controller.prototype)) {
        if (method === 'constructor') continue;
        const handler = controller.prototype[method] as object;
        publicByOperation.set(
          `${controller.name.replace(/Controller$/, '')}_${method}`,
          Reflect.getMetadata(PUBLIC_ROUTE, handler) ??
            Reflect.getMetadata(PUBLIC_ROUTE, controller) ??
            false,
        );
      }
    }
    const found = Object.entries(doc.paths)
      .flatMap(([path, item]) =>
        Object.keys(item)
          .filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m))
          .map((method) => `${method} ${path}`),
      )
      .sort();
    assert.equal(found.length, 81);
    assert.deepEqual(
      found,
      operations.map((o) => `${o.method} ${o.path}`).sort(),
    );
    const spec = readFileSync(
      join(process.cwd(), '../../AKEELA-Responses-Requests.md'),
      'utf8',
    );
    const specified = [
      ...spec.matchAll(/^\| (GET|POST|PATCH|PUT|DELETE) \| `([^`]+)`/gm),
    ]
      .map((m) => `${m[1]!.toLowerCase()} /api/v1${m[2]}`)
      .sort();
    assert.deepEqual(found, specified);
    // Official OpenAPI structural validation and local-reference resolution.
    await SwaggerParser.validate(JSON.parse(JSON.stringify(doc)), {
      resolve: { external: false },
    });
    const ids = new Set<string>();
    for (const entry of operations) {
      const operation = doc.paths[entry.path]![entry.method as 'get']!;
      assert.ok(operation.operationId);
      assert.ok(!ids.has(operation.operationId));
      ids.add(operation.operationId);
      assert.equal(operation.tags?.length, 1);
      assert.ok(
        operation.summary && operation.description?.includes('Access:'),
      );
      assert.equal(
        operation.security?.length,
        publicByOperation.get(operation.operationId) ? 0 : 1,
      );
      assert.ok(operation.responses[entry.status]);
      for (const response of Object.values(operation.responses))
        if (response && !('$ref' in response))
          assert.ok(response.content?.['application/json']?.schema);
      const body = operation.requestBody as RequestBodyObject | undefined;
      if (entry.bodyExample) {
        assert.ok(body?.required);
        const schema = body.content['application/json']!
          .schema! as SchemaObject;
        const reference =
          '$ref' in schema
            ? (schema.$ref as string)
            : (schema.allOf![0] as { $ref: string }).$ref;
        const name = reference.split('/').at(-1)!;
        const dto = dtos.find((d) => d.name === name);
        assert.ok(dto, name);
        assert.deepEqual(
          await validate(plainToInstance(dto, entry.bodyExample), {
            whitelist: true,
            forbidNonWhitelisted: true,
          }),
          [],
          `${entry.method} ${entry.path} example must pass actual DTO validation`,
        );
      }
    }
    // DTO/schema field parity includes inherited properties and query aliases.
    for (const dto of dtos) {
      const metadata = getMetadataStorage().getTargetValidationMetadatas(
        dto,
        '',
        false,
        false,
      );
      const schema = doc.components!.schemas![dto.name] as
        SchemaObject | undefined;
      if (!metadata.length) continue;
      assert.ok(schema, dto.name);
      assert.deepEqual(
        Object.keys(schema.properties ?? {}).sort(),
        [...new Set(metadata.map((m) => m.propertyName))].sort(),
        dto.name,
      );
      for (const property of Object.values(schema.properties ?? {}))
        if (!('$ref' in property)) assert.ok(property.description, dto.name);
    }
    const query = doc.paths['/api/v1/customer/orders']!.get!
      .parameters as ParameterObject[];
    assert.deepEqual(
      query.map((p) => p.name).sort(),
      ['page', 'per_page', 'limit', 'offset', 'scope', 'status'].sort(),
    );
    assert.equal(
      (query.find((p) => p.name === 'page')!.schema as SchemaObject).maximum,
      10000,
    );
    const list = responseSchema(doc, '/api/v1/customer/orders', 'get', 200);
    assert.ok(list.properties?.meta);
    const links = responseSchema(
      doc,
      '/api/v1/restaurant/products/{prod_id}/addons',
      'get',
      200,
    );
    assert.ok(!links.properties?.meta);
    const cart = (
      doc.paths['/api/v1/customer/cart/items']!.post!
        .requestBody as RequestBodyObject
    ).content['application/json']!.schema as SchemaObject;
    assert.equal(cart.oneOf?.length, 2);
    const checkout = (
      doc.paths['/api/v1/customer/orders']!.post!
        .requestBody as RequestBodyObject
    ).content['application/json']!;
    assert.equal((checkout.schema as SchemaObject).oneOf?.length, 2);
    assert.ok(checkout.examples?.oneTimeAddress);
    for (const entry of operations.filter((o) => o.tag.startsWith('15'))) {
      const body = doc.paths[entry.path]!.put!.requestBody as RequestBodyObject;
      assert.deepEqual(
        (body.content['multipart/form-data']!.schema as SchemaObject).required,
        ['file'],
      );
    }
    for (const [model, field] of [
      ['OrderSummary', 'order_id'],
      ['Product', 'price'],
      ['Address', 'longitude'],
    ] as const) {
      const property = (doc.components!.schemas![model] as SchemaObject)
        .properties![field] as SchemaObject;
      assert.equal(property.type, 'string');
    }
    assert.equal(
      (
        (doc.components!.schemas!.User as SchemaObject).properties!
          .email_verified_at as SchemaObject
      ).nullable,
      true,
    );
    // Serve only documentation; Swagger middleware is independent of access guards.
    configureSwagger(app);
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    const response = await fetch(`${origin}/api/v1/docs-json`);
    assert.equal(response.status, 200);
    const served = (await response.json()) as OpenAPIObject;
    assert.deepEqual(
      Object.keys(served.paths).sort(),
      Object.keys(doc.paths).sort(),
    );
    const html = await fetch(`${origin}/api/v1/docs/`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /swagger-ui/);
    assert.equal(
      (await fetch(`${origin}/api/v1/docs/swagger-ui-bundle.js`)).status,
      200,
    );
    const init = await (
      await fetch(`${origin}/api/v1/docs/swagger-ui-init.js`)
    ).text();
    assert.match(init, /"persistAuthorization": false/);
    assert.match(init, /"validatorUrl": null/);
    assert.equal((await fetch(`${origin}/api/v1/docs-yaml`)).status, 404);
  } finally {
    await app.close();
  }
});

function responseSchema(
  doc: OpenAPIObject,
  path: string,
  method: 'get',
  status: number,
): SchemaObject {
  const operation = doc.paths[path]![method] as OperationObject;
  const response = operation.responses[status]!;
  assert.ok(!('$ref' in response));
  return response.content!['application/json']!.schema as SchemaObject;
}
