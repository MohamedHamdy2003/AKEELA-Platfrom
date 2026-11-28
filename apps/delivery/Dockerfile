FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/brand/package.json packages/brand/package.json
COPY packages/portal/package.json packages/portal/package.json
COPY apps/delivery/package.json apps/delivery/package.json
RUN npm ci --workspace @akeela/delivery --include-workspace-root=false
COPY packages/brand packages/brand
COPY packages/portal packages/portal
COPY apps/delivery apps/delivery
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace @akeela/delivery

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY apps/delivery/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/delivery/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --start-interval=2s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
