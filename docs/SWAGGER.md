# Swagger API Reference

Swagger documents all 96 implemented REST endpoints for mobile and web clients. It uses real controller/DTO metadata and the approved request/response contract. No business behavior or database schema changes are part of this addition.

## Open the reference

Start the API normally, then open:

| Resource               | Local URL                                |
| ---------------------- | ---------------------------------------- |
| Interactive Swagger UI | `http://localhost:3000/api/v1/docs`      |
| OpenAPI JSON           | `http://localhost:3000/api/v1/docs-json` |

## Four role references

The main `/api/v1/docs` page starts with Customer. Use the top role selector to switch between four references, or open a direct page:

| Role             | UI path                         | JSON path                            | Operations |
| ---------------- | ------------------------------- | ------------------------------------ | ---------- |
| Customer         | `/api/v1/docs/customer`         | `/api/v1/docs/customer-json`         | 41         |
| Restaurant       | `/api/v1/docs/restaurant`       | `/api/v1/docs/restaurant-json`       | 45         |
| Admin            | `/api/v1/docs/admin`            | `/api/v1/docs/admin-json`            | 28         |
| Delivery Company | `/api/v1/docs/delivery-company` | `/api/v1/docs/delivery-company-json` | 27         |

Each role has its own feature groups, such as Authentication, My Profile, Products, Cart, Orders or Drivers. Only features implemented for that client appear. Customer product browsing and Restaurant product management are separate. Admin has no product-management API. Authentication, own-account and health operations are shared, so they appear in all four views. Public registration appears only for Customer and Restaurant. Admin setup uses CLI; Admin creates Delivery Company accounts.

These are documentation paths and groups; actual API URLs and authorization rules do not change. Documentation is not an access-control boundary. The full `/api/v1/docs-json` remains available for existing imports and contains all 96 unique operations. Role JSON removes unrelated input models while retaining referenced shared response models, including role profiles needed by Admin account management. Login and own-account examples match the selected role. Non-Customer PATCH `/me` omits the Customer-only avatar field and its example.

With Swagger enabled on the VPS, the mobile reference is `https://api.akeelaonline.tech/api/v1/docs` and JSON is `https://api.akeelaonline.tech/api/v1/docs-json`. Caddy's existing API proxy supports these paths; no new domain, service or public port is required. Deployment must still be verified after release.

## Temporary production access

`SWAGGER_ENABLED` accepts only `true` or `false`. Default: true outside production, false in production. Production Compose also defaults to false. For the owner-approved mobile testing window, set `SWAGGER_ENABLED=true` in the private server `/opt/akeela/.env.production` before the release.

When the owner finishes testing, set it to `false` and recreate only the API from the current release directory:

```bash
docker compose -p akeela --env-file /opt/akeela/.env.production --env-file /opt/akeela/images.env -f compose.production.yml up -d --no-deps api
```

Verify the main page, full JSON, all four role pages/JSON and their Swagger assets return 404, while `/api/v1/health/ready` stays 200. The API, stored data and images remain available. This hides the entire documentation surface; no source deletion, rebuild or database action is needed. Do not run this shutdown step until the owner asks. There is no automatic expiry timer.

Documentation is public and contains synthetic examples only. Swagger assets are served by NestJS, with no external schema validator. JSON can be imported into API tools or used for client generation. YAML is disabled. Socket.IO is described in the introduction and [REALTIME.md](REALTIME.md), not represented as fake REST endpoints.

## For the mobile developer

1. Expand a feature and endpoint. Read its access rules, request schema, examples and response/error models.
2. Register a Customer, verify the email OTP, then log in. Public menu routes need no token.
3. Click **Authorize** and paste `access_token` alone. Protected requests use `Authorization: Bearer <token>`. Authorization is not persisted across reloads.
4. Refresh with the JSON `refresh_token`. Save both new tokens after rotation. Use one refresh operation for concurrent 401 responses; a used refresh token cannot be replayed.
5. Replace sample IDs with owned records. IDs, money and coordinates are strings; currency is EGP and dates use Africa/Cairo offsets. Do not convert IDs or money to floating-point numbers.
6. Handle HTTP status and `error.code`; use optional `error.fields` for input messages. Lists may be paginated (with `meta`) or plain arrays; follow each response schema.

**Try it out makes real calls to the selected API**, including emails, account changes, uploads and checkout. Default server is the current API origin. For uploads, select one image in `file` and let the client set the multipart boundary. Checkout has no retry/idempotency key: inspect orders/cart after a lost response before retrying.

Examples are independent and may use placeholder tokens or dates that are no longer current. They show shapes, not working credentials or live data. Auth lifetimes and rate settings are configurable; examples show approved defaults.

## Maintain the reference

| File                                            | Update when                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/api/src/modules/**/**.dto.ts`             | Change input fields, types, descriptions, examples or validation constraints using `ApiProperty`     |
| `apps/api/src/documentation/operations.ts`      | Change a method, path, feature, purpose, status, response model or body example                      |
| `apps/api/src/documentation/response-models.ts` | Change public response fields, nullability, enums or nested models; never register database entities |
| `apps/api/src/documentation/examples.ts`        | Change synthetic response examples                                                                   |
| `apps/api/src/documentation/swagger.ts`         | Change access rules, error descriptions, conditional request rules or integration guidance           |
| `apps/api/src/documentation/role-documents.ts`  | Change role visibility, feature grouping or scoped schemas; update role coverage tests too           |
| `apps/api/test/swagger.test.ts`                 | Extend coverage and contract checks for new routes/models                                            |

Follow root specifications first; update the relevant contract, Bruno request and Swagger in the same feature when behavior changes. Swagger is the interactive rendering of the contract, not permission to invent requirements. The API image includes these TypeScript definitions; it does not read root Markdown at runtime.

`npm test` checks controller/spec/Swagger route parity, operation IDs, access documentation, DTO/schema field parity, examples against actual validators, OpenAPI validity/local references, pagination, conditional cart/checkout shapes, uploads and served UI/JSON/assets. Role tests check visibility, registration, feature tags, schema references, field scoping, complete 96-operation coverage and disabled role routes. These tests use mocked dependencies only; no PostgreSQL or SMTP access. Business changes still need normal integration tests.

See [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction), [operations](https://docs.nestjs.com/openapi/operations) and [multiple specifications](https://docs.nestjs.com/openapi/other-features).
