# Delivery company application (reserved)

Planned origin: `https://delivery.akeela.com`. This is a dispatcher application, not driver login.

Read the root [AGENTS.md](../../AGENTS.md), local [app instructions](AGENTS.md) and [Delivery design guide](../../docs/frontend/AKEELA-Delivery-App.md) before work.

No frontend source, dependencies, Docker image or deployment job exists yet. Agree on framework, language/RTL and browser session handling before implementation.

When implemented, register this npm workspace and add its own tests, Docker/static-build configuration, Caddy site and independent CI/release job. Use the root lockfile; do not introduce a nested Git repository or put database, SMTP or JWT signing secrets in frontend configuration.
