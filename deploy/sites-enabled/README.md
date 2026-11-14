# Enabled frontend sites

Only reviewed `*.caddy` files in this directory are imported by the production Caddyfile. There are none initially: only the API is enabled.

After a frontend is implemented and its DNS is ready, add its Caddy site here in the same release as its tested Docker service or static build. Use the framework's actual output; do not guess an SSR port or static directory. Templates are in `../templates` and are not automatically enabled.
