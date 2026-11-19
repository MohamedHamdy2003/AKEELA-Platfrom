# Swagger API Reference

Swagger documents all 81 implemented REST endpoints for mobile and web clients. It uses real controller/DTO metadata and the approved request/response contract. No business behavior or database schema changes are part of this addition.

## Open the reference

Start the API normally, then open:

| Resource               | Local URL                                |
| ---------------------- | ---------------------------------------- |
| Interactive Swagger UI | `http://localhost:3000/api/v1/docs`      |
| OpenAPI JSON           | `http://localhost:3000/api/v1/docs-json` |

After an owner-approved release, the same paths work on the configured API domain. Do not assume a dev-only change is already on the VPS. Caddy's existing API proxy supports these paths; no new service or public port is required.

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
| `apps/api/test/swagger.test.ts`                 | Extend coverage and contract checks for new routes/models                                            |

Follow root specifications first; update the relevant contract, Bruno request and Swagger in the same feature when behavior changes. Swagger is the interactive rendering of the contract, not permission to invent requirements. The API image includes these TypeScript definitions; it does not read root Markdown at runtime.

`npm test` checks controller/spec/Swagger route parity, operation IDs, access documentation, DTO/schema field parity, examples against actual validators, OpenAPI validity/local references, pagination, conditional cart/checkout shapes, uploads and served UI/JSON/assets. These documentation tests use mocked dependencies only; no PostgreSQL or SMTP access. Business changes still need normal integration tests.

See [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction) and [operations](https://docs.nestjs.com/openapi/operations).
