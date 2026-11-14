# AKEELA API

The existing NestJS modular monolith lives here. It keeps one PostgreSQL database and the same API contracts, roles, migrations and storage volumes.

Read [AGENTS.md](../../AGENTS.md), [Architecture](../../docs/ARCHITECTURE.md), [Monorepo](../../docs/MONOREPO.md) and the relevant root specifications before edits.

Run `npm ci` from the repository root. Root scripts forward API commands with the correct working directory:

```sh
npm run setup:local
docker compose up -d postgres mailpit
npm run start:dev
npm run check
```

Local secrets belong in `apps/api/.env`; use `.env.example` and `.env.gmail.example` in this directory. Production values are passed into the container. Keep separate environments for future frontends.

Compiled outputs are `apps/api/dist` and `apps/api/dist-test`. From the repository root, build the production image with:

```sh
docker build -f apps/api/Dockerfile -t akeela-api:local .
```

The Docker context is the repository root so npm can use the shared lockfile. The runtime starts from `/app/apps/api`, resolves production dependencies from `/app/node_modules`, and keeps image storage at `/app/storage/images` for persistent-volume compatibility. No frontend code is bundled into this image.
