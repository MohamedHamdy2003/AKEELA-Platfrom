FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/restaurant/package.json apps/restaurant/package.json
COPY packages/brand/package.json packages/brand/package.json
COPY packages/portal/package.json packages/portal/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/delivery/package.json apps/delivery/package.json
RUN npm ci --workspace @akeela/restaurant --include-workspace-root=false
COPY packages/brand packages/brand
COPY packages/portal packages/portal
COPY apps/restaurant apps/restaurant
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_MAP_TILE_URL
ARG VITE_MAP_ATTRIBUTION
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL
ENV VITE_MAP_ATTRIBUTION=$VITE_MAP_ATTRIBUTION
RUN npm run build --workspace @akeela/restaurant

FROM nginx:stable-alpine
COPY apps/restaurant/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/restaurant/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
