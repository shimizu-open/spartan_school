# syntax=docker/dockerfile:1
# Pixel Office container image.
#   docker build -t pixel-office .
#   docker run -p 3000:3000 pixel-office
#
# Two stages: "build" compiles the browser code with dev tools; "runtime" only
# contains what is needed to run, so the final image is small and has fewer
# packages that could have vulnerabilities.

ARG NODE_IMAGE=node:24.22.1-alpine3.24

# ---- 1. build the browser app ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY client ./client
RUN npm run typecheck && npm run build

# ---- 2. runtime ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force
COPY shared ./shared
COPY server ./server
COPY --from=build /app/dist ./dist
# Uploaded files go to /data (a Docker volume), owned by the unprivileged user.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
# Run as the unprivileged "node" user, never root.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1
# Node 24 runs TypeScript files directly (type stripping), so no compile step is needed.
CMD ["node", "server/index.ts"]
