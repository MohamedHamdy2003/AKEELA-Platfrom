# AKEELA Admin

Implemented React/Vite/TypeScript dashboard, Arabic RTL and memory-only sessions. Read [app instructions](AGENTS.md) and [design](../../docs/PORTAL-DESIGN.md).

From the repository root:

```powershell
npm ci
npm run dev:admin
npm run check:admin
npm run test:e2e --workspace @akeela/admin
```

Local URL: http://127.0.0.1:5174. API default: /api/v1 through the Vite proxy to port 3000; the socket proxy uses /socket.io. Optional public VITE_API_BASE_URL only; never add secrets.

Production: admin.akeelaonline.tech via [Docker/Caddy deployment](../../docs/DEPLOYMENT.md). Build from the repository root with apps/admin/Dockerfile.
