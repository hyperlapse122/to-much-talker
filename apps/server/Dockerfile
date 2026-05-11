# ========================
# Stage 1: Builder
# ========================
FROM node:24-slim AS builder

WORKDIR /workspace

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

# Copy all package manifests for workspace resolution
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY packages/crypto/package.json packages/crypto/
COPY packages/db/package.json packages/db/
COPY packages/ai/package.json packages/ai/
COPY packages/i18n/package.json packages/i18n/
COPY packages/settings-core/package.json packages/settings-core/

# Install dependencies
RUN yarn install --immutable

# Copy source files
COPY tsconfig.base.json ./
COPY apps/server apps/server/
COPY packages/shared packages/shared/
COPY packages/config packages/config/
COPY packages/crypto packages/crypto/
COPY packages/db packages/db/
COPY packages/ai packages/ai/
COPY packages/i18n packages/i18n/
COPY packages/settings-core packages/settings-core/

# Build
RUN yarn workspace @to-much-talker/shared build
RUN yarn workspace @to-much-talker/config build
RUN yarn workspace @to-much-talker/crypto build
RUN yarn workspace @to-much-talker/db build
RUN yarn workspace @to-much-talker/ai build
RUN yarn workspace @to-much-talker/i18n build
RUN yarn workspace @to-much-talker/settings-core build
RUN yarn workspace @to-much-talker/server build

# ========================
# Stage 2: Production
# ========================
FROM node:24-slim AS production

# Install runtime dependencies: FFmpeg for audio transcoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r tmt && useradd -r -g tmt -s /sbin/nologin -d /app tmt

# Copy built artifacts and node_modules
COPY --from=builder /workspace/node_modules /app/node_modules
COPY --from=builder /workspace/apps/server/dist /app/dist
COPY --from=builder /workspace/apps/server/package.json /app/package.json
COPY --from=builder /workspace/packages /app/packages

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R tmt:tmt /app

USER tmt

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

# Default command
CMD ["node", "dist/index.js", "start"]
