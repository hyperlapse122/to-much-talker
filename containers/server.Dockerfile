# syntax=docker/dockerfile:1.7
#
# Discord bot runtime image for `@to-much-talker/server`.
#
# Build context MUST be a pre-pruned monorepo produced by:
#   turbo prune @to-much-talker/server --docker --out-dir out-server
#
# The context layout is therefore:
#   out-server/
#     json/    manifests + lockfile (cache layer)
#     full/    full source for the target + its workspace deps
#
# CI passes `context: ./out-server` to docker/build-push-action.
# Local: `docker build -f containers/server.Dockerfile out-server`.

FROM node:24-slim AS base
ENV CI=true \
    YARN_ENABLE_GLOBAL_CACHE=false
RUN corepack enable

# ---------------------------------------------------------------
# Builder — installs deps, then bundles the server with Vite 8
# ---------------------------------------------------------------
FROM base AS builder
WORKDIR /app

# Native build deps for @discordjs/opus and better-sqlite3.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# 1. Manifest-only layer (cached when only source changes)
COPY json/ ./
RUN yarn install --immutable

# 2. Full source layer
COPY full/ ./

# 3. Compile Paraglide output in the pruned context; src/paraglide/ is gitignored
#    and missing from fresh Docker builds until i18n is compiled.
RUN yarn workspace @to-much-talker/i18n compile

# 4. Bundle with Vite 8 — everything is inlined except native modules
RUN yarn workspace @to-much-talker/server build

# ---------------------------------------------------------------
# Runtime — Node 24 + ffmpeg, no build toolchain
# ---------------------------------------------------------------
FROM base AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN groupadd -r tmt && useradd -r -g tmt -s /sbin/nologin -d /app tmt

# Carry the entire built tree so native externals
# (@discordjs/opus, better-sqlite3) resolve at runtime via node_modules.
COPY --from=builder --chown=tmt:tmt /app ./

# SQLite data dir for the default driver.
RUN mkdir -p /app/data && chown tmt:tmt /app/data

USER tmt
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/server/dist/index.js", "start"]
