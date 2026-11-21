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
import {
  createRoleDocument,
  swaggerRoles,
} from '../src/documentation/role-documents';

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
    assert.equal(found.length, 85);
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
    assert.match(init, /"urls.primaryName": "Customer"/);
    for (const role of swaggerRoles) {
      const specResponse = await fetch(
        `${origin}/api/v1/docs/${role.slug}-json`,
      );
      assert.equal(specResponse.status, 200, role.slug);
      const spec = (await specResponse.json()) as OpenAPIObject;
      assert.equal(spec.info.title, `AKEELA API — ${role.name}`);
      assert.equal(
        (await fetch(`${origin}/api/v1/docs/${role.slug}/`)).status,
        200,
      );
      const roleInit = await (
        await fetch(`${origin}/api/v1/docs/${role.slug}/swagger-ui-init.js`)
      ).text();
      assert.ok(roleInit.includes(`"urls.primaryName": "${role.name}"`));
      assert.equal(
        (await fetch(`${origin}/api/v1/docs/${role.slug}/swagger-ui-bundle.js`))
          .status,
        200,
      );
    }
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

test('disabled Swagger registers no UI, JSON or asset routes and leaves the API running', async () => {
  const module = await Test.createTestingModule({ controllers })
    .useMocker(() => ({}))
    .compile();
  const app = module.createNestApplication({ logger: false });
  configureApplication(app, []);
  configureSwagger(app, false);
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    for (const path of [
      '/docs',
      '/docs/',
      '/docs-json',
      '/docs/swagger-ui-init.js',
      '/docs/swagger-ui-bundle.js',
      '/docs/swagger-ui.css',
      ...swaggerRoles.flatMap((role) => [
        `/docs/${role.slug}`,
        `/docs/${role.slug}/`,
        `/docs/${role.slug}-json`,
        `/docs/${role.slug}/swagger-ui-init.js`,
        `/docs/${role.slug}/swagger-ui-bundle.js`,
      ]),
    ]) {
      const response = await fetch(`${origin}/api/v1${path}`);
      assert.equal(response.status, 404, path);
    }
    const health = await fetch(`${origin}/api/v1/health/live`);
    assert.equal(health.status, 200);
    assert.equal(
      ((await health.json()) as { data: { status: string } }).data.status,
      'ok',
    );
  } finally {
    await app.close();
  }
});

test('four role references include only role routes, usable feature tags and reachable schemas', async () => {
  const module = await Test.createTestingModule({ controllers })
    .useMocker(() => ({}))
    .compile();
  const app = module.createNestApplication({ logger: false });
  configureApplication(app, []);
  try {
    const source = createApiDocument(app);
    const original = JSON.stringify(source);
    const union = new Set<string>();
    const expectedCounts = {
      customer: 36,
      restaurant: 38,
      admin: 23,
      'delivery-company': 24,
    };
    const common = [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/me',
      '/api/v1/me/password',
      '/api/v1/health/ready',
    ];
    for (const role of swaggerRoles) {
      const doc = createRoleDocument(source, role);
      await SwaggerParser.validate(JSON.parse(JSON.stringify(doc)), {
        resolve: { external: false },
      });
      const entries = Object.entries(doc.paths).flatMap(([path, item]) =>
        Object.keys(item).map((method) => `${method} ${path}`),
      );
      assert.equal(entries.length, expectedCounts[role.slug], role.name);
      entries.forEach((entry) => union.add(entry));
      for (const path of common)
        assert.ok(doc.paths[path], `${role.name}: ${path}`);
      for (const [path, item] of Object.entries(doc.paths)) {
        for (const prefix of [
          '/api/v1/customer/',
          '/api/v1/restaurant/',
          '/api/v1/admin/',
          '/api/v1/delivery-company/',
        ]) {
          if (prefix !== role.prefix)
            assert.ok(!path.startsWith(prefix), `${role.name}: ${path}`);
        }
        for (const operation of Object.values(item) as OperationObject[])
          assert.equal(operation.tags?.length, 1);
      }
      assert.equal(
        !!doc.paths['/api/v1/auth/register'],
        role.slug === 'customer',
      );
      assert.equal(
        !!doc.paths['/api/v1/auth/register/restaurant'],
        role.slug === 'restaurant',
      );
      assert.equal(
        !!doc.paths['/api/v1/restaurants'],
        role.slug === 'customer',
      );
      assert.equal(
        !!doc.paths['/api/v1/restaurant/products'],
        role.slug === 'restaurant',
      );
      assert.equal(!!doc.paths['/api/v1/admin/users'], role.slug === 'admin');
      assert.equal(
        !!doc.paths['/api/v1/delivery-company/drivers'],
        role.slug === 'delivery-company',
      );
      const schemas = doc.components!.schemas!;
      const loginResponse =
        doc.paths['/api/v1/auth/login']!.post!.responses[200]!;
      assert.ok(!('$ref' in loginResponse));
      const loginExample = loginResponse.content!['application/json']!
        .example as { data: { user: { role: string } } };
      assert.equal(
        loginExample.data.user.role,
        role.slug === 'delivery-company' ? 'Delivery_Company' : role.name,
      );
      const ownResponse = doc.paths['/api/v1/me']!.get!.responses[200]!;
      assert.ok(!('$ref' in ownResponse));
      assert.equal(
        ownResponse.content!['application/json']!.example.data.role,
        loginExample.data.user.role,
      );
      assert.equal('AdminCreateUserDto' in schemas, role.slug === 'admin');
      assert.equal('CreateProductDto' in schemas, role.slug === 'restaurant');
      assert.equal(
        'CreateDriverDto' in schemas,
        role.slug === 'delivery-company',
      );
      assert.equal('CreateAddressDto' in schemas, role.slug === 'customer');
      assert.equal(
        'cus_avatar_url' in (schemas.PatchMeDto as SchemaObject).properties!,
        role.slug === 'customer',
      );
      const patch = doc.paths['/api/v1/me']!.patch!
        .requestBody as RequestBodyObject;
      const sample = patch.content['application/json']!.examples!.standard;
      assert.ok(sample && !('$ref' in sample));
      assert.equal('cus_avatar_url' in sample.value, role.slug === 'customer');
      if (role.slug === 'customer') {
        assert.deepEqual(
          doc.paths['/api/v1/restaurants/{rest_id}/products']!.get!.tags,
          ['Products'],
        );
        assert.deepEqual(doc.paths['/api/v1/customer/cart']!.get!.tags, [
          'Cart',
        ]);
      }
      if (role.slug === 'restaurant')
        assert.deepEqual(
          doc.paths['/api/v1/restaurant/products/{prod_id}/addons']!.get!.tags,
          ['Product Addons'],
        );
    }
    assert.equal(union.size, 85);
    assert.equal(
      JSON.stringify(source),
      original,
      'Role projections must not mutate each other or the full reference.',
    );
  } finally {
    await app.close();
  }
});
