# AKEELA Delivery Company

Implemented React/Vite/TypeScript dashboard, Arabic RTL and tab-scoped sessionStorage sessions. Read [app instructions](AGENTS.md) and [design](../../docs/PORTAL-DESIGN.md).

From the repository root:

```powershell
npm ci
npm run dev:delivery
npm run check:delivery
npm run test:e2e --workspace @akeela/delivery
```

Local URL: http://127.0.0.1:5175. API default: /api/v1 through the Vite proxy to port 3000; the socket proxy uses /socket.io. Optional public VITE_API_BASE_URL only; never add secrets.

Production: delivery.akeelaonline.tech via [Docker/Caddy deployment](../../docs/DEPLOYMENT.md). Build from the repository root with apps/delivery/Dockerfile.
