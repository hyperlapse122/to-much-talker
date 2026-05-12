# syntax=docker/dockerfile:1.7
#
# Static-serve image for `@to-much-talker/docs`.
#
# Build context MUST be a pre-pruned monorepo produced by:
#   turbo prune @to-much-talker/docs --docker --out-dir out-docs
#
# CI passes `context: ./out-docs` to docker/build-push-action.
# Local: `docker build -f containers/docs.Dockerfile out-docs`.

FROM node:24-slim AS base
ENV CI=true \
    YARN_ENABLE_GLOBAL_CACHE=false
RUN corepack enable

# ---------------------------------------------------------------
# Builder — installs deps then bundles to static assets via Vite 8
# ---------------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY json/ ./
RUN yarn install --immutable

COPY full/ ./
RUN yarn workspace @to-much-talker/docs build

# ---------------------------------------------------------------
# Runtime — `serve` for static SPA assets
# ---------------------------------------------------------------
FROM base AS runtime
WORKDIR /app
RUN groupadd -r tmt && useradd -r -g tmt -s /sbin/nologin -d /app tmt
RUN npm install -g serve@14

COPY --from=builder --chown=tmt:tmt /app/apps/docs/dist ./dist

USER tmt
EXPOSE 3002
CMD ["serve", "-s", "dist", "-l", "3002"]
