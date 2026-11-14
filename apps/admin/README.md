# Admin application (reserved)

Planned origin: `https://admin.akeela.com`.

Read the root [AGENTS.md](../../AGENTS.md), local [app instructions](AGENTS.md) and [Admin design guide](../../docs/frontend/AKEELA-Admin-App.md) before work.

No frontend source, dependencies, Docker image or deployment job exists yet. Use current-task decisions for framework, language/RTL and browser sessions; clarify only missing choices that block the requested work.

When implemented, add this directory to root npm workspaces, use the root lockfile, and add its own tests, Docker/static-build configuration, Caddy site and independent CI/release job. Keep frontend secrets separate from the API; public API configuration must never contain database, JWT signing or SMTP secrets.
