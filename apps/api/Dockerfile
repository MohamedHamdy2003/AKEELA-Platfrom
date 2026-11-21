FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --workspace akeela-api --include-workspace-root=false
COPY apps/api/tsconfig*.json apps/api/nest-cli.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN npm run build

FROM node:24-bookworm-slim AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --omit=dev --workspace akeela-api --include-workspace-root=false && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV TZ=Africa/Cairo
ENV IMAGE_STORAGE_PATH=/app/storage/images
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node apps/api/assets ./apps/api/assets
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/api/package.json ./apps/api/package.json
RUN mkdir -p /app/storage/images && chown -R node:node /app/storage
WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
